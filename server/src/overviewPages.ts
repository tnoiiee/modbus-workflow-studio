import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

/** Minimal element shape persisted from O1-B onward; full fields arrive in O1-C. */
export interface OverviewElementStub {
  id: string;
  type: string;
  [key: string]: unknown;
}

/** Persisted canvas viewport (x/y flow offset + zoom). */
export interface OverviewSavedViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface OverviewControlState {
  value: boolean;
  updatedAt: string;
}

export interface OverviewPageDefinition {
  id: string;
  name: string;
  description: string;
  designWidth: number;
  designHeight: number;
  backgroundColor: string;
  /** Placeholder for future background image payload. */
  backgroundImage: string | null;
  elements: OverviewElementStub[];
  /** Element ids in z-order (bottom → top). */
  layerOrder: string[];
  /** Saved canvas viewport — default {0,0,1} when missing on legacy pages. */
  savedViewport: OverviewSavedViewport;
  revision: number;
  createdAt: string;
  modifiedAt: string;
}

export interface OverviewPageSummary {
  id: string;
  name: string;
  description: string;
  designWidth: number;
  designHeight: number;
  backgroundColor: string;
  revision: number;
  elementCount: number;
  createdAt: string;
  modifiedAt: string;
}

export const OVERVIEW_DEFAULT_WIDTH = 1920;
export const OVERVIEW_DEFAULT_HEIGHT = 1080;
export const OVERVIEW_DEFAULT_BACKGROUND = '#050b12';
export const OVERVIEW_DEFAULT_VIEWPORT: OverviewSavedViewport = { x: 0, y: 0, zoom: 1 };
/** Matches Overview Canvas edit-mode zoom range. */
export const OVERVIEW_MIN_ZOOM = 0.1;
export const OVERVIEW_MAX_ZOOM = 2.5;

const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;

const savedViewportSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  zoom: z.number().finite().min(OVERVIEW_MIN_ZOOM).max(OVERVIEW_MAX_ZOOM)
});

export const OVERVIEW_CONTROL_TYPES = new Set(['SWITCH', 'PUSH_BUTTON', 'NAVIGATION_LINK']);

export const overviewCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500).optional(),
  designWidth: z.number().int().min(1).max(16384).optional(),
  designHeight: z.number().int().min(1).max(16384).optional(),
  backgroundColor: z.string().regex(HEX_COLOR).optional(),
  savedViewport: savedViewportSchema.optional()
});

export const overviewRenameSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500).optional()
});

export const overviewUpdateSchema = z.object({
  expectedRevision: z.number().int().min(1),
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  designWidth: z.number().int().min(1).max(16384).optional(),
  designHeight: z.number().int().min(1).max(16384).optional(),
  backgroundColor: z.string().regex(HEX_COLOR).optional(),
  elements: z
    .array(z.object({ id: z.string().min(1), type: z.string().min(1) }).passthrough())
    .optional(),
  layerOrder: z.array(z.string().min(1)).optional(),
  savedViewport: savedViewportSchema.optional()
});

export type OverviewCreateInput = z.infer<typeof overviewCreateSchema>;
export type OverviewRenameInput = z.infer<typeof overviewRenameSchema>;
export type OverviewUpdateInput = z.infer<typeof overviewUpdateSchema>;

function normalizeSavedViewport(value: OverviewSavedViewport | undefined): OverviewSavedViewport {
  if (!value) return { ...OVERVIEW_DEFAULT_VIEWPORT };
  return { x: value.x, y: value.y, zoom: value.zoom };
}

function fail(message: string, code: string): never {
  throw Object.assign(new Error(message), { code });
}

/**
 * Overview page store: file-per-page plus a small index, using the same
 * atomic write pattern as WorkflowManager (`.tmp` + rename). Fully separate
 * from Workflow nodes/edges/revision, runtime values, and Modbus config.
 */
export class OverviewPageManager {
  private readonly directory: string;
  private readonly indexFile: string;
  private readonly pages = new Map<string, OverviewPageDefinition>();

