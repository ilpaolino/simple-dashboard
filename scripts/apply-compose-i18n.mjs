#!/usr/bin/env node
/**
 * Merges scripts/compose-i18n-translations.json into Homey compose JSON files.
 * Also fills missing locale keys from locales/*.json when the English value matches.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const LANGS = ['en', 'it', 'de', 'fr', 'da', 'es', 'pt'];
const COMPOSE_FILES = [
  'drivers/generic_web_display/driver.flow.compose.json',
  'drivers/shelly_wall_display/driver.flow.compose.json',
  'drivers/generic_web_display/driver.settings.compose.json',
  'drivers/shelly_wall_display/driver.settings.compose.json',
  'drivers/generic_web_display/driver.compose.json',
  'drivers/shelly_wall_display/driver.compose.json',
  '.homeycompose/capabilities/notification_count.json',
  '.homeycompose/capabilities/highest_notification_severity.json',
];

function flattenLocale(obj, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(obj ?? {})) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenLocale(value, next, out);
    } else if (typeof value === 'string') {
      out[value] = next;
    }
  }
  return out;
}

function loadLocaleMap(lang) {
  const file = path.join(ROOT, 'locales', `${lang}.json`);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const flat = flattenLocale(json);
  const byEn = JSON.parse(fs.readFileSync(path.join(ROOT, 'locales/en.json'), 'utf8'));
  const enFlat = flattenLocale(byEn);
  const map = {};
  for (const [enValue, keyPath] of Object.entries(enFlat)) {
    const parts = keyPath.split('.');
    let node = json;
    for (const part of parts) {
      node = node?.[part];
    }
    if (typeof node === 'string') {
      map[enValue] = node;
    }
  }
  return map;
}

const translations = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'scripts/compose-i18n-translations.json'), 'utf8'),
);
const byEn = new Map(translations.strings.map((entry) => [entry.en, entry]));

const localeMaps = Object.fromEntries(
  LANGS.filter((lang) => lang !== 'en').map((lang) => [lang, loadLocaleMap(lang)]),
);

let updatedNodes = 0;
let missing = new Set();

function mergeLocalizedObject(node) {
  if (!node || typeof node !== 'object') {
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      mergeLocalizedObject(item);
    }
    return;
  }

  if (typeof node.en === 'string') {
    const entry = byEn.get(node.en);
    for (const lang of LANGS) {
      if (lang === 'en') {
        continue;
      }
      const translated = entry?.[lang] ?? localeMaps[lang]?.[node.en];
      if (translated) {
        if (node[lang] !== translated) {
          node[lang] = translated;
          updatedNodes += 1;
        }
      } else if (!node[lang]) {
        missing.add(node.en);
      }
    }
    return;
  }

  for (const value of Object.values(node)) {
    mergeLocalizedObject(value);
  }
}

for (const relativePath of COMPOSE_FILES) {
  const absolutePath = path.join(ROOT, relativePath);
  const json = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  mergeLocalizedObject(json);
  fs.writeFileSync(absolutePath, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`Updated ${relativePath}`);
}

const appPath = path.join(ROOT, '.homeycompose/app.json');
const app = JSON.parse(fs.readFileSync(appPath, 'utf8'));
app.name = { ...app.name, ...translations.app.name };
app.description = { ...app.description, ...translations.app.description };
app.tags = { ...app.tags, ...translations.app.tags };
fs.writeFileSync(appPath, `${JSON.stringify(app, null, 2)}\n`);
console.log('Updated .homeycompose/app.json');

if (missing.size > 0) {
  console.warn(`Warning: ${missing.size} strings still missing translations:`);
  for (const value of [...missing].sort()) {
    console.warn(`  - ${value.slice(0, 120)}${value.length > 120 ? '…' : ''}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Applied translations to ${updatedNodes} localized nodes`);
}
