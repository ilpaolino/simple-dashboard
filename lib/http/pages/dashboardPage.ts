import { escapeHtml } from './html';
import type { DashboardBootstrap } from '../../dashboard/types';
import { resolveDashboardTheme } from '../../widgets/types';

/**
 * Embeds JSON in HTML without breaking </script> and without HTML-entity encoding
 * (which would break JSON.parse on the client).
 */
function embedJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function renderDashboardPage(input: {
  readonly lang: string;
  readonly title: string;
  readonly bootstrap: DashboardBootstrap;
}): string {
  const payload = embedJson(input.bootstrap);
  const theme = resolveDashboardTheme(input.bootstrap.theme);

  return `<!DOCTYPE html>
<html lang="${escapeHtml(input.lang)}" data-theme="${theme}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="color-scheme" content="${theme}" />
  <title>${escapeHtml(input.title)}</title>
  <link rel="stylesheet" href="/dashboard.css" />
</head>
<body>
  <div id="dashboard-root"></div>
  <script id="dashboard-bootstrap" type="application/json">${payload}</script>
  <script src="/dashboard.js" defer></script>
</body>
</html>`;
}

export function renderInvalidLayoutPage(input: {
  readonly lang: string;
  readonly translate: (key: string) => string;
}): string {
  const t = input.translate;
  return `<!DOCTYPE html>
<html lang="${escapeHtml(input.lang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(t('pages.invalidLayout.title'))}</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
      background: #f4f7f8;
      color: #1f2a30;
      padding: 2rem;
    }
    h1 { margin: 0 0 0.5rem; color: #8b2e2e; font-size: 1.6rem; }
    p { margin: 0; color: #5b6b73; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(t('pages.invalidLayout.heading'))}</h1>
    <p>${escapeHtml(t('pages.invalidLayout.lead'))}</p>
  </main>
</body>
</html>`;
}
