import { randomInt } from 'node:crypto';
import type { Logger } from '../types';
import {
  GENERIC_PAIRING_CLEANUP_INTERVAL_MS,
  GENERIC_PAIRING_CODE_LENGTH,
  GENERIC_PAIRING_EXPIRY_MS,
  MAX_PENDING_GENERIC_PAIRINGS,
} from './constants';
import type {
  GenericDisplayPairingSession,
  GenericPairingDiagnosticsSnapshot,
  GenericPairingValidationResult,
} from './types';

export interface GenericDisplayPairingManagerOptions {
  readonly logger?: Logger;
  readonly now?: () => Date;
  readonly randomCode?: () => string;
  readonly expiryMs?: number;
  readonly maxPending?: number;
  readonly enableCleanupTimer?: boolean;
}

interface MutableSession {
  code: string;
  ipAddress: string;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Central runtime manager for temporary Generic Web Display pairing codes.
 * One active code per client IP; codes are consumed after successful pairing.
 */
export class GenericDisplayPairingManager {
  private readonly byCode = new Map<string, MutableSession>();
  private readonly byIp = new Map<string, MutableSession>();
  private readonly now: () => Date;
  private readonly randomCode: () => string;
  private readonly expiryMs: number;
  private readonly maxPending: number;
  private readonly logger: Logger | null;
  private readonly onSessionConsumed: ((ipAddress: string) => void) | null;

  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private expiredCleanedCount = 0;
  private successfulPairings = 0;
  private rejectedCodes = 0;
  private maxPendingReachedCount = 0;
  private codesReused = 0;
  private sessionsCreated = 0;

  public constructor(
    options: GenericDisplayPairingManagerOptions = {},
    onSessionConsumed: ((ipAddress: string) => void) | null = null,
  ) {
    this.logger = options.logger ?? null;
    this.now = options.now ?? (() => new Date());
    this.randomCode = options.randomCode ?? (() => generateNumericCode());
    this.expiryMs = options.expiryMs ?? GENERIC_PAIRING_EXPIRY_MS;
    this.maxPending = options.maxPending ?? MAX_PENDING_GENERIC_PAIRINGS;
    this.onSessionConsumed = onSessionConsumed;

    if (options.enableCleanupTimer !== false) {
      this.cleanupTimer = setInterval(() => {
        this.cleanupExpired(this.now());
      }, GENERIC_PAIRING_CLEANUP_INTERVAL_MS);
      this.cleanupTimer.unref?.();
    }
  }

  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.byCode.clear();
    this.byIp.clear();
  }

  /**
   * Returns an active session for the IP, reusing the code when still valid.
   * Creates a new session when none exists or the previous one expired.
   */
  public getOrCreateForIp(ipAddress: string): GenericDisplayPairingSession | null {
    const at = this.now();
    this.cleanupExpired(at);

    const existing = this.byIp.get(ipAddress);
    if (existing && existing.expiresAt.getTime() > at.getTime()) {
      this.codesReused += 1;
      this.logger?.info('Generic pairing code reused for IP', {
        ipAddress,
        code: maskCode(existing.code),
      });
      return freezeSession(existing);
    }

    if (existing) {
      this.removeSession(existing);
    }

    if (this.byCode.size >= this.maxPending) {
      this.maxPendingReachedCount += 1;
      this.logger?.warn('Max pending generic pairing sessions reached', {
        maxPending: this.maxPending,
        ipAddress,
      });
      return null;
    }

    const session = this.createSession(ipAddress, at);
    this.sessionsCreated += 1;
    this.logger?.info('Generic pairing session created', {
      ipAddress,
      code: maskCode(session.code),
      expiresAt: session.expiresAt.toISOString(),
    });
    return freezeSession(session);
  }

  public lookupByCode(code: string): GenericDisplayPairingSession | null {
    const normalized = normalizeCode(code);
    if (!normalized) {
      return null;
    }

    const at = this.now();
    this.cleanupExpired(at);

    const session = this.byCode.get(normalized);
    if (!session) {
      return null;
    }

    if (session.expiresAt.getTime() <= at.getTime()) {
      this.removeSession(session);
      return null;
    }

    return freezeSession(session);
  }

