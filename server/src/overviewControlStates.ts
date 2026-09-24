import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

/** PATCH body for independent Control-state records — boolean only. */
export const overviewControlValueSchema = z.object({
  value: z.boolean()
}).strict();

export type OverviewControlValueInput = z.infer<typeof overviewControlValueSchema>;

/**
 * Minimal persisted Control-state record.
 * Independent of Overview Page configuration, geometry, style, revision, and Draft.
 */
export interface OverviewControlStateRecord {
  pageId: string;
  elementId: string;
  value: boolean;
  /** Server-generated ISO timestamp. */
  updatedAt: string;
}

type StoreFile = {
  version: 1;
  records: OverviewControlStateRecord[];
};

/**
 * Dedicated Overview Control-state store.
 *
 * Key: pageId + elementId. Atomic JSON persistence using the project
 * `.tmp` + rename pattern. Never mutates Overview Page JSON or page.revision.
 */
export class OverviewControlStateStore {
  private readonly file: string;
  private readonly records = new Map<string, OverviewControlStateRecord>();

  constructor(dataDir: string) {
    this.file = path.join(dataDir, 'overview-control-states.json');
    this.load();
  }

  private key(pageId: string, elementId: string): string {
    return `${pageId}:${elementId}`;
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.file)) return;
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8')) as StoreFile;
      for (const record of raw.records ?? []) {
        if (!record?.pageId || !record?.elementId) continue;
        if (typeof record.value !== 'boolean') continue;
        this.records.set(this.key(record.pageId, record.elementId), {
          pageId: record.pageId,
          elementId: record.elementId,
          value: record.value,
          updatedAt: record.updatedAt
        });
      }
    } catch (error) {
      throw new Error('Unable to load Overview control states', { cause: error });
    }
  }

  private persist(): void {
    const payload: StoreFile = {
      version: 1,
      records: [...this.records.values()]
    };
    const temporary = `${this.file}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(payload, null, 2));
    fs.renameSync(temporary, this.file);
  }

  /** Independent records for one page (no legacy merge). */
  listForPage(pageId: string): OverviewControlStateRecord[] {
    return [...this.records.values()].filter(record => record.pageId === pageId);
  }

  get(pageId: string, elementId: string): OverviewControlStateRecord | undefined {
    return this.records.get(this.key(pageId, elementId));
  }

  /**
   * Upsert one independent record. Last-write-wins.
   * Does not touch Overview Page configuration or revision.
   */
  set(pageId: string, elementId: string, value: boolean): OverviewControlStateRecord {
    const record: OverviewControlStateRecord = {
      pageId,
      elementId,
      value,
      updatedAt: new Date().toISOString()
    };
    const key = this.key(pageId, elementId);
    const previous = this.records.get(key);
    this.records.set(key, record);
    try { this.persist(); } catch (error) {
      if (previous) this.records.set(key, previous);
      else this.records.delete(key);
      throw error;
    }
    return { ...record };
  }

  /** Drop every record for a deleted Overview Page. */
  clearPage(pageId: string): boolean {
    let removed = false;
    for (const [key, record] of this.records) {
      if (record.pageId === pageId) {
        this.records.delete(key);
        removed = true;
      }
    }
    if (removed) this.persist();
    return removed;
  }
}
