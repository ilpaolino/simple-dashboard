import type { DisplayRegistry } from '../display/DisplayRegistry';
import type { HomeyDeviceRepository } from '../homey/HomeyDeviceRepository';
import type { Logger } from '../types';
import {
  COVER_CAPABILITY_ID,
  COVER_STATE_CAPABILITY_ID,
  COVER_STOP_STATE_VALUE,
  hasWindowcoveringsSetCapability,
  hasWindowcoveringsStateCapability,
} from '../widgets/cover/compatibility';
import {
  denormalizePositionPercent,
  isValidPositionPercent,
  normalizeWindowcoveringsSet,
} from '../widgets/cover/normalize';
import { LIGHT_CAPABILITY_ID, hasOnoffCapability } from '../widgets/light/compatibility';
import { parseOnoff } from '../widgets/light/runtime';
import {
  COMMAND_TIMEOUTS,
} from './constants';
import type { CommandRejectReason, WidgetActionId } from './protocol';
import type {
  PendingCommandManager,
  PendingExpectedValue,
} from './PendingCommandManager';
import type { RealtimeMetrics } from './RealtimeMetrics';

export interface WidgetActionRequest {
  readonly displayId: string;
  readonly widgetId: string;
  readonly action: WidgetActionId;
  readonly requestId: string;
  /** Required for `set-position`; ignored for other actions. */
  readonly positionPercent?: number;
}

export type WidgetCommandResult =
  | {
      readonly ok: true;
      readonly deviceId: string;
      readonly capabilityId: string;
      readonly expectedValue: PendingExpectedValue;
    }
  | {
      readonly ok: false;
      readonly reason: CommandRejectReason;
    };

export interface WidgetCommandHandlerOptions {
  readonly registry: DisplayRegistry;
  readonly deviceRepository: HomeyDeviceRepository;
  readonly pending: PendingCommandManager;
  readonly metrics: RealtimeMetrics;
  readonly logger: Logger;
}

interface ValidatedCommand {
  readonly deviceId: string;
  readonly capabilityId: string;
  readonly homeyValue: boolean | number | string;
  readonly expectedValue: PendingExpectedValue;
  readonly baselineValue: number | null;
  readonly timeoutMs: number;
  readonly allowReplacePending: boolean;
}

/**
 * Validates widget intents and executes Homey capability commands.
 * Does not own the WebSocket transport — callers send ack/reject messages.
 */
export class WidgetCommandHandler {
  private readonly registry: DisplayRegistry;
  private readonly deviceRepository: HomeyDeviceRepository;
  private readonly pending: PendingCommandManager;
  private readonly metrics: RealtimeMetrics;
  private readonly logger: Logger;

  public constructor(options: WidgetCommandHandlerOptions) {
    this.registry = options.registry;
    this.deviceRepository = options.deviceRepository;
    this.pending = options.pending;
    this.metrics = options.metrics;
    this.logger = options.logger;
  }

