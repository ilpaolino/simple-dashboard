/**
 * Thin Homey Flow layer for Display notifications.
 * Parses args and delegates to the app NotificationManager API.
 *
 * Device cards live in each driver's `driver.flow.compose.json` so Homey shows
 * them under the selected Wall Display. Homey requires unique Flow card IDs
 * across the app, so Shelly uses prefixed IDs with the same titles/handlers.
 *
 * Filtering notification actions uses trigger args + Flow state (event-safe),
 * not a fragile global "last action" Condition.
 *
 * @see https://apps.developer.homey.app/the-basics/flow
 * @see https://apps.developer.homey.app/the-basics/flow#device-cards
 * @see https://apps.developer.homey.app/the-basics/flow/arguments
 * @see https://apps.developer.homey.app/the-basics/flow/tokens
 */

import { getDisplayId } from '../device/DisplayAppHost';
import {
  normalizeAutoCloseSeconds,
  normalizeNotificationAction,
  type NotificationAction,
  type NotificationActionFlowTokens,
  type NotificationActionTriggerState,
} from '../notifications';
import { isNotificationIcon } from '../notifications/icons';
import { isNotificationSeverity } from '../notifications/severity';
import type { Logger } from '../types';

export interface NotificationFlowApp {
  upsertDisplayNotification(input: {
    readonly displayId: string;
    readonly notificationKey: string;
    readonly title?: string;
    readonly message: string;
    readonly severity: string;
    readonly icon?: string;
    readonly dismissable?: boolean;
    readonly highlight?: boolean;
    readonly autoOpen?: boolean;
    readonly autoCloseSeconds?: number;
    readonly action?: NotificationAction | null;
  }): {
    readonly ok: true;
    readonly created: boolean;
    readonly notificationId: string;
  };
  removeDisplayNotificationByKey(
    displayId: string,
    notificationKey: string,
  ): { readonly ok: true; readonly removed: boolean };
  removeAllDisplayNotifications(displayId: string): {
    readonly ok: true;
    readonly removedCount: number;
  };
  recordFlowNotificationError(): void;
  triggerNotificationActionPressed(input: {
    readonly displayId: string;
    readonly tokens: NotificationActionFlowTokens;
    readonly state: NotificationActionTriggerState;
  }): Promise<void>;
}

type HomeyDeviceLike = {
  getData(): unknown;
};

type FlowActionCard = {
  registerRunListener(
    listener: (args: Record<string, unknown>) => Promise<void>,
  ): FlowActionCard;
};

type FlowCardBase = {
  registerRunListener(
    listener: (
      args: Record<string, unknown>,
      state: NotificationActionTriggerState,
    ) => Promise<boolean>,
  ): FlowCardBase;
};

type FlowDeviceTriggerCard = FlowCardBase & {
  trigger(
    device: HomeyDeviceLike,
    tokens: NotificationActionFlowTokens,
    state: NotificationActionTriggerState,
  ): Promise<unknown>;
};

type HomeyFlowHost = {
  flow: {
    getActionCard(id: string): FlowActionCard;
    getDeviceTriggerCard(id: string): FlowDeviceTriggerCard;
  };
};

/** Generic Web Display card IDs (driver.flow.compose.json). */
const GENERIC_SHOW_SIMPLE_IDS = ['show_notification'] as const;
const GENERIC_SHOW_INTERACTIVE_IDS = [
  'show_interactive_notification',
] as const;
const GENERIC_REMOVE_IDS = ['remove_notification'] as const;
const GENERIC_REMOVE_ALL_IDS = ['remove_all_notifications'] as const;
const GENERIC_ACTION_TRIGGER_IDS = ['notification_action_pressed'] as const;

