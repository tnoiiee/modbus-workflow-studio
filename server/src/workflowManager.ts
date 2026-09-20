import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Mode, Workflow } from './types.js';

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface WorkflowDefinition extends Workflow {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
  viewport: Viewport;
}

export interface WorkflowSummary {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  mode: Mode;
  running: boolean;
  revision: number;
  nodeCount: number;
  edgeCount: number;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };
const DEFAULT_SETTINGS = { projectName: 'MODBUS WORKFLOW STUDIO', autoSaveDelay: 500, maxPasses: 100 };

export class WorkflowManager {
  private readonly directory: string;
  private readonly indexFile: string;
  private workflows = new Map<string, WorkflowDefinition>();

  constructor(private readonly dataDir: string, legacyWorkflow: Workflow) {
    this.directory = path.join(dataDir, 'workflows');
    this.indexFile = path.join(dataDir, 'workflows.json');
    fs.mkdirSync(this.directory, { recursive: true });
    this.load(legacyWorkflow);
  }

  list(runningId?: string): WorkflowSummary[] {
    return [...this.workflows.values()]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(workflow => ({
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        enabled: workflow.enabled,
        mode: workflow.mode,
        running: runningId === workflow.id,
        revision: workflow.revision,
        nodeCount: workflow.nodes.length,
        edgeCount: workflow.edges.length,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt
      }));
  }

  get(id: string): WorkflowDefinition | undefined {
    const workflow = this.workflows.get(id);
    return workflow ? structuredClone(workflow) : undefined;
  }

  first(): WorkflowDefinition {
    const workflow = this.workflows.values().next().value as WorkflowDefinition | undefined;
    if (!workflow) throw new Error('Project must contain at least one workflow');
    return structuredClone(workflow);
  }

  create(name: string, description = ''): WorkflowDefinition {
    const now = new Date().toISOString();
    const workflow: WorkflowDefinition = {
      id: randomUUID(),
      name: this.cleanName(name),
      description: description.trim(),
      enabled: true,
      version: 1,
      mode: 'DESIGN',
      running: false,
      nodes: [],
      edges: [],
      viewport: DEFAULT_VIEWPORT,
      settings: structuredClone(DEFAULT_SETTINGS),
      revision: 1,
      createdAt: now,
      updatedAt: now
    };
    this.workflows.set(workflow.id, workflow);
    this.persist(workflow);
    return structuredClone(workflow);
  }

  update(id: string, incoming: Partial<WorkflowDefinition>, expectedRevision?: number): WorkflowDefinition {
    const current = this.require(id);
    if (expectedRevision !== undefined && expectedRevision !== current.revision) {
      throw Object.assign(new Error('Workflow revision conflict'), { code: 'REVISION_CONFLICT' });
    }
    const now = new Date().toISOString();
    const workflow: WorkflowDefinition = {
      ...current,
      name: incoming.name === undefined ? current.name : this.cleanName(incoming.name),
      description: incoming.description === undefined ? current.description : incoming.description.trim(),
      enabled: incoming.enabled ?? current.enabled,
      mode: incoming.mode ?? current.mode,
      nodes: Array.isArray(incoming.nodes) ? incoming.nodes : current.nodes,
      edges: Array.isArray(incoming.edges) ? incoming.edges : current.edges,
      viewport: incoming.viewport ? this.cleanViewport(incoming.viewport) : current.viewport,
      settings: incoming.settings && typeof incoming.settings === 'object' ? incoming.settings : current.settings,
      running: false,
      revision: current.revision + 1,
      updatedAt: now
    };
    this.workflows.set(id, workflow);
    this.persist(workflow);
    return structuredClone(workflow);
  }

  rename(id: string, name: string): WorkflowDefinition {
    return this.update(id, { name });
  }

