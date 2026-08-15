import type { DisplayRegistry } from '../display/DisplayRegistry';
import type { HomeyDeviceRepository } from '../homey/HomeyDeviceRepository';
import type { Logger } from '../types';
import { LIGHT_CAPABILITY_ID, hasOnoffCapability } from '../widgets/light/compatibility';
import { parseOnoff } from '../widgets/light/runtime';
import type { CommandRejectReason, WidgetActionId } from './protocol';
import type { PendingCommandManager } from './PendingCommandManager';
import type { RealtimeMetrics } from './RealtimeMetrics';

export interface WidgetActionRequest {
  readonly displayId: string;
  readonly widgetId: string;
  readonly action: WidgetActionId;
  readonly requestId: string;
}

export type WidgetCommandResult =
  | {
      readonly ok: true;
      readonly deviceId: string;
      readonly expectedValue: boolean;
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
    this.logger.info('Command requested', {
      displayId: request.displayId,
      widgetId: request.widgetId,
      action: request.action,
      requestId: request.requestId,
    });

    const validated = await this.validate(request);
    if (!validated.ok) {
      this.metrics.recordCommandRejected();
      this.logger.warn('Command rejected', {
        displayId: request.displayId,
        widgetId: request.widgetId,
        action: request.action,
        requestId: request.requestId,
        reason: validated.reason,
      });
      return validated;
    }

    const registered = this.pending.register({
      requestId: request.requestId,
      displayId: request.displayId,
      widgetId: request.widgetId,
      deviceId: validated.deviceId,
      action: request.action,
      expectedValue: validated.expectedValue,
    });

    if (!registered) {
      this.metrics.recordCommandRejected();
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
        capabilityId: LIGHT_CAPABILITY_ID,
        value: validated.expectedValue,
      });
    } catch (error) {
      this.pending.resolveFailed(request.requestId);
      this.metrics.setActivePendingCommands(this.pending.activeCount());
      this.metrics.recordCommandFailed();
      this.logger.error('Homey API error for capability command', {
        displayId: request.displayId,
        widgetId: request.widgetId,
        deviceId: validated.deviceId,
        requestId: request.requestId,
        error,
      });
      return { ok: false, reason: 'homey_api_error' };
    }

    this.metrics.recordCommandAccepted();
    this.logger.info('Command accepted', {
      displayId: request.displayId,
      widgetId: request.widgetId,
      deviceId: validated.deviceId,
      expectedValue: validated.expectedValue,
      requestId: request.requestId,
    });

    return {
      ok: true,
      deviceId: validated.deviceId,
      expectedValue: validated.expectedValue,
    };
  }

  private async validate(
    request: WidgetActionRequest,
  ): Promise<
    | {
        readonly ok: true;
        readonly deviceId: string;
        readonly expectedValue: boolean;
      }
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

    if (widget.type !== 'light') {
      return { ok: false, reason: 'widget_type_unsupported' };
    }

    if (request.action !== 'toggle') {
      return { ok: false, reason: 'action_not_allowed' };
    }

    const deviceId = widget.config.deviceId.trim();
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

    // Target is always derived server-side from Homey's current value.
    return {
      ok: true,
      deviceId,
      expectedValue: !current,
    };
  }
}
