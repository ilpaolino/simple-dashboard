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
import {
  LIGHT_CAPABILITY_ID,
  LIGHT_DIM_CAPABILITY_ID,
  LIGHT_HUE_CAPABILITY_ID,
  LIGHT_MODE_CAPABILITY_ID,
  LIGHT_MODE_COLOR,
  LIGHT_MODE_TEMPERATURE,
  LIGHT_SATURATION_CAPABILITY_ID,
  LIGHT_TEMPERATURE_CAPABILITY_ID,
  hasDimCapability,
  hasLightColorCapabilities,
  hasLightModeCapability,
  hasLightTemperatureCapability,
  hasOnoffCapability,
} from '../widgets/light/compatibility';
import {
  denormalizePercentToHomey,
  encodeLightColorExpected,
  isValidPercent,
} from '../widgets/light/normalize';
import { parseOnoff } from '../widgets/light/runtime';
import { COMMAND_TIMEOUTS } from './constants';
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
  /** Required for `set-dim` / `set-temperature`. */
  readonly valuePercent?: number;
  /** Required for `set-color`. */
  readonly huePercent?: number;
  /** Required for `set-color`. */
  readonly saturationPercent?: number;
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

interface CapabilityWrite {
  readonly capabilityId: string;
  readonly value: boolean | number | string;
}

interface ValidatedCommand {
  readonly deviceId: string;
  /** Primary capability used for pending confirmation routing. */
  readonly capabilityId: string;
  readonly writes: readonly CapabilityWrite[];
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
    this.recordActionReceived(request);
    this.logger.info('Command requested', {
      displayId: request.displayId,
      widgetId: request.widgetId,
      action: request.action,
      requestId: request.requestId,
      positionPercent: request.positionPercent,
      valuePercent: request.valuePercent,
      huePercent: request.huePercent,
      saturationPercent: request.saturationPercent,
    });

    const validated = await this.validate(request);
    if (!validated.ok) {
      this.metrics.recordCommandRejected();
      this.recordActionRejected(request);
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
      this.recordActionRejected(request);
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
      this.recordActionRejected(request);
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
      for (const write of validated.writes) {
        this.logger.info('Capability validation passed', {
          displayId: request.displayId,
          widgetId: request.widgetId,
          deviceId: validated.deviceId,
          capabilityId: write.capabilityId,
          requestId: request.requestId,
        });
        await this.deviceRepository.setCapabilityValue({
          deviceId: validated.deviceId,
          capabilityId: write.capabilityId,
          value: write.value,
        });
      }
    } catch (error) {
      this.pending.resolveFailed(request.requestId);
      this.metrics.setActivePendingCommands(this.pending.activeCount());
      this.metrics.recordCommandFailed();
      this.recordActionFailed(request);
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
    this.recordActionAccepted(request);
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
      return this.validateLightAction(request, widget.config.deviceId);
    }

    if (widget.type === 'cover') {
      return this.validateCoverAction(request, widget.config.deviceId);
    }