  public async handle(request: WidgetActionRequest): Promise<WidgetCommandResult> {
    this.metrics.recordCommandReceived();
    this.recordCoverActionReceived(request);
    this.logger.info('Command requested', {
      displayId: request.displayId,
      widgetId: request.widgetId,
      action: request.action,
      requestId: request.requestId,
      positionPercent: request.positionPercent,
    });

    const validated = await this.validate(request);
    if (!validated.ok) {
      this.metrics.recordCommandRejected();
      this.recordCoverActionRejected(request);
      this.logger.warn('Command rejected', {
        displayId: request.displayId,
        widgetId: request.widgetId,
        action: request.action,
        requestId: request.requestId,
        reason: validated.reason,
      });
      return validated;
    }

    if (validated.allowReplacePending) {
      const existing = this.pending
        .listActive()
        .find(
          (entry) =>
            entry.displayId === request.displayId &&
            entry.widgetId === request.widgetId,
        );
      if (existing) {
        this.pending.cancel(existing.requestId);
        this.logger.info('Replaced pending cover command with stop', {
          displayId: request.displayId,
          widgetId: request.widgetId,
          cancelledRequestId: existing.requestId,
          requestId: request.requestId,
        });
      }
    } else if (
      this.pending.hasPendingForWidget(request.displayId, request.widgetId)
    ) {
      this.metrics.recordCommandRejected();
      this.recordCoverActionRejected(request);
      this.logger.warn('Command rejected', {
        displayId: request.displayId,
        widgetId: request.widgetId,
        requestId: request.requestId,
        reason: 'already_pending',
      });
      return { ok: false, reason: 'already_pending' };
    }

    const registered = this.pending.register({
      requestId: request.requestId,
      displayId: request.displayId,
      widgetId: request.widgetId,
      deviceId: validated.deviceId,
      capabilityId: validated.capabilityId,
      action: request.action,
      expectedValue: validated.expectedValue,
      baselineValue: validated.baselineValue,
      timeoutMs: validated.timeoutMs,
    });

    if (!registered) {
      this.metrics.recordCommandRejected();
      this.recordCoverActionRejected(request);
      this.logger.warn('Command rejected', {
        displayId: request.displayId,
        widgetId: request.widgetId,
        requestId: request.requestId,
        reason: 'already_pending',
      });
      return { ok: false, reason: 'already_pending' };
    }

    this.metrics.setActivePendingCommands(this.pending.activeCount());

    try {
      await this.deviceRepository.setCapabilityValue({
        deviceId: validated.deviceId,
        capabilityId: validated.capabilityId,
        value: validated.homeyValue,
      });
    } catch (error) {
      this.pending.resolveFailed(request.requestId);
      this.metrics.setActivePendingCommands(this.pending.activeCount());
      this.metrics.recordCommandFailed();
      this.recordCoverActionFailed(request);
      this.logger.error('Homey API error for capability command', {
        displayId: request.displayId,
        widgetId: request.widgetId,
        deviceId: validated.deviceId,
        capabilityId: validated.capabilityId,
        requestId: request.requestId,
        error,
      });
      return { ok: false, reason: 'homey_api_error' };
    }

    this.metrics.recordCommandAccepted();
    this.recordCoverActionAccepted(request);
    this.logger.info('Command accepted', {
      displayId: request.displayId,
      widgetId: request.widgetId,
      deviceId: validated.deviceId,
      capabilityId: validated.capabilityId,
      expectedValue: validated.expectedValue,
      requestId: request.requestId,
    });

    return {
      ok: true,
      deviceId: validated.deviceId,
      capabilityId: validated.capabilityId,
      expectedValue: validated.expectedValue,
    };
  }

  private async validate(
    request: WidgetActionRequest,
  ): Promise<
    | ({ readonly ok: true } & ValidatedCommand)
    | { readonly ok: false; readonly reason: CommandRejectReason }
  > {
    const entry = this.registry.getById(request.displayId);
    if (!entry) {
      return { ok: false, reason: 'display_session_invalid' };
    }

    const widget = entry.config.dashboard.widgets.find(
      (item) => item.id === request.widgetId,
    );
    if (!widget) {
      return { ok: false, reason: 'widget_not_found' };
    }

    if (widget.type === 'light') {
      return this.validateLightToggle(request, widget.config.deviceId);
    }

    if (widget.type === 'cover') {
      return this.validateCoverAction(request, widget.config.deviceId);
    }

    return { ok: false, reason: 'widget_type_unsupported' };
  }

  private async validateLightToggle(
    request: WidgetActionRequest,
    rawDeviceId: string,
  ): Promise<
    | ({ readonly ok: true } & ValidatedCommand)
    | { readonly ok: false; readonly reason: CommandRejectReason }
  > {
    if (request.action !== 'toggle') {
      return { ok: false, reason: 'action_not_allowed' };
    }

    const deviceId = rawDeviceId.trim();
    if (deviceId === '') {
      return { ok: false, reason: 'device_missing' };
    }

    if (this.pending.hasPendingForWidget(request.displayId, request.widgetId)) {
      return { ok: false, reason: 'already_pending' };
    }

    let device;
    try {
      device = await this.deviceRepository.getDevice(deviceId);
    } catch {
      return { ok: false, reason: 'homey_api_error' };
    }

    if (!device) {
      return { ok: false, reason: 'device_missing' };
    }

    if (!hasOnoffCapability(device)) {
      return { ok: false, reason: 'capability_missing' };
    }

    if (!device.available) {
      return { ok: false, reason: 'device_unavailable' };
    }

    const current = parseOnoff(device.capabilityValues[LIGHT_CAPABILITY_ID]);
    if (current === null) {
      return { ok: false, reason: 'invalid_state' };
    }

    const expectedValue = !current;
    return {
      ok: true,
      deviceId,
      capabilityId: LIGHT_CAPABILITY_ID,
      homeyValue: expectedValue,
      expectedValue,
      baselineValue: null,
      timeoutMs: COMMAND_TIMEOUTS.lightToggle,
      allowReplacePending: false,
    };
  }

