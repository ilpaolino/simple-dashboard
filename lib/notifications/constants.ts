/**
 * Notification system tuning. Runtime only — not Homey user settings.
 */

/** Soft cap of active (non-dismissed) notifications visible per Display. */
export const MAX_NOTIFICATIONS_PER_DISPLAY = 32;

/** Soft cap of Display targets on a single publish/update. */
export const MAX_NOTIFICATION_DISPLAY_TARGETS = 64;

/** Max title / message lengths (UTF-16 code units). */
export const NOTIFICATION_TITLE_MAX_LENGTH = 120;
export const NOTIFICATION_MESSAGE_MAX_LENGTH = 2000;

/** Carousel swipe: minimum horizontal delta (px) to commit. */
export const NOTIFICATION_SWIPE_MIN_DISTANCE_PX = 48;

/** Ignore swipe when vertical movement exceeds this (px). */
export const NOTIFICATION_SWIPE_MAX_VERTICAL_PX = 56;

/** Require horizontal dominance over vertical by this ratio. */
export const NOTIFICATION_SWIPE_HORIZONTAL_RATIO = 1.35;

/**
 * Auto-close upper bound (seconds). 0 disables.
 * 300s (5 min) keeps Wall Display auto-close useful without long orphan timers.
 */
export const NOTIFICATION_AUTO_CLOSE_MAX_SECONDS = 300;