  constructor(dataDir: string) {
    this.directory = path.join(dataDir, 'overview-pages');
    this.indexFile = path.join(dataDir, 'overview-pages.json');
    fs.mkdirSync(this.directory, { recursive: true });
    this.load();
  }

  list(): OverviewPageSummary[] {
    return [...this.pages.values()]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(page => ({
        id: page.id,
        name: page.name,
        description: page.description,
        designWidth: page.designWidth,
        designHeight: page.designHeight,
        backgroundColor: page.backgroundColor,
        revision: page.revision,
        elementCount: page.elements.length,
        createdAt: page.createdAt,
        modifiedAt: page.modifiedAt
      }));
  }

  get(id: string): OverviewPageDefinition | undefined {
    const page = this.pages.get(id);
    if (!page) return undefined;
    const clone = structuredClone(page);
    // Legacy pages without savedViewport read as Default — no file rewrite.
    clone.savedViewport = normalizeSavedViewport(clone.savedViewport);
    return clone;
  }

  first(): OverviewPageDefinition {
    const page = this.pages.values().next().value as OverviewPageDefinition | undefined;
    if (!page) fail('Project must contain at least one Overview page', 'NO_PAGES');
    const clone = structuredClone(page);
    clone.savedViewport = normalizeSavedViewport(clone.savedViewport);
    return clone;
  }

  create(input: OverviewCreateInput): OverviewPageDefinition {
    const name = this.cleanName(input.name);
    this.assertUniqueName(name);
    const now = new Date().toISOString();
    const page: OverviewPageDefinition = {
      id: randomUUID(),
      name,
      description: (input.description ?? '').trim(),
      designWidth: input.designWidth ?? OVERVIEW_DEFAULT_WIDTH,
      designHeight: input.designHeight ?? OVERVIEW_DEFAULT_HEIGHT,
      backgroundColor: input.backgroundColor ?? OVERVIEW_DEFAULT_BACKGROUND,
      backgroundImage: null,
      elements: [],
      layerOrder: [],
      savedViewport: normalizeSavedViewport(input.savedViewport),
      revision: 1,
      createdAt: now,
      modifiedAt: now
    };
    this.pages.set(page.id, page);
    this.persist(page);
    return structuredClone(page);
  }

  update(id: string, incoming: OverviewUpdateInput): OverviewPageDefinition {
    const current = this.require(id);
    if (incoming.expectedRevision !== current.revision) {
      fail('Overview page revision conflict', 'REVISION_CONFLICT');
    }
    const name = incoming.name === undefined ? current.name : this.cleanName(incoming.name);
    if (name.toLowerCase() !== current.name.toLowerCase()) this.assertUniqueName(name, id);
    const now = new Date().toISOString();
    const updated: OverviewPageDefinition = {
      ...current,
      name,
      description: incoming.description === undefined ? current.description : incoming.description.trim(),
      designWidth: incoming.designWidth ?? current.designWidth,
      designHeight: incoming.designHeight ?? current.designHeight,
      backgroundColor: incoming.backgroundColor ?? current.backgroundColor,
      elements: incoming.elements ? (structuredClone(incoming.elements) as OverviewElementStub[]) : current.elements,
      layerOrder: incoming.layerOrder ? [...incoming.layerOrder] : current.layerOrder,
      savedViewport: incoming.savedViewport
        ? normalizeSavedViewport(incoming.savedViewport)
        : normalizeSavedViewport(current.savedViewport),
      revision: current.revision + 1,
      modifiedAt: now
    };
    this.pages.set(id, updated);
    this.persist(updated);
    return structuredClone(updated);
  }

  rename(id: string, input: OverviewRenameInput): OverviewPageDefinition {
    const current = this.require(id);
    const name = this.cleanName(input.name);
    if (name.toLowerCase() !== current.name.toLowerCase()) this.assertUniqueName(name, id);
    const now = new Date().toISOString();
    const updated: OverviewPageDefinition = {
      ...current,
      name,
      description: input.description === undefined ? current.description : input.description.trim(),
      revision: current.revision + 1,
      modifiedAt: now
    };
    this.pages.set(id, updated);
    this.persist(updated);
    return structuredClone(updated);
  }

