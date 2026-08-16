/**
 * Shared decorative icon helper for Homey device widgets.
 * Icons are purely visual — they never represent runtime state.
 *
 * Official Homey Device.icon / iconObj exist in the Web API, but there is no
 * documented auth-free URL usable from this app’s LAN dashboard HTTP server.
 * Milestone 8 therefore uses lightweight inline SVG fallbacks only.
 */
export function createDeviceWidgetIcon(options: {
  readonly kind: 'light' | 'cover';
  readonly className?: string;
}): HTMLElement {
  const wrapper = document.createElement('span');
  wrapper.className = [
    'device-widget__icon',
    options.className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.innerHTML =
    options.kind === 'light' ? LIGHT_BULB_SVG : COVER_SHUTTER_SVG;
  return wrapper;
}

const LIGHT_BULB_SVG = `<svg viewBox="0 0 24 24" focusable="false" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M12 2a7 7 0 0 0-4 12.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26A7 7 0 0 0 12 2zm-2 17h4v1a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1z"/></svg>`;

const COVER_SHUTTER_SVG = `<svg viewBox="0 0 24 24" focusable="false" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M4 4h16v2H4V4zm0 3h16v2H4V7zm0 3h16v2H4v-2zm0 3h16v2H4v-2zm0 3h16v2H4v-2zm0 3h16v2H4v-2z"/></svg>`;
