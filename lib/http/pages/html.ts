export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const TECHNICAL_PAGE_STYLES = `
:root {
  color-scheme: light;
  --bg: #f4f7f8;
  --fg: #1f2a30;
  --accent: #1f4b5c;
  --muted: #5b6b73;
  --line: #d7e0e4;
  --danger: #8b2e2e;
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
main { width: min(42rem, 100%); }
h1 {
  margin: 0 0 0.5rem;
  font-size: clamp(1.6rem, 4vw, 2.4rem);
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--accent);
}
h1.danger { color: var(--danger); }
p { margin: 0 0 1.5rem; color: var(--muted); }
dl {
  margin: 0;
  display: grid;
  grid-template-columns: 11rem 1fr;
  gap: 0.75rem 1rem;
  border-top: 1px solid var(--line);
  padding-top: 1rem;
}
dt { margin: 0; color: var(--muted); font-size: 0.9rem; }
dd {
  margin: 0;
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  word-break: break-word;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}
th, td {
  text-align: left;
  padding: 0.5rem 0.4rem;
  border-bottom: 1px solid var(--line);
  vertical-align: top;
}
th { color: var(--muted); font-weight: 500; }
ul { margin: 0; padding-left: 1.2rem; color: var(--muted); }
`.trim();

export function renderTechnicalDocument(options: {
  readonly lang: string;
  readonly title: string;
  readonly heading: string;
  readonly headingClass?: string;
  readonly lead: string;
  readonly rows: readonly { readonly label: string; readonly value: string }[];
}): string {
  const rowsHtml =
    options.rows.length === 0
      ? ''
      : options.rows
          .map(
            (row) =>
              `<dt>${escapeHtml(row.label)}</dt><dd>${escapeHtml(row.value)}</dd>`,
          )
          .join('\n      ');

  const headingClass = options.headingClass
    ? ` class="${escapeHtml(options.headingClass)}"`
    : '';

  const details =
    options.rows.length === 0
      ? ''
      : `<dl>
      ${rowsHtml}
    </dl>`;

  return `<!DOCTYPE html>
<html lang="${escapeHtml(options.lang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(options.title)}</title>
  <style>
${TECHNICAL_PAGE_STYLES}
  </style>
</head>
<body>
  <main>
    <h1${headingClass}>${escapeHtml(options.heading)}</h1>
    <p>${escapeHtml(options.lead)}</p>
    ${details}
  </main>
</body>
</html>`;
}