/** Shelly Wall Display card IDs (unique — Homey forbids duplicate action IDs). */
const SHELLY_SHOW_SIMPLE_IDS = ['shelly_show_notification'] as const;
const SHELLY_SHOW_INTERACTIVE_IDS = [
  'shelly_show_interactive_notification',
] as const;
const SHELLY_REMOVE_IDS = ['shelly_remove_notification'] as const;
const SHELLY_REMOVE_ALL_IDS = ['shelly_remove_all_notifications'] as const;
const SHELLY_ACTION_TRIGGER_IDS = [
  'shelly_notification_action_pressed',
] as const;

const ACTION_TRIGGER_IDS = [
  ...GENERIC_ACTION_TRIGGER_IDS,
  ...SHELLY_ACTION_TRIGGER_IDS,
] as const;

function resolveDisplayId(device: unknown): string | null {
  if (typeof device !== 'object' || device === null) {
    return null;
  }
  const candidate = device as HomeyDeviceLike;
  if (typeof candidate.getData !== 'function') {
    return null;
  }
  return getDisplayId(candidate.getData());
}

function mapManagerError(
  code: string,
  translate: (key: string) => string,
): string {
  switch (code) {
    case 'invalid_key':
      return translate('flow.notifications.errors.invalidKey');
    case 'message_required':
      return translate('flow.notifications.errors.messageRequired');
    case 'invalid_severity':
      return translate('flow.notifications.errors.invalidSeverity');
    case 'invalid_icon':
      return translate('flow.notifications.errors.invalidIcon');
    case 'display_limit':
      return translate('flow.notifications.errors.displayLimit');
    case 'invalid_action_id':
      return translate('flow.notifications.errors.invalidActionId');
    case 'invalid_action_label':
      return translate('flow.notifications.errors.invalidActionLabel');
    case 'invalid_action_text':
      return translate('flow.notifications.errors.invalidActionText');
    case 'invalid_auto_close':
      return translate('flow.notifications.errors.invalidAutoClose');
    default:
      return translate('flow.notifications.errors.managerFailed');
  }
}

function parseCommonShowArgs(
  args: Record<string, unknown>,
  translate: (key: string) => string,
):
  | {
      readonly ok: true;
      readonly displayId: string;
      readonly notificationKey: string;
      readonly title: string | undefined;
      readonly message: string;
      readonly severity: string;
      readonly icon: string | undefined;
      readonly dismissable: boolean;
      readonly highlight: boolean;
    }
  | { readonly ok: false; readonly message: string } {
  const displayId = resolveDisplayId(args.device);
  if (!displayId) {
    return {
      ok: false,
      message: translate('flow.notifications.errors.invalidDevice'),
    };
  }

  if (typeof args.notification_key !== 'string') {
    return {
      ok: false,
      message: translate('flow.notifications.errors.invalidKey'),
    };
  }

  if (typeof args.message !== 'string' || args.message.trim() === '') {
    return {
      ok: false,
      message: translate('flow.notifications.errors.messageRequired'),
    };
  }

  if (!isNotificationSeverity(args.severity)) {
    return {
      ok: false,
      message: translate('flow.notifications.errors.invalidSeverity'),
    };
  }

  let icon: string | undefined;
  if (args.icon !== undefined && args.icon !== null && args.icon !== '') {
    if (!isNotificationIcon(args.icon)) {
      return {
        ok: false,
        message: translate('flow.notifications.errors.invalidIcon'),
      };
    }
    icon = args.icon;
  }

  const title =
    typeof args.title === 'string' && args.title.trim() !== ''
      ? args.title
      : undefined;

  return {
    ok: true,
    displayId,
    notificationKey: args.notification_key,
    title,
    message: args.message,
    severity: args.severity,
    icon,
    dismissable: parseHomeyCheckbox(args.dismissable, true),
    highlight: parseHomeyCheckbox(args.highlight, false),
  };
}

