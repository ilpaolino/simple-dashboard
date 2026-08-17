import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const LOCALES_DIR = join(import.meta.dirname, '..', 'locales');
const REQUIRED_LOCALES = ['en', 'it', 'de', 'fr', 'da', 'es', 'pt'] as const;

function collectStringKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, nested]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof nested === 'string') {
      return [path];
    }
    return collectStringKeys(nested, path);
  });
}

describe('locale files', () => {
  it('includes all supported languages', () => {
    const files = readdirSync(LOCALES_DIR)
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.replace(/\.json$/, ''))
      .sort();

    assert.deepEqual(files, [...REQUIRED_LOCALES].sort());
  });

  it('keeps identical key sets across locales', () => {
    const reference = JSON.parse(readFileSync(join(LOCALES_DIR, 'en.json'), 'utf8'));
    const referenceKeys = new Set(collectStringKeys(reference));

    for (const locale of REQUIRED_LOCALES) {
      if (locale === 'en') {
        continue;
      }

      const parsed = JSON.parse(readFileSync(join(LOCALES_DIR, `${locale}.json`), 'utf8'));
      const keys = new Set(collectStringKeys(parsed));
      const missing = [...referenceKeys].filter((key) => !keys.has(key));
      const extra = [...keys].filter((key) => !referenceKeys.has(key));

      assert.deepEqual(
        missing,
        [],
        `${locale}.json is missing keys: ${missing.slice(0, 5).join(', ')}`,
      );
      assert.deepEqual(extra, [], `${locale}.json has extra keys: ${extra.slice(0, 5).join(', ')}`);
    }
  });
});
