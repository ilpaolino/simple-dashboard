/**
 * Shelly-only maintenance capability for manual hardware rediscovery.
 * Extends system capability `button`.
 * @see https://apps.developer.homey.app/the-basics/devices/capabilities
 */

export const REDISCOVER_HARDWARE_CAPABILITY_ID = 'button.rediscover_hardware';

type CapabilityDevice = {
  hasCapability(capabilityId: string): boolean;
  addCapability(capabilityId: string): Promise<void>;
};

export async function ensureRediscoverHardwareCapability(
  device: CapabilityDevice,
): Promise<void> {
  if (!device.hasCapability(REDISCOVER_HARDWARE_CAPABILITY_ID)) {
    await device.addCapability(REDISCOVER_HARDWARE_CAPABILITY_ID);
  }
}