function isHomeyCheckboxOn(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function parseHomeyCheckbox(value: unknown, defaultValue: boolean): boolean {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  return isHomeyCheckboxOn(value);
}

function flowArgFilled(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Interactive Show: attach an action when the checkbox is on OR the user
 * filled Action ID / button label / action text. Homey checkbox default is
 * false, so requiring the checkbox alone silently dropped CTAs.
 */
export function parseShowAction(
  args: Record<string, unknown>,
  translate: (key: string) => string,
):
  | {
      readonly ok: true;
      readonly action: NotificationAction | null;
    }
  | { readonly ok: false; readonly message: string } {
  const fieldsFilled =
    flowArgFilled(args.action_id) ||
    flowArgFilled(args.action_label) ||
    flowArgFilled(args.action_text);
  const wantsAction = isHomeyCheckboxOn(args.enable_action) || fieldsFilled;
  if (!wantsAction) {
    return { ok: true, action: null };
  }

  const normalized = normalizeNotificationAction({
    actionId: args.action_id,
    label: args.action_label,
    text: args.action_text,
  });
  if (!normalized.ok) {
    return { ok: false, message: mapManagerError(normalized.message, translate) };
  }
  return { ok: true, action: normalized.value };
}

export function registerNotificationFlowCards(options: {
  readonly homey: HomeyFlowHost;
  readonly app: NotificationFlowApp;
  readonly logger: Logger;
  readonly translate: (key: string) => string;
}): {
  readonly triggerCards: ReadonlyMap<string, FlowDeviceTriggerCard>;
} {
  const { homey, app, logger, translate } = options;
  const triggerCards = new Map<string, FlowDeviceTriggerCard>();

  /**
   * Light M11B card: auto-open always, no auto-close, no action.
   * Clears any previous interactive fields on the same key.
   */
  const showSimpleListener = async (
    args: Record<string, unknown>,
  ): Promise<void> => {
    const parsed = parseCommonShowArgs(args, translate);
    if (!parsed.ok) {
      app.recordFlowNotificationError();
      throw new Error(parsed.message);
    }

    try {
      const result = app.upsertDisplayNotification({
        displayId: parsed.displayId,
        notificationKey: parsed.notificationKey,
        title: parsed.title,
        message: parsed.message,
        severity: parsed.severity,
        icon: parsed.icon,
        dismissable: parsed.dismissable,
        highlight: parsed.highlight,
        autoOpen: true,
        autoCloseSeconds: 0,
        action: null,
      });

      logger.info('Flow show notification (simple)', {
        displayId: parsed.displayId,
        notificationKey: parsed.notificationKey,
        created: result.created,
        notificationId: result.notificationId,
        severity: parsed.severity,
      });
    } catch (error) {
      app.recordFlowNotificationError();
      if (error instanceof Error) {
        throw new Error(mapManagerError(error.message, translate));
      }
      throw new Error(translate('flow.notifications.errors.managerFailed'));
    }
  };

  /** Interactive M12 card: auto-open / auto-close / optional action. */
  const showInteractiveListener = async (
    args: Record<string, unknown>,
  ): Promise<void> => {
    const parsed = parseCommonShowArgs(args, translate);
    if (!parsed.ok) {
      app.recordFlowNotificationError();
      throw new Error(parsed.message);
    }

    const autoOpen = args.auto_open !== false;

    const autoCloseResult = normalizeAutoCloseSeconds(args.auto_close_seconds);
    if (!autoCloseResult.ok) {
      app.recordFlowNotificationError();
      throw new Error(mapManagerError(autoCloseResult.message, translate));
    }

    const actionParsed = parseShowAction(args, translate);
    if (!actionParsed.ok) {
      app.recordFlowNotificationError();
      throw new Error(actionParsed.message);
    }

    try {
      const result = app.upsertDisplayNotification({
        displayId: parsed.displayId,
        notificationKey: parsed.notificationKey,
        title: parsed.title,
        message: parsed.message,
        severity: parsed.severity,
        icon: parsed.icon,
        dismissable: parsed.dismissable,
        highlight: parsed.highlight,
        autoOpen,
        autoCloseSeconds: autoCloseResult.value ?? 0,
        action: actionParsed.action,
      });

      logger.info('Flow show interactive notification', {
        displayId: parsed.displayId,
        notificationKey: parsed.notificationKey,
        created: result.created,
        notificationId: result.notificationId,
        severity: parsed.severity,
        autoOpen,
        autoCloseSeconds: autoCloseResult.value ?? 0,
        hasAction: actionParsed.action !== null,
      });
    } catch (error) {
      app.recordFlowNotificationError();
      if (error instanceof Error) {
        throw new Error(mapManagerError(error.message, translate));
      }
      throw new Error(translate('flow.notifications.errors.managerFailed'));
    }
  };

  const removeListener = async (
    args: Record<string, unknown>,
  ): Promise<void> => {
    const displayId = resolveDisplayId(args.device);
    if (!displayId) {
      app.recordFlowNotificationError();
      throw new Error(translate('flow.notifications.errors.invalidDevice'));
    }

    if (typeof args.notification_key !== 'string') {
      app.recordFlowNotificationError();
      throw new Error(translate('flow.notifications.errors.invalidKey'));
    }

    try {
      const result = app.removeDisplayNotificationByKey(
        displayId,
        args.notification_key,
      );
      logger.info('Flow remove notification', {
        displayId,
        notificationKey: args.notification_key,
        removed: result.removed,
      });
    } catch (error) {
      app.recordFlowNotificationError();
      if (error instanceof Error) {
        throw new Error(mapManagerError(error.message, translate));
      }
      throw new Error(translate('flow.notifications.errors.managerFailed'));
    }
  };

  const removeAllListener = async (
    args: Record<string, unknown>,
  ): Promise<void> => {
    const displayId = resolveDisplayId(args.device);
    if (!displayId) {
      app.recordFlowNotificationError();
      throw new Error(translate('flow.notifications.errors.invalidDevice'));
    }

    try {
      const result = app.removeAllDisplayNotifications(displayId);
      logger.info('Flow remove all notifications', {
        displayId,
        removedCount: result.removedCount,
      });
    } catch {
      app.recordFlowNotificationError();
      throw new Error(translate('flow.notifications.errors.managerFailed'));
    }
  };

  const actionTriggerListener = async (
    args: Record<string, unknown>,
    state: NotificationActionTriggerState,
  ): Promise<boolean> => {
    if (
      args.action_id === undefined ||
      args.action_id === null ||
      args.action_id === ''
    ) {
      return true;
    }
    if (typeof args.action_id !== 'string') {
      return false;
    }
    return args.action_id.trim() === state.actionId;
  };

  for (const id of [...GENERIC_SHOW_SIMPLE_IDS, ...SHELLY_SHOW_SIMPLE_IDS]) {
    homey.flow.getActionCard(id).registerRunListener(showSimpleListener);
  }
  for (const id of [
    ...GENERIC_SHOW_INTERACTIVE_IDS,
    ...SHELLY_SHOW_INTERACTIVE_IDS,
  ]) {
    homey.flow.getActionCard(id).registerRunListener(showInteractiveListener);
  }
  for (const id of [...GENERIC_REMOVE_IDS, ...SHELLY_REMOVE_IDS]) {
    homey.flow.getActionCard(id).registerRunListener(removeListener);
  }
  for (const id of [...GENERIC_REMOVE_ALL_IDS, ...SHELLY_REMOVE_ALL_IDS]) {
    homey.flow.getActionCard(id).registerRunListener(removeAllListener);
  }
  for (const id of ACTION_TRIGGER_IDS) {
    const card = homey.flow.getDeviceTriggerCard(id);
    card.registerRunListener(actionTriggerListener);
    triggerCards.set(id, card);
  }

  return { triggerCards };
}

export function resolveNotificationActionTriggerCardId(
  driverId: string,
): (typeof ACTION_TRIGGER_IDS)[number] {
  if (driverId.includes('shelly')) {
    return 'shelly_notification_action_pressed';
  }
  return 'notification_action_pressed';
}

export { ACTION_TRIGGER_IDS };
