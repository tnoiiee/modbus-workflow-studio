import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { APP_VERSION } from './version.js';

function readJson(relative: string): { version?: string } {
  return JSON.parse(readFileSync(new URL(relative, import.meta.url), 'utf8')) as { version?: string };
}

describe('release version label', () => {
  it('is the v1.3.0-dev.1 label rendered by the shell', () => {
    expect(APP_VERSION).toBe('1.3.0-dev.1');
  });

  it('matches every package manifest', () => {
    expect(readJson('../../package.json').version).toBe(APP_VERSION);
    expect(readJson('../package.json').version).toBe(APP_VERSION);
    expect(readJson('../../server/package.json').version).toBe(APP_VERSION);
  });

  it('matches the lockfile root and workspace entries', () => {
    const lock = JSON.parse(readFileSync(new URL('../../package-lock.json', import.meta.url), 'utf8')) as {
      version?: string;
      packages?: Record<string, { version?: string }>;
    };
    expect(lock.version).toBe(APP_VERSION);
    expect(lock.packages?.['']?.version).toBe(APP_VERSION);
    expect(lock.packages?.['client']?.version).toBe(APP_VERSION);
    expect(lock.packages?.['server']?.version).toBe(APP_VERSION);
  });
});