  private async validateCoverAction(
    request: WidgetActionRequest,
    rawDeviceId: string,
  ): Promise<
    | ({ readonly ok: true } & ValidatedCommand)
    | { readonly ok: false; readonly reason: CommandRejectReason }
  > {
    if (request.action !== 'set-position' && request.action !== 'stop') {
      return { ok: false, reason: 'action_not_allowed' };
    }

    const deviceId = rawDeviceId.trim();
    if (deviceId === '') {
      return { ok: false, reason: 'device_missing' };
    }

    let device;
    try {
      device = await this.deviceRepository.getDevice(deviceId);
    } catch {
      return { ok: false, reason: 'homey_api_error' };
    }

    if (!device) {
      return { ok: false, reason: 'device_missing' };
    }

    if (!hasWindowcoveringsSetCapability(device)) {
      return { ok: false, reason: 'capability_missing' };
    }

    if (!device.available) {
      return { ok: false, reason: 'device_unavailable' };
    }

    if (request.action === 'stop') {
      if (!hasWindowcoveringsStateCapability(device)) {
        return { ok: false, reason: 'action_not_allowed' };
      }

      return {
        ok: true,
        deviceId,
        capabilityId: COVER_STATE_CAPABILITY_ID,
        homeyValue: COVER_STOP_STATE_VALUE,
        expectedValue: COVER_STOP_STATE_VALUE,
        baselineValue: null,
        timeoutMs: COMMAND_TIMEOUTS.coverStop,
        // Stop may interrupt an in-flight set-position for the same widget.
        allowReplacePending: true,
      };
    }

    if (!isValidPositionPercent(request.positionPercent)) {
      return { ok: false, reason: 'invalid_position' };
    }

    if (this.pending.hasPendingForWidget(request.displayId, request.widgetId)) {
      return { ok: false, reason: 'already_pending' };
    }

    const current = normalizeWindowcoveringsSet(
      device.capabilityValues[COVER_CAPABILITY_ID],
    );

    return {
      ok: true,
      deviceId,
      capabilityId: COVER_CAPABILITY_ID,
      homeyValue: denormalizePositionPercent(request.positionPercent),
      expectedValue: request.positionPercent,
      baselineValue: current.positionPercent,
      timeoutMs: COMMAND_TIMEOUTS.coverSetPosition,
      allowReplacePending: false,
    };
  }

  private recordCoverActionReceived(request: WidgetActionRequest): void {
    if (request.action === 'set-position') {
      this.metrics.recordCoverCommandReceived('set-position');
      if (request.positionPercent === 100) {
        this.metrics.recordCoverOpenCommand();
      } else if (request.positionPercent === 0) {
        this.metrics.recordCoverCloseCommand();
      }
    } else if (request.action === 'stop') {
      this.metrics.recordCoverCommandReceived('stop');
    }
  }

  private recordCoverActionRejected(request: WidgetActionRequest): void {
    if (
      request.action === 'set-position' ||
      request.action === 'stop'
    ) {
      this.metrics.recordCoverCommandRejected();
    }
  }

  private recordCoverActionAccepted(request: WidgetActionRequest): void {
    if (
      request.action === 'set-position' ||
      request.action === 'stop'
    ) {
      this.metrics.recordCoverCommandAccepted();
    }
  }

  private recordCoverActionFailed(request: WidgetActionRequest): void {
    if (
      request.action === 'set-position' ||
      request.action === 'stop'
    ) {
      this.metrics.recordCoverCommandFailed();
    }
  }
}
