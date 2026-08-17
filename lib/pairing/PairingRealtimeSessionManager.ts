import type { WebSocket } from 'ws';
import type { Logger } from '../types';
import { parseGenericClientHello } from './GenericBrowserCapabilityStore';

export interface PairingSocketInfo {
  readonly ipAddress: string;
  readonly connectedAt: Date;
}

/**
 * Lightweight WebSocket holder for unpaired Generic browsers.
 * Accepts only generic-client-hello; receives pairing-completed notifications.
 */
export class PairingRealtimeSessionManager {
  private readonly socketsByIp = new Map<string, Set<WebSocket>>();
  private readonly logger: Logger | null;

  public constructor(logger: Logger | null = null) {
    this.logger = logger;
  }

  public register(ipAddress: string, socket: WebSocket): void {
    this.closeExistingForIp(ipAddress, socket);

    let set = this.socketsByIp.get(ipAddress);
    if (!set) {
      set = new Set();
      this.socketsByIp.set(ipAddress, set);
    }
    set.add(socket);

    socket.on('close', () => {
      this.remove(ipAddress, socket);
    });

    socket.on('error', () => {
      this.remove(ipAddress, socket);
    });
  }

  public handleMessage(ipAddress: string, _socket: WebSocket, raw: string): boolean {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return false;
    }

    const hello = parseGenericClientHello(parsed);
    if (!hello) {
      return false;
    }

    this.logger?.info('Generic browser capability hello', {
      ipAddress,
      touch: hello.capabilities.touch,
      fullscreen: hello.capabilities.fullscreen,
      audioPlayback: hello.capabilities.audioPlayback,
      viewport: hello.viewport,
    });

    return true;
  }

  public notifyPairingCompleted(ipAddress: string): void {
    this.broadcast(ipAddress, {
      type: 'pairing-completed',
    });
  }

  public notifyCodeExpired(ipAddress: string): void {
    this.broadcast(ipAddress, {
      type: 'pairing-code-expired',
    });
  }

  public activeCount(): number {
    let total = 0;
    for (const set of this.socketsByIp.values()) {
      total += set.size;
    }
    return total;
  }

  public clear(): void {
    for (const set of this.socketsByIp.values()) {
      for (const socket of set) {
        try {
          socket.close(1000, 'shutdown');
        } catch {
          // ignore
        }
      }
    }
    this.socketsByIp.clear();
  }

  private broadcast(ipAddress: string, message: { readonly type: string }): void {
    const set = this.socketsByIp.get(ipAddress);
    if (!set) {
      return;
    }

    const payload = JSON.stringify(message);
    for (const socket of set) {
      if (socket.readyState === socket.OPEN) {
        socket.send(payload);
      }
    }
  }

  private closeExistingForIp(ipAddress: string, keep: WebSocket): void {
    const set = this.socketsByIp.get(ipAddress);
    if (!set) {
      return;
    }

    for (const socket of set) {
      if (socket !== keep && socket.readyState === socket.OPEN) {
        try {
          socket.close(1000, 'replaced');
        } catch {
          // ignore
        }
      }
    }
  }

  private remove(ipAddress: string, socket: WebSocket): void {
    const set = this.socketsByIp.get(ipAddress);
    if (!set) {
      return;
    }
    set.delete(socket);
    if (set.size === 0) {
      this.socketsByIp.delete(ipAddress);
    }
  }
}
