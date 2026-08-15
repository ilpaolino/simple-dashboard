import type { IncomingMessage, Server as HttpServerNode } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import type { DisplayRegistry } from '../display/DisplayRegistry';
import { normalizeClientIp } from '../display/ipNormalize';
import type { HomeyDeviceRepository } from '../homey/HomeyDeviceRepository';
import type { HomeyCapabilitySubscription } from '../homey/types';
import type { Logger } from '../types';
import {
  createDashboardUiCopy,
  createEmptyStateCopy,
} from '../dashboard';
import { resolveLayoutId } from '../dashboard/layoutParse';
import { resolveDashboardTheme } from '../widgets/types';
import {
  resolveDashboardRuntime,
  resolveLightWidgetRuntimeFromSnapshot,
  createLightApiErrorRuntime,
  parseOnoff,
  LIGHT_CAPABILITY_ID,
} from '../widgets';
import { DISPLAY_TYPE_IDS } from '../display/types';
import { REALTIME_PROTOCOL_VERSION, REALTIME_WEBSOCKET_PATH } from './constants';
import { extractReferencedDeviceIds } from './extractReferencedDeviceIds';
import {
  DisplayRealtimeSession,
} from './DisplayRealtimeSession';
import { RealtimeMetrics } from './RealtimeMetrics';
import { RealtimeSessionManager } from './RealtimeSessionManager';
import {
  RealtimeSubscriptionManager,
  type HomeyCapabilitySubscriber,
} from './RealtimeSubscriptionManager';
import type {
  DashboardSnapshotPayload,
  RealtimeUiCopy,
  ServerMessage,
} from './protocol';

export interface RealtimeGatewayOptions {
  readonly registry: DisplayRegistry;
  readonly deviceRepository: HomeyDeviceRepository;
  readonly capabilitySubscriber: HomeyCapabilitySubscriber;
  readonly logger: Logger;
  readonly translate: (key: string) => string;
  readonly getLanguage: () => string;
}

/**
 * Owns WebSocket upgrade, DisplaySession binding, Homey subscriptions,
 * selective event routing, and live configuration push.
 */
export class RealtimeGateway {
  private readonly registry: DisplayRegistry;
  private readonly deviceRepository: HomeyDeviceRepository;
  private readonly capabilitySubscriber: HomeyCapabilitySubscriber;
  private readonly logger: Logger;
  private readonly translate: (key: string) => string;
  private readonly getLanguage: () => string;

  public readonly metrics = new RealtimeMetrics();
  private readonly sessions: RealtimeSessionManager;
  private readonly subscriptions: RealtimeSubscriptionManager;

  private wss: WebSocketServer | null = null;
  private httpServer: HttpServerNode | null = null;
  private upgradeHandler:
    | ((request: IncomingMessage, socket: Duplex, head: Buffer) => void)
    | null = null;
  private active = false;

  public constructor(options: RealtimeGatewayOptions) {
    this.registry = options.registry;
    this.deviceRepository = options.deviceRepository;
    this.capabilitySubscriber = options.capabilitySubscriber;
    this.logger = options.logger;
    this.translate = options.translate;
    this.getLanguage = options.getLanguage;

    this.sessions = new RealtimeSessionManager({
      metrics: this.metrics,
      logger: this.logger,
      onSessionOpened: (session) => {
        this.registry.markRealtimeConnected(session.displayId, {
          connectionId: session.connectionId,
          connectedAt: session.connectedAt,
          remoteAddress: session.remoteAddress,
        });
      },
      onSessionClosed: (session) => {
        void this.handleSessionClosed(session);
      },
      onClientMessage: (session, message) => {
        if (message.type === 'heartbeat-ack') {
          this.registry.markRealtimeHeartbeat(session.displayId);
        }
      },
    });

    this.subscriptions = new RealtimeSubscriptionManager({
      subscriber: this.capabilitySubscriber,
      metrics: this.metrics,
      logger: this.logger,
      onCapabilityValue: (event) => {
        void this.handleCapabilityValue(event.deviceId, event.value);
      },
      onDeviceRemoved: (deviceId) => {
        void this.handleDeviceRemoved(deviceId);
      },
    });
  }

  public isActive(): boolean {
    return this.active && this.wss !== null;
  }

  public getMetrics() {
    return this.metrics.snapshot();
  }

  public listSessions() {
    return this.sessions.list();
  }

  public listSubscriptions() {
    return this.subscriptions.listDiagnostics();
  }

  public hasActiveSession(displayId: string): boolean {
    return this.sessions.hasActiveSession(displayId);
  }

  /**
   * Attach to the Node HTTP server (same port). Safe to call again after restart.
   */
  public attach(httpServer: HttpServerNode): void {
    this.detach();

    this.httpServer = httpServer;
    this.wss = new WebSocketServer({ noServer: true });
    this.active = true;

    this.upgradeHandler = (request, socket, head) => {
      void this.handleUpgrade(request, socket, head);
    };

    httpServer.on('upgrade', this.upgradeHandler);

    this.logger.info('WebSocket realtime gateway attached', {
      path: REALTIME_WEBSOCKET_PATH,
    });
  }

