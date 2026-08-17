/**
 * Official Shelly Gen2+ RPC method names used by this app.
 * @see https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Shelly
 */

export const SHELLY_RPC_METHODS = {
  LIST_METHODS: 'Shelly.ListMethods',
  REBOOT: 'Shelly.Reboot',
  GET_DEVICE_INFO: 'Shelly.GetDeviceInfo',
} as const;

export type ShellyRpcMethodName =
  (typeof SHELLY_RPC_METHODS)[keyof typeof SHELLY_RPC_METHODS];

/** Central RPC timeout for Shelly hardware calls (ms). */
export const SHELLY_RPC_TIMEOUT_MS = 5000;
