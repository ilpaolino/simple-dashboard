import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'assets', 'dashboard');
const settingsOut = path.join(root, 'settings', 'editor.js');

mkdirSync(outDir, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(root, 'frontend', 'main.ts')],
  bundle: true,
  outfile: path.join(outDir, 'dashboard.js'),
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  logLevel: 'info',
});

await esbuild.build({
  entryPoints: [path.join(root, 'frontend', 'settings', 'editor.ts')],
  bundle: true,
  outfile: settingsOut,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  logLevel: 'info',
  globalName: 'DashboardSettingsEditor',
});

// Bundle CSS with @import inlining (tokens + widget styles).
const cssEntry = path.join(root, 'frontend', 'dashboard.css');
const cssResult = await esbuild.build({
  entryPoints: [cssEntry],
  bundle: true,
  write: false,
  loader: { '.css': 'css' },
  logLevel: 'info',
});

const cssOutput = cssResult.outputFiles?.[0];
if (!cssOutput) {
  throw new Error('CSS bundle produced no output');
}

writeFileSync(path.join(outDir, 'dashboard.css'), cssOutput.text);

console.log('Frontend dashboard assets written to assets/dashboard/');
console.log('Settings editor written to settings/editor.js');
