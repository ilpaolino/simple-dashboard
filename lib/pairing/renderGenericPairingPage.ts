import { escapeHtml } from '../http/pages/html';
import { REALTIME_WEBSOCKET_PATH } from '../realtime/constants';

export interface GenericPairingPageInput {
  readonly lang: string;
  readonly translate: (key: string) => string;
  readonly code: string;
  readonly clientIp: string;
  readonly expiresAt: string;
  readonly websocketPath?: string;
}

/**
 * Minimal standalone pairing page for unknown Generic browsers.
 * Includes a lightweight WebSocket client for pairing-completed notification only.
 */
export function renderGenericPairingPage(input: GenericPairingPageInput): string {
  const t = input.translate;
  const wsPath = input.websocketPath ?? REALTIME_WEBSOCKET_PATH;
  const expiresAtMs = Date.parse(input.expiresAt);

  return `<!DOCTYPE html>
<html lang="${escapeHtml(input.lang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(t('pages.genericPairing.title'))}</title>
  <style>
:root {
  color-scheme: dark;
  --bg: #0f1419;
  --fg: #eef2f4;
  --accent: #5eb8d4;
  --muted: #8a9aa6;
  --code-bg: #1a2330;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
  background: radial-gradient(circle at top, #1a2836 0%, var(--bg) 55%);
  color: var(--fg);
  display: grid;
  place-items: center;
  padding: 2rem 1.25rem;
}
main {
  width: min(28rem, 100%);
  text-align: center;
}
.brand {
  margin: 0 0 0.35rem;
  font-size: 0.95rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}
h1 {
  margin: 0 0 1rem;
  font-size: clamp(1.5rem, 4vw, 2rem);
  font-weight: 600;
}
.lead {
  margin: 0 0 2rem;
  color: var(--muted);
  line-height: 1.5;
}
.code {
  display: block;
  margin: 0 auto 1rem;
  padding: 1.25rem 1.5rem;
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: clamp(2.8rem, 12vw, 4.5rem);
  font-weight: 600;
  letter-spacing: 0.22em;
  color: var(--accent);
  background: var(--code-bg);
  border-radius: 1rem;
  border: 1px solid rgba(94, 184, 212, 0.25);
}
.hint, .expiry, .ip {
  margin: 0.75rem 0 0;
  color: var(--muted);
  font-size: 0.95rem;
  line-height: 1.45;
}
.instructions {
  margin: 2rem 0 0;
  padding: 1rem 1.1rem;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.04);
  text-align: left;
  color: var(--muted);
  font-size: 0.92rem;
  line-height: 1.55;
}
.instructions strong { color: var(--fg); font-weight: 600; }
  </style>
</head>
<body>
  <main>
    <p class="brand">${escapeHtml(t('pages.genericPairing.brand'))}</p>
    <h1>${escapeHtml(t('pages.genericPairing.heading'))}</h1>
    <p class="lead">${escapeHtml(t('pages.genericPairing.lead'))}</p>
    <div class="code" id="pairing-code" aria-label="${escapeHtml(t('pages.genericPairing.codeLabel'))}">${escapeHtml(input.code)}</div>
    <p class="expiry" id="expiry-note">${escapeHtml(t('pages.genericPairing.expiryNote'))}</p>
    <p class="ip">${escapeHtml(t('pages.genericPairing.ip'))}: ${escapeHtml(input.clientIp)}</p>
    <div class="instructions">
      <strong>${escapeHtml(t('pages.genericPairing.instructionsTitle'))}</strong><br />
      ${escapeHtml(t('pages.genericPairing.instructionsBody'))}
    </div>
  </main>
  <script>
(function () {
  var expiresAt = ${Number.isFinite(expiresAtMs) ? String(expiresAtMs) : '0'};
  var wsPath = ${JSON.stringify(wsPath)};

  function detectCapabilities() {
    var touch = false;
    try {
      touch = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
        ('ontouchstart' in window) ||
        (navigator.maxTouchPoints > 0);
    } catch (e) {}
    var fullscreen = false;
    try {
      fullscreen = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
    } catch (e) {}
    var audioPlayback = false;
    try {
      audioPlayback = typeof Audio !== 'undefined';
    } catch (e) {}
    return {
      touch: touch,
      fullscreen: fullscreen,
      audioPlayback: audioPlayback,
      canReloadPage: true
    };
  }

  function detectViewport() {
    return {
      width: window.innerWidth || 0,
      height: window.innerHeight || 0,
      devicePixelRatio: window.devicePixelRatio || 1
    };
  }

  function connectPairingSocket() {
    var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    var url = protocol + '//' + window.location.host + wsPath;
    var socket;
    try {
      socket = new WebSocket(url);
    } catch (e) {
      return;
    }

    socket.addEventListener('open', function () {
      socket.send(JSON.stringify({
        type: 'generic-client-hello',
        capabilities: detectCapabilities(),
        viewport: detectViewport()
      }));
    });

    socket.addEventListener('message', function (event) {
      try {
        var message = JSON.parse(String(event.data));
        if (message && message.type === 'pairing-completed') {
          window.location.reload();
        }
        if (message && message.type === 'pairing-code-expired') {
          window.location.reload();
        }
      } catch (e) {}
    });
  }

  function checkExpiry() {
    if (!expiresAt || Date.now() >= expiresAt) {
      window.location.reload();
    }
  }

  connectPairingSocket();
  setInterval(checkExpiry, 30000);
})();
  </script>
</body>
</html>`;
}

export function renderGenericPairingLimitPage(input: {
  readonly lang: string;
  readonly translate: (key: string) => string;
  readonly clientIp: string;
}): string {
  const t = input.translate;
  return `<!DOCTYPE html>
<html lang="${escapeHtml(input.lang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(t('pages.genericPairingLimit.title'))}</title>
  <style>
body {
  margin: 0;
  min-height: 100vh;
  font-family: "IBM Plex Sans", sans-serif;
  display: grid;
  place-items: center;
  padding: 2rem;
  background: #0f1419;
  color: #eef2f4;
}
main { max-width: 28rem; text-align: center; }
h1 { font-size: 1.5rem; margin: 0 0 1rem; }
p { color: #8a9aa6; line-height: 1.5; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(t('pages.genericPairingLimit.heading'))}</h1>
    <p>${escapeHtml(t('pages.genericPairingLimit.lead'))}</p>
    <p>${escapeHtml(t('pages.genericPairing.ip'))}: ${escapeHtml(input.clientIp)}</p>
  </main>
</body>
</html>`;
}