  public detach(): void {
    if (this.httpServer && this.upgradeHandler) {
      this.httpServer.off('upgrade', this.upgradeHandler);
    }

    this.sessions.closeAll(1001, 'server_restart');

    if (this.wss) {
      try {
        for (const client of this.wss.clients) {
          try {
            client.terminate();
          } catch {
            // ignore
          }
        }
        this.wss.close();
      } catch {
        // ignore
      }
    }

    this.wss = null;
    this.httpServer = null;
    this.upgradeHandler = null;
    this.active = false;
  }

  public async destroy(): Promise<void> {
    this.detach();
    await this.subscriptions.destroy();
    this.metrics.reset();
  }

  /**
   * Called after a dashboard configuration is saved.
   * Sequence: update subscriptions → resolve runtime → send complete config.
   * Offline displays receive nothing (no message queue); reconnect gets a full snapshot.
   */
  public async notifyDashboardConfigurationChanged(
    displayId: string,
  ): Promise<void> {
    const entry = this.registry.getById(displayId);
    if (!entry) {
      return;
    }

    const deviceIds = extractReferencedDeviceIds(entry.config.dashboard);

    if (this.sessions.hasActiveSession(displayId)) {
      await this.subscriptions.setDisplayDevices(displayId, deviceIds);
      this.registry.markRealtimeSubscribedDevices(displayId, deviceIds.length);

      const runtime = await resolveDashboardRuntime({
        widgets: entry.config.dashboard.widgets,
        repository: this.deviceRepository,
        logger: this.logger,
      });

      this.registry.markLightWidgetDiagnostics(displayId, runtime.diagnostics);

      this.sessions.sendToDisplay(displayId, {
        type: 'dashboard-configuration',
        configuration: entry.config.dashboard,
        widgetStates: runtime.states,
        theme: resolveDashboardTheme(entry.config.dashboard.theme),
      });
    }
  }

  public async notifyDisplayRemoved(displayId: string): Promise<void> {
    this.sessions.closeDisplay(displayId, 1001, 'display_removed');
    await this.subscriptions.removeDisplay(displayId);
    this.registry.markRealtimeDisconnected(displayId);
  }