  public validateCode(code: string): GenericPairingValidationResult {
    const normalized = normalizeCode(code);
    if (!normalized) {
      this.rejectedCodes += 1;
      this.logger?.info('Generic pairing code rejected (invalid format)', {
        code: maskCode(String(code)),
      });
      return { ok: false, reason: 'invalid' };
    }

    const at = this.now();
    const session = this.byCode.get(normalized);
    if (!session) {
      this.cleanupExpired(at);
      this.rejectedCodes += 1;
      this.logger?.info('Generic pairing code rejected (unknown)', {
        code: maskCode(normalized),
      });
      return { ok: false, reason: 'invalid' };
    }

    if (session.expiresAt.getTime() <= at.getTime()) {
      this.removeSession(session);
      this.cleanupExpired(at);
      this.rejectedCodes += 1;
      this.logger?.info('Generic pairing code rejected (expired)', {
        code: maskCode(normalized),
        ipAddress: session.ipAddress,
      });
      return { ok: false, reason: 'expired' };
    }

    this.cleanupExpired(at);
    return {
      ok: true,
      ipAddress: session.ipAddress,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * Removes the session after successful Homey pairing. The code cannot be reused.
   */
  public consume(code: string): boolean {
    const normalized = normalizeCode(code);
    if (!normalized) {
      return false;
    }

    const session = this.byCode.get(normalized);
    if (!session) {
      return false;
    }

    if (session.expiresAt.getTime() <= this.now().getTime()) {
      this.removeSession(session);
      this.rejectedCodes += 1;
      return false;
    }

    const ipAddress = session.ipAddress;
    this.removeSession(session);
    this.successfulPairings += 1;
    this.logger?.info('Generic pairing session consumed', {
      ipAddress,
      code: maskCode(normalized),
    });
    this.onSessionConsumed?.(ipAddress);
    return true;
  }

  public listPending(): readonly GenericDisplayPairingSession[] {
    const at = this.now();
    this.cleanupExpired(at);
    return [...this.byCode.values()].map((session) => freezeSession(session));
  }

  public pendingCount(): number {
    return this.byCode.size;
  }

  public diagnosticsSnapshot(): GenericPairingDiagnosticsSnapshot {
    const pending = this.listPending();
    return {
      pendingCount: pending.length,
      activeCodes: pending.map((session) => ({
        codeMasked: maskCode(session.code),
        ipAddress: session.ipAddress,
        expiresAt: session.expiresAt.toISOString(),
      })),
      expiredCleanedCount: this.expiredCleanedCount,
      successfulPairings: this.successfulPairings,
      rejectedCodes: this.rejectedCodes,
      maxPendingReachedCount: this.maxPendingReachedCount,
      codesReused: this.codesReused,
      sessionsCreated: this.sessionsCreated,
    };
  }

  private createSession(ipAddress: string, at: Date): MutableSession {
    let code = this.randomCode();
    let attempts = 0;
    while (this.byCode.has(code)) {
      attempts += 1;
      if (attempts > 32) {
        code = generateNumericCode();
        if (!this.byCode.has(code)) {
          break;
        }
        continue;
      }
      code = this.randomCode();
    }

    const session: MutableSession = {
      code,
      ipAddress,
      createdAt: at,
      expiresAt: new Date(at.getTime() + this.expiryMs),
    };

    this.byCode.set(session.code, session);
    this.byIp.set(ipAddress, session);
    return session;
  }

  private cleanupExpired(at: Date): number {
    let removed = 0;
    for (const session of [...this.byCode.values()]) {
      if (session.expiresAt.getTime() <= at.getTime()) {
        this.removeSession(session);
        removed += 1;
        this.logger?.info('Generic pairing session expired', {
          ipAddress: session.ipAddress,
          code: maskCode(session.code),
        });
      }
    }
    this.expiredCleanedCount += removed;
    return removed;
  }

  private removeSession(session: MutableSession): void {
    this.byCode.delete(session.code);
    const mapped = this.byIp.get(session.ipAddress);
    if (mapped === session) {
      this.byIp.delete(session.ipAddress);
    }
  }
}

function freezeSession(session: MutableSession): GenericDisplayPairingSession {
  return {
    code: session.code,
    ipAddress: session.ipAddress,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  };
}

function generateNumericCode(): string {
  const value = randomInt(10 ** (GENERIC_PAIRING_CODE_LENGTH - 1), 10 ** GENERIC_PAIRING_CODE_LENGTH);
  return String(value);
}

export function normalizePairingCode(raw: unknown): string | null {
  return normalizeCode(raw);
}

function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  if (!/^\d{6}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/** Mask all but the last two digits for diagnostics. */
export function maskCode(code: string): string {
  if (code.length <= 2) {
    return '****';
  }
  return '*'.repeat(code.length - 2) + code.slice(-2);
}
