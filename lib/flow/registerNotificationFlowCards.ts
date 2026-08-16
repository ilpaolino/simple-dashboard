/**
 * Thin Homey Flow Action layer for Display notifications.
 * Parses args and delegates to the app NotificationManager API.
 *
 * Device cards live in each driver's `driver.flow.compose.json` so Homey shows
 * them under the selected Wall Display. Homey requires unique Flow card IDs
 * across the app, so Shelly uses prefixed IDs with the same titles/handlers.
 *
 * @see https://apps.developer.homey.app/the-basics/flow
 * @see https://apps.developer.homey.app/the-basics/flow#device-cards
 * @see https://apps.developer.homey.app/the-basics/flow/arguments
 */

import { getDisplayId } from '../device/DisplayAppHost';
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
}

type HomeyDeviceLike = {
  getData(): unknown;
};

type FlowActionCard = {
  registerRunListener(
    listener: (args: Record<string, unknown>) => Promise<void>,
  ): FlowActionCard;
};

type HomeyFlowHost = {
  flow: {
    getActionCard(id: string): FlowActionCard;
  };
};

/** Generic Web Display card IDs (driver.flow.compose.json). */
const GENERIC_SHOW_IDS = ['show_notification'] as const;
const GENERIC_REMOVE_IDS = ['remove_notification'] as const;
const GENERIC_REMOVE_ALL_IDS = ['remove_all_notifications'] as const;

/** Shelly Wall Display card IDs (unique — Homey forbids duplicate action IDs). */
const SHELLY_SHOW_IDS = ['shelly_show_notification'] as const;
const SHELLY_REMOVE_IDS = ['shelly_remove_notification'] as const;
const SHELLY_REMOVE_ALL_IDS = ['shelly_remove_all_notifications'] as const;

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
    default:
      return translate('flow.notifications.errors.managerFailed');
  }
}

export function registerNotificationFlowCards(options: {
  readonly homey: HomeyFlowHost;
  readonly app: NotificationFlowApp;
  readonly logger: Logger;
  readonly translate: (key: string) => string;
}): void {
  const { homey, app, logger, translate } = options;

  const showListener = async (args: Record<string, unknown>): Promise<void> => {
    const displayId = resolveDisplayId(args.device);
    if (!displayId) {
      app.recordFlowNotificationError();
      throw new Error(translate('flow.notifications.errors.invalidDevice'));
    }

    if (typeof args.notification_key !== 'string') {
      app.recordFlowNotificationError();
      throw new Error(translate('flow.notifications.errors.invalidKey'));
    }

    if (typeof args.message !== 'string' || args.message.trim() === '') {
      app.recordFlowNotificationError();
      throw new Error(translate('flow.notifications.errors.messageRequired'));
    }

    if (!isNotificationSeverity(args.severity)) {
      app.recordFlowNotificationError();
      throw new Error(translate('flow.notifications.errors.invalidSeverity'));
    }

    let icon: string | undefined;
    if (args.icon !== undefined && args.icon !== null && args.icon !== '') {
      if (!isNotificationIcon(args.icon)) {
        app.recordFlowNotificationError();
        throw new Error(translate('flow.notifications.errors.invalidIcon'));
      }
      icon = args.icon;
    }

    const title =
      typeof args.title === 'string' && args.title.trim() !== ''
        ? args.title
        : undefined;

    try {
      const result = app.upsertDisplayNotification({
        displayId,
        notificationKey: args.notification_key,
        title,
        message: args.message,
        severity: args.severity,
        icon,
        dismissable: args.dismissable !== false,
        highlight: args.highlight === true,
      });

      logger.info('Flow show notification', {
        displayId,
        notificationKey: args.notification_key,
        created: result.created,
        notificationId: result.notificationId,
        severity: args.severity,
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

  for (const id of [...GENERIC_SHOW_IDS, ...SHELLY_SHOW_IDS]) {
    homey.flow.getActionCard(id).registerRunListener(showListener);
  }
  for (const id of [...GENERIC_REMOVE_IDS, ...SHELLY_REMOVE_IDS]) {
    homey.flow.getActionCard(id).registerRunListener(removeListener);
  }
  for (const id of [...GENERIC_REMOVE_ALL_IDS, ...SHELLY_REMOVE_ALL_IDS]) {
    homey.flow.getActionCard(id).registerRunListener(removeAllListener);
  }
}
