/**
 * Controlled inline SVG icons for notifications. No arbitrary markup.
 */

import type { NotificationIcon } from '../../lib/notifications/types';

const ICON_PATHS: Readonly<Record<NotificationIcon, string>> = {
  info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
  warning:
    'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
  success:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.5 14.5-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4-7 7z',
  error:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm3.5 13.1-1.4 1.4L12 13.4l-2.1 2.1-1.4-1.4L10.6 12 8.5 9.9l1.4-1.4L12 10.6l2.1-2.1 1.4 1.4L13.4 12l2.1 2.1z',
  home: 'M12 3 4 9v12h6v-7h4v7h6V9l-8-6z',
  bell: 'M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6V11a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2z',
  door: 'M5 3v18h14V3H5zm8 10.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
  'washing-machine':
    'M4 2h16v20H4V2zm3 2h2v2H7V4zm4 0h6v2h-6V4zm1 6a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z',
};

export function createNotificationIconElement(
  icon: NotificationIcon,
): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('notification-icon');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICON_PATHS[icon]);
  path.setAttribute('fill', 'currentColor');
  svg.appendChild(path);
  return svg;
}