  private async handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): Promise<void> {
    if (!this.wss) {
      socket.destroy();
      return;
    }

    const path = pathOnly(request.url ?? '/');
    if (path !== REALTIME_WEBSOCKET_PATH) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    const remoteAddress = normalizeClientIp(
      request.socket.remoteAddress ?? 'unknown',
    );
    const entry = this.registry.findByIp(remoteAddress);

    if (!entry) {
      this.metrics.recordRejectedConnection();
      this.logger.warn('Rejected WebSocket from unconfigured display', {
        remoteAddress,
      });
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    this.wss.handleUpgrade(request, socket, head, (ws) => {
      void this.acceptConnection(ws, entry.config.displayId, remoteAddress);
    });
  }

  private async acceptConnection(
    socket: WebSocket,
    displayId: string,
    remoteAddress: string,
  ): Promise<void> {
    const session = this.sessions.open({
      displayId,
      remoteAddress,
      socket,
    });

    try {
      await this.sendInitialSnapshot(session);
    } catch (error) {
      this.logger.error('Failed to send realtime snapshot', {
        displayId,
        connectionId: session.connectionId,
        error,
      });
      session.send({
        type: 'error',
        code: 'snapshot_failed',
        message: 'snapshot_failed',
      });
      session.close(1011, 'snapshot_failed');
    }
  }

  private async sendInitialSnapshot(
    session: DisplayRealtimeSession,
  ): Promise<void> {
    const snapshot = await this.buildSnapshot(session.displayId);
    if (!snapshot) {
      session.send({
        type: 'error',
        code: 'display_session_invalid',
        message: 'display_session_invalid',
      });
      session.close(1008, 'display_session_invalid');
      return;
    }

    const deviceIds = extractReferencedDeviceIds(snapshot.configuration);
    await this.subscriptions.setDisplayDevices(session.displayId, deviceIds);
    this.registry.markRealtimeSubscribedDevices(
      session.displayId,
      deviceIds.length,
    );

    const message: ServerMessage = {
      type: 'dashboard-snapshot',
      snapshot,
    };
    session.send(message);
  }

  private async buildSnapshot(
    displayId: string,
  ): Promise<DashboardSnapshotPayload | null> {
    const entry = this.registry.getById(displayId);
    if (!entry) {
      return null;
    }

    const layout = resolveLayoutId(entry.config.layoutId);
    if (!layout.ok) {
      return null;
    }

    const runtime = await resolveDashboardRuntime({
      widgets: entry.config.dashboard.widgets,
      repository: this.deviceRepository,
      logger: this.logger,
    });

    this.registry.markLightWidgetDiagnostics(displayId, runtime.diagnostics);

    const copy = createRealtimeDashboardCopy(this.translate);

    return {
      protocolVersion: REALTIME_PROTOCOL_VERSION,
      displayId: entry.config.displayId,
      displayName: entry.config.name,
      typeLabel: typeLabelForDisplay(entry.config.typeId, this.translate),
      layoutId: entry.config.layoutId,
      layout: layout.config,
      configuration: entry.config.dashboard,
      widgetStates: runtime.states,
      theme: resolveDashboardTheme(entry.config.dashboard.theme),
      locale: this.getLanguage(),
      emptyState: createEmptyStateCopy(this.translate),
      copy,
    };
  }

  private async handleSessionClosed(
    session: DisplayRealtimeSession,
  ): Promise<void> {
    await this.subscriptions.removeDisplay(session.displayId);
    this.registry.markRealtimeDisconnected(session.displayId);
  }

  private async handleCapabilityValue(
    deviceId: string,
    value: unknown,
  ): Promise<void> {
    const displayIds = this.subscriptions.getDisplayIdsForDevice(deviceId);
    if (displayIds.length === 0) {
      return;
    }

    let device = null;
    try {
      device = await this.deviceRepository.getDevice(deviceId);
    } catch (error) {
      this.logger.error('Failed to resolve Homey device after capability change', {
        deviceId,
        error,
      });
    }

    for (const displayId of displayIds) {
      const entry = this.registry.getById(displayId);
      if (!entry) {
        continue;
      }

      for (const widget of entry.config.dashboard.widgets) {
        if (widget.type !== 'light' || widget.config.deviceId !== deviceId) {
          continue;
        }

        try {
          const on = parseOnoff(value);
          const resolved = device
            ? resolveLightWidgetRuntimeFromSnapshot({
                widgetId: widget.id,
                deviceId,
                device: {
                  ...device,
                  capabilityValues: {
                    ...device.capabilityValues,
                    [LIGHT_CAPABILITY_ID]: on ?? value,
                  },
                },
              })
            : createLightApiErrorRuntime(widget.id, deviceId);

          this.sessions.sendToDisplay(displayId, {
            type: 'widget-state',
            widgetId: widget.id,
            state: resolved.state,
          });
        } catch (error) {
          this.logger.error('Failed to route widget state update', {
            displayId,
            widgetId: widget.id,
            deviceId,
            error,
          });
        }
      }
    }
  }

  private async handleDeviceRemoved(deviceId: string): Promise<void> {
    const displayIds = this.subscriptions.getDisplayIdsForDevice(deviceId);
    for (const displayId of displayIds) {
      const entry = this.registry.getById(displayId);
      if (!entry) {
        continue;
      }

      for (const widget of entry.config.dashboard.widgets) {
        if (widget.type !== 'light' || widget.config.deviceId !== deviceId) {
          continue;
        }

        const resolved = createLightApiErrorRuntime(widget.id, deviceId);
        this.sessions.sendToDisplay(displayId, {
          type: 'widget-state',
          widgetId: widget.id,
          state: resolved.state,
        });
      }
    }
  }
}

export function createRealtimeUiCopy(
  translate: (key: string) => string,
): RealtimeUiCopy {
  return {
    connectionLost: translate('pages.realtime.connectionLost'),
    reconnecting: translate('pages.realtime.reconnecting'),
    connectionRestored: translate('pages.realtime.connectionRestored'),
    realtimeUnavailable: translate('pages.realtime.realtimeUnavailable'),
    protocolError: translate('pages.realtime.protocolError'),
    displaySessionInvalid: translate('pages.realtime.displaySessionInvalid'),
    snapshotFailed: translate('pages.realtime.snapshotFailed'),
    homeyConnectionError: translate('pages.realtime.homeyConnectionError'),
  };
}

export function createRealtimeDashboardCopy(
  translate: (key: string) => string,
) {
  return createDashboardUiCopy(translate);
}

function typeLabelForDisplay(
  typeId: string,
  translate: (key: string) => string,
): string {
  if (typeId === DISPLAY_TYPE_IDS.SHELLY_WALL_DISPLAY) {
    return translate('adapters.shelly_wall_display');
  }
  if (typeId === DISPLAY_TYPE_IDS.GENERIC_WEB_DISPLAY) {
    return translate('adapters.generic_web_display');
  }
  return typeId;
}

function pathOnly(url: string): string {
  const noQuery = url.split('?', 1)[0] ?? '/';
  return noQuery === '' ? '/' : noQuery;
}

/** Adapter so HomeyDeviceRepository / HomeyWebApi can feed the subscription manager. */
export function capabilitySubscriberFrom(
  subscribe: HomeyCapabilitySubscriber['subscribeCapability'],
): HomeyCapabilitySubscriber {
  return { subscribeCapability: subscribe };
}

export type { HomeyCapabilitySubscription };