  duplicate(id: string, requestedName?: string): OverviewPageDefinition {
    const source = this.require(id);
    const elementMap = new Map(source.elements.map(element => [element.id, randomUUID()]));
    const now = new Date().toISOString();
    const baseName = requestedName?.trim() || `${source.name} Copy`;
    const copy: OverviewPageDefinition = {
      ...structuredClone(source),
      id: randomUUID(),
      name: this.uniqueName(baseName),
      elements: source.elements.map(element => ({
        ...structuredClone(element),
        id: elementMap.get(element.id)!
      })),
      layerOrder: source.layerOrder.map(elementId => elementMap.get(elementId) ?? elementId),
      savedViewport: normalizeSavedViewport(source.savedViewport),
      revision: 1,
      createdAt: now,
      modifiedAt: now
    };
    this.pages.set(copy.id, copy);
    this.persist(copy);
    return structuredClone(copy);
  }

  delete(id: string): void {
    this.require(id);
    if (this.pages.size <= 1) fail('The last Overview page cannot be deleted', 'LAST_PAGE');
    this.pages.delete(id);
    const file = this.fileFor(id);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    this.persistIndex();
  }

  private load(): void {
    try {
      const index = JSON.parse(fs.readFileSync(this.indexFile, 'utf8')) as Array<{ id: string }>;
      for (const item of index) {
        if (!/^[0-9a-f-]{36}$/i.test(item.id)) continue;
        const file = this.fileFor(item.id);
        if (!fs.existsSync(file)) continue;
        const page = JSON.parse(fs.readFileSync(file, 'utf8')) as OverviewPageDefinition;
        // Normalize on load so missing savedViewport becomes Default in memory.
        page.savedViewport = normalizeSavedViewport(page.savedViewport);
        this.pages.set(page.id, page);
      }
    } catch {
      // Fresh data directory or unreadable index: seed below.
    }
    if (this.pages.size === 0) {
      this.create({ name: 'Main Overview', description: 'Default Overview page' });
    }
  }

  private persist(page: OverviewPageDefinition): void {
    const file = this.fileFor(page.id);
    const temporary = `${file}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(page, null, 2));
    fs.renameSync(temporary, file);
    this.persistIndex();
  }

  private persistIndex(): void {
    const temporary = `${this.indexFile}.tmp`;
    const index = this.list().map(({ id, name, revision, createdAt, modifiedAt }) => ({
      id,
      name,
      revision,
      createdAt,
      modifiedAt
    }));
    fs.writeFileSync(temporary, JSON.stringify(index, null, 2));
    fs.renameSync(temporary, this.indexFile);
  }

  private require(id: string): OverviewPageDefinition {
    if (!/^[0-9a-f-]{36}$/i.test(id)) fail('Invalid Overview page ID', 'INVALID_ID');
    const page = this.pages.get(id);
    if (!page) fail('Overview page not found', 'NOT_FOUND');
    return page;
  }

  private fileFor(id: string): string {
    if (!/^[0-9a-f-]{36}$/i.test(id)) fail('Invalid Overview page ID', 'INVALID_ID');
    return path.join(this.directory, `${id}.json`);
  }

  private cleanName(name: string): string {
    const value = name.trim();
    if (!value) fail('Overview page name is required', 'INVALID_NAME');
    if (value.length > 100) fail('Overview page name must be 100 characters or fewer', 'INVALID_NAME');
    return value;
  }

  private assertUniqueName(name: string, ignoreId?: string): void {
    const lower = name.toLowerCase();
    for (const page of this.pages.values()) {
      if (page.id !== ignoreId && page.name.toLowerCase() === lower) {
        fail('An Overview page with this name already exists', 'DUPLICATE_NAME');
      }
    }
  }

  private uniqueName(base: string): string {
    const trimmed = base.trim() || 'Overview Page';
    const taken = new Set([...this.pages.values()].map(page => page.name.toLowerCase()));
    if (!taken.has(trimmed.toLowerCase())) return this.cleanName(trimmed);
    for (let suffix = 2; suffix < 10_000; suffix += 1) {
      const candidate = `${trimmed} ${suffix}`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
    return `${trimmed} ${Date.now()}`;
  }
}
