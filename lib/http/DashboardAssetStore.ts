import fs from 'node:fs';
import path from 'node:path';
import type { HttpResponse } from '../types';

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
};

/**
 * Serves built vanilla dashboard assets from assets/dashboard.
 */
export class DashboardAssetStore {
  private readonly rootDir: string;

  public constructor(rootDir: string = defaultDashboardAssetsDir()) {
    this.rootDir = rootDir;
  }

  public tryGet(assetFileName: string): HttpResponse | null {
    if (!isSafeAssetName(assetFileName)) {
      return null;
    }

    const absolutePath = path.join(this.rootDir, assetFileName);
    if (!absolutePath.startsWith(this.rootDir)) {
      return null;
    }

    if (!fs.existsSync(absolutePath)) {
      return null;
    }

    const extension = path.extname(assetFileName);
    const contentType = CONTENT_TYPES[extension];
    if (!contentType) {
      return null;
    }

    return {
      statusCode: 200,
      contentType,
      body: fs.readFileSync(absolutePath, 'utf8'),
    };
  }
}

function defaultDashboardAssetsDir(): string {
  return path.join(__dirname, '..', '..', 'assets', 'dashboard');
}

function isSafeAssetName(name: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(name) && !name.includes('..');
}
