/**
 * Ensure Wall Display devices expose notification aggregate capabilities.
 * @see https://apps.developer.homey.app/the-basics/devices/capabilities
 */

export const NOTIFICATION_COUNT_CAPABILITY_ID = 'notification_count';
export const HIGHEST_NOTIFICATION_SEVERITY_CAPABILITY_ID =
  'highest_notification_severity';

export const NOTIFICATION_CAPABILITY_IDS = [
  NOTIFICATION_COUNT_CAPABILITY_ID,
  HIGHEST_NOTIFICATION_SEVERITY_CAPABILITY_ID,
] as const;

type CapabilityDevice = {
  hasCapability(capabilityId: string): boolean;
  addCapability(capabilityId: string): Promise<void>;
  setCapabilityValue(capabilityId: string, value: unknown): Promise<void>;
};

/**
 * Migrates existing paired devices that pre-date notification capabilities.
 * Safe to call on every init — only adds missing capabilities.
 */
export async function ensureNotificationCapabilities(
  device: CapabilityDevice,
): Promise<void> {
  for (const capabilityId of NOTIFICATION_CAPABILITY_IDS) {
    if (!device.hasCapability(capabilityId)) {
      await device.addCapability(capabilityId);
    }
  }
}

export async function setNotificationAggregateCapabilities(
  device: CapabilityDevice,
  values: {
    readonly count: number;
    readonly highestSeverity: string;
  },
): Promise<void> {
  if (device.hasCapability(NOTIFICATION_COUNT_CAPABILITY_ID)) {
    await device.setCapabilityValue(
      NOTIFICATION_COUNT_CAPABILITY_ID,
      values.count,
    );
  }
  if (device.hasCapability(HIGHEST_NOTIFICATION_SEVERITY_CAPABILITY_ID)) {
    await device.setCapabilityValue(
      HIGHEST_NOTIFICATION_SEVERITY_CAPABILITY_ID,
      values.highestSeverity,
    );
  }
}
