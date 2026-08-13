import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'assets', 'dashboard');

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

copyFileSync(
  path.join(root, 'frontend', 'dashboard.css'),
  path.join(outDir, 'dashboard.css'),
);

console.log('Frontend dashboard assets written to assets/dashboard/');