    return { ok: false, reason: 'widget_type_unsupported' };
  }

  private async validateLightAction(
    request: WidgetActionRequest,
    rawDeviceId: string,
  ): Promise<
    | ({ readonly ok: true } & ValidatedCommand)
    | { readonly ok: false; readonly reason: CommandRejectReason }
  > {
    if (
      request.action !== 'toggle' &&
      request.action !== 'set-dim' &&
      request.action !== 'set-temperature' &&
      request.action !== 'set-color'
    ) {
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

    if (request.action === 'toggle') {
      const current = parseOnoff(device.capabilityValues[LIGHT_CAPABILITY_ID]);
      if (current === null) {
        return { ok: false, reason: 'invalid_state' };
      }

      const expectedValue = !current;
      return {
        ok: true,
        deviceId,
        capabilityId: LIGHT_CAPABILITY_ID,
        writes: [{ capabilityId: LIGHT_CAPABILITY_ID, value: expectedValue }],
        expectedValue,
        baselineValue: null,
        timeoutMs: COMMAND_TIMEOUTS.lightToggle,
        allowReplacePending: false,
      };
    }

    if (request.action === 'set-dim') {
      if (!hasDimCapability(device)) {
        return { ok: false, reason: 'capability_missing' };
      }
      if (!isValidPercent(request.valuePercent)) {
        return { ok: false, reason: 'invalid_value' };
      }

      return {
        ok: true,
        deviceId,
        capabilityId: LIGHT_DIM_CAPABILITY_ID,
        writes: [
          {
            capabilityId: LIGHT_DIM_CAPABILITY_ID,
            value: denormalizePercentToHomey(request.valuePercent),
          },
        ],
        expectedValue: request.valuePercent,
        baselineValue: null,
        timeoutMs: COMMAND_TIMEOUTS.lightDim,
        allowReplacePending: false,
      };
    }

    if (request.action === 'set-temperature') {
      if (!hasLightTemperatureCapability(device)) {
        return { ok: false, reason: 'capability_missing' };
      }
      if (!isValidPercent(request.valuePercent)) {
        return { ok: false, reason: 'invalid_value' };
      }

      const writes: CapabilityWrite[] = [];
      if (hasLightModeCapability(device)) {
        writes.push({
          capabilityId: LIGHT_MODE_CAPABILITY_ID,
          value: LIGHT_MODE_TEMPERATURE,
        });
      }
      writes.push({
        capabilityId: LIGHT_TEMPERATURE_CAPABILITY_ID,
        value: denormalizePercentToHomey(request.valuePercent),
      });

      return {
        ok: true,
        deviceId,
        capabilityId: LIGHT_TEMPERATURE_CAPABILITY_ID,
        writes,
        expectedValue: request.valuePercent,
        baselineValue: null,
        timeoutMs: COMMAND_TIMEOUTS.lightTemperature,
        allowReplacePending: false,
      };
    }

    // set-color
    if (!hasLightColorCapabilities(device)) {
      return { ok: false, reason: 'capability_missing' };
    }
    if (
      !isValidPercent(request.huePercent) ||
      !isValidPercent(request.saturationPercent)
    ) {
      return { ok: false, reason: 'invalid_value' };
    }

    const writes: CapabilityWrite[] = [];
    if (hasLightModeCapability(device)) {
      writes.push({
        capabilityId: LIGHT_MODE_CAPABILITY_ID,
        value: LIGHT_MODE_COLOR,
      });
    }
    writes.push({
      capabilityId: LIGHT_HUE_CAPABILITY_ID,
      value: denormalizePercentToHomey(request.huePercent),
    });
    writes.push({
      capabilityId: LIGHT_SATURATION_CAPABILITY_ID,
      value: denormalizePercentToHomey(request.saturationPercent),
    });

    return {
      ok: true,
      deviceId,
      capabilityId: LIGHT_HUE_CAPABILITY_ID,
      writes,
      expectedValue: encodeLightColorExpected(
        request.huePercent,
        request.saturationPercent,
      ),
      baselineValue: null,
      timeoutMs: COMMAND_TIMEOUTS.lightColor,
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
        writes: [
          {
            capabilityId: COVER_STATE_CAPABILITY_ID,
            value: COVER_STOP_STATE_VALUE,
          },
        ],
        expectedValue: COVER_STOP_STATE_VALUE,
        baselineValue: null,
        timeoutMs: COMMAND_TIMEOUTS.coverStop,
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
      writes: [
        {
          capabilityId: COVER_CAPABILITY_ID,
          value: denormalizePositionPercent(request.positionPercent),
        },
      ],
      expectedValue: request.positionPercent,
      baselineValue: current.positionPercent,
      timeoutMs: COMMAND_TIMEOUTS.coverSetPosition,
      allowReplacePending: false,
    };
  }

  private recordActionReceived(request: WidgetActionRequest): void {
    if (request.action === 'set-position') {
      this.metrics.recordCoverCommandReceived('set-position');
      if (request.positionPercent === 100) {
        this.metrics.recordCoverOpenCommand();
      } else if (request.positionPercent === 0) {
        this.metrics.recordCoverCloseCommand();
      }
      return;
    }
    if (request.action === 'stop') {
      this.metrics.recordCoverCommandReceived('stop');
      return;
    }
    if (
      request.action === 'set-dim' ||
      request.action === 'set-temperature' ||
      request.action === 'set-color' ||
      request.action === 'toggle'
    ) {
      this.metrics.recordLightCommandReceived(request.action);
    }
  }

  private recordActionRejected(request: WidgetActionRequest): void {
    if (request.action === 'set-position' || request.action === 'stop') {
      this.metrics.recordCoverCommandRejected();
      return;
    }
    if (
      request.action === 'set-dim' ||
      request.action === 'set-temperature' ||
      request.action === 'set-color' ||
      request.action === 'toggle'
    ) {
      this.metrics.recordLightCommandRejected();
    }
  }

  private recordActionAccepted(request: WidgetActionRequest): void {
    if (request.action === 'set-position' || request.action === 'stop') {
      this.metrics.recordCoverCommandAccepted();
      return;
    }
    if (
      request.action === 'set-dim' ||
      request.action === 'set-temperature' ||
      request.action === 'set-color' ||
      request.action === 'toggle'
    ) {
      this.metrics.recordLightCommandAccepted();
    }
  }

  private recordActionFailed(request: WidgetActionRequest): void {
    if (request.action === 'set-position' || request.action === 'stop') {
      this.metrics.recordCoverCommandFailed();
      return;
    }
    if (
      request.action === 'set-dim' ||
      request.action === 'set-temperature' ||
      request.action === 'set-color' ||
      request.action === 'toggle'
    ) {
      this.metrics.recordLightCommandFailed();
    }
  }
}