  duplicate(id: string, requestedName?: string): WorkflowDefinition {
    const source = this.require(id);
    const nodeMap = new Map(source.nodes.map(node => [node.id, randomUUID()]));
    const now = new Date().toISOString();
    const copy: WorkflowDefinition = {
      ...structuredClone(source),
      id: randomUUID(),
      name: this.cleanName(requestedName?.trim() || `${source.name} Copy`),
      mode: 'DESIGN',
      running: false,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      nodes: source.nodes.map(node => ({ ...structuredClone(node), id: nodeMap.get(node.id)! })),
      edges: source.edges.map(edge => ({
        ...structuredClone(edge),
        id: randomUUID(),
        source: nodeMap.get(edge.source)!,
        target: nodeMap.get(edge.target)!
      }))
    };
    this.workflows.set(copy.id, copy);
    this.persist(copy);
    return structuredClone(copy);
  }

  delete(id: string): void {
    this.require(id);
    if (this.workflows.size <= 1) throw Object.assign(new Error('The last workflow cannot be deleted'), { code: 'LAST_WORKFLOW' });
    this.workflows.delete(id);
    const file = this.fileFor(id);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    this.persistIndex();
  }

  downgradeArmed(): void {
    for (const workflow of this.workflows.values()) {
      if (workflow.mode === 'LIVE_ARMED') {
        workflow.mode = 'LIVE_LOCKED';
        workflow.running = false;
        workflow.updatedAt = new Date().toISOString();
        workflow.revision += 1;
        this.persist(workflow);
      }
    }
  }

  private load(legacy: Workflow): void {
    try {
      const index = JSON.parse(fs.readFileSync(this.indexFile, 'utf8')) as Array<{ id: string }>;
      for (const item of index) {
        const file = this.fileFor(item.id);
        if (!fs.existsSync(file)) continue;
        const workflow = JSON.parse(fs.readFileSync(file, 'utf8')) as WorkflowDefinition;
        workflow.running = false;
        if (workflow.mode === 'LIVE_ARMED') workflow.mode = 'LIVE_LOCKED';
        this.workflows.set(workflow.id, workflow);
      }
    } catch {
      // Migration is handled below.
    }
    if (this.workflows.size === 0) {
      const now = new Date().toISOString();
      const migrated: WorkflowDefinition = {
        ...structuredClone(legacy),
        id: randomUUID(),
        name: 'Main Workflow',
        description: 'Migrated from the single-workflow project format',
        enabled: true,
        running: false,
        mode: legacy.mode === 'LIVE_ARMED' ? 'LIVE_LOCKED' : legacy.mode,
        revision: 1,
        createdAt: now,
        updatedAt: now,
        viewport: DEFAULT_VIEWPORT
      };
      this.workflows.set(migrated.id, migrated);
      this.persist(migrated);
    }
  }

  private persist(workflow: WorkflowDefinition): void {
    const file = this.fileFor(workflow.id);
    const temporary = `${file}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify({ ...workflow, running: false }, null, 2));
    fs.renameSync(temporary, file);
    this.persistIndex();
  }

  private persistIndex(): void {
    const temporary = `${this.indexFile}.tmp`;
    const index = this.list().map(({ running: _running, nodeCount: _nodes, edgeCount: _edges, ...summary }) => summary);
    fs.writeFileSync(temporary, JSON.stringify(index, null, 2));
    fs.renameSync(temporary, this.indexFile);
  }

  private require(id: string): WorkflowDefinition {
    const workflow = this.workflows.get(id);
    if (!workflow) throw Object.assign(new Error('Workflow not found'), { code: 'NOT_FOUND' });
    return workflow;
  }

  private fileFor(id: string): string {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw Object.assign(new Error('Invalid workflow ID'), { code: 'INVALID_ID' });
    return path.join(this.directory, `${id}.json`);
  }

  private cleanName(name: string): string {
    const value = name.trim();
    if (!value) throw Object.assign(new Error('Workflow name is required'), { code: 'INVALID_NAME' });
    if (value.length > 100) throw Object.assign(new Error('Workflow name is too long'), { code: 'INVALID_NAME' });
    return value;
  }

  private cleanViewport(viewport: Viewport): Viewport {
    const x = Number(viewport.x);
    const y = Number(viewport.y);
    const zoom = Number(viewport.zoom);
    if (![x, y, zoom].every(Number.isFinite) || zoom < 0.1 || zoom > 4) return DEFAULT_VIEWPORT;
    return { x, y, zoom };
  }
}
