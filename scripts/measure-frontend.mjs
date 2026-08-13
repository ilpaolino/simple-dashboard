import { gzipSync } from 'node:zlib';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'assets', 'dashboard');

const cssPath = path.join(dir, 'dashboard.css');
const jsPath = path.join(dir, 'dashboard.js');

const sampleHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="color-scheme" content="light" />
  <title>Dashboard</title>
  <link rel="stylesheet" href="/dashboard.css" />
</head>
<body>
  <div id="dashboard-root"></div>
  <script id="dashboard-bootstrap" type="application/json">{"displayId":"measure","displayName":"Measure","typeLabel":"Generic","layoutId":"2x2","layout":{"rows":2,"columns":2},"widgets":[],"locale":"en","emptyState":{"heading":"No widgets","lead":"Configure","nameLabel":"Name","typeLabel":"Type","idLabel":"ID","layoutLabel":"Layout","gridLabel":"Grid"}}</script>
  <script src="/dashboard.js" defer></script>
</body>
</html>`;

function report(label, bytes, gzipped) {
  console.log(
    `${label.padEnd(12)} ${String(bytes).padStart(8)} B  gzip ${String(gzipped).padStart(8)} B`,
  );
}

const css = readFileSync(cssPath);
const js = readFileSync(jsPath);
const htmlBuf = Buffer.from(sampleHtml, 'utf8');

report('HTML', htmlBuf.length, gzipSync(htmlBuf).length);
report('CSS', css.length, gzipSync(css).length);
report('JS', js.length, gzipSync(js).length);

const total = htmlBuf.length + css.length + js.length;
const totalGz =
  gzipSync(htmlBuf).length + gzipSync(css).length + gzipSync(js).length;
report('TOTAL', total, totalGz);

console.log(
  `files: css=${statSync(cssPath).size} B js=${statSync(jsPath).size} B`,
);
