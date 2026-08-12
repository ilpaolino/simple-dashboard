import type { RequestInfo } from './types';

/**
 * Renders the minimal Milestone 0 root HTML page.
 */
export function renderWelcomePage(info: RequestInfo): string {
  const safeClientIp = escapeHtml(info.clientIp);
  const safeUserAgent = escapeHtml(info.userAgent);
  const safeMethod = escapeHtml(info.method);
  const safeUrl = escapeHtml(info.url);
  const safeTimestamp = escapeHtml(info.timestamp);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Welcome Wall</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f7f8;
      --fg: #1f2a30;
      --accent: #1f4b5c;
      --muted: #5b6b73;
      --line: #d7e0e4;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at top left, #dce8ec 0%, transparent 45%),
        linear-gradient(160deg, #f7fafb 0%, var(--bg) 100%);
      color: var(--fg);
      display: grid;
      place-items: center;
      padding: 2rem;
    }
    main {
      width: min(40rem, 100%);
    }
    h1 {
      margin: 0 0 0.5rem;
      font-size: clamp(2rem, 5vw, 3rem);
      font-weight: 600;
      letter-spacing: -0.03em;
      color: var(--accent);
    }
    p {
      margin: 0 0 1.5rem;
      color: var(--muted);
    }
    dl {
      margin: 0;
      display: grid;
      grid-template-columns: 9rem 1fr;
      gap: 0.75rem 1rem;
      border-top: 1px solid var(--line);
      padding-top: 1rem;
    }
    dt {
      margin: 0;
      color: var(--muted);
      font-size: 0.9rem;
    }
    dd {
      margin: 0;
      font-family: "IBM Plex Mono", ui-monospace, monospace;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <main>
    <h1>Welcome Wall</h1>
    <p>Local HTTP proof of concept is reachable.</p>
    <dl>
      <dt>Client IP</dt>
      <dd>${safeClientIp}</dd>
      <dt>User Agent</dt>
      <dd>${safeUserAgent}</dd>
      <dt>Method</dt>
      <dd>${safeMethod}</dd>
      <dt>URL</dt>
      <dd>${safeUrl}</dd>
      <dt>Timestamp</dt>
      <dd>${safeTimestamp}</dd>
    </dl>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
