import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

// Configuration only. Never import runtime, Modbus, transport or adapter types here.
export const definitionMetadataSchema = z.object({
  name: z.string().trim().min(1).max(100),
  dataType: z.enum(['Boolean', 'Number', 'String']),
  capability: z.enum(['MONITOR_ONLY', 'COMMAND_ONLY', 'MONITOR_AND_COMMAND']),
  description: z.string().max(1000).default(''),
  unit: z.string().trim().max(80).default(''),
  enabled: z.boolean().default(true),
}).strict();
const uuid = z.string().uuid();
export const sourceIdentitySchema = z.discriminatedUnion('sourceType', [
  z.object({ sourceType: z.literal('WORKFLOW_VARIABLE'), workflowId: uuid, variableId: uuid }).strict(),
  z.object({ sourceType: z.literal('SHARED_TAG'), sourceId: uuid }).strict(),
]);
const definitionSchema = z.discriminatedUnion('sourceType', [
  definitionMetadataSchema.extend({ sourceType: z.literal('WORKFLOW_VARIABLE'), workflowId: uuid, variableId: uuid }).strict(),
  definitionMetadataSchema.extend({ sourceType: z.literal('SHARED_TAG'), sourceId: uuid }).strict(),
]);
export const createDefinitionSchema = z.discriminatedUnion('sourceType', [
  definitionMetadataSchema.extend({ sourceType: z.literal('WORKFLOW_VARIABLE'), workflowId: uuid }).strict(),
  definitionMetadataSchema.extend({ sourceType: z.literal('SHARED_TAG') }).strict(),
]);
export const updateDefinitionSchema = definitionMetadataSchema.partial().strict();
export type SourceIdentity = z.infer<typeof sourceIdentitySchema>;
export type SourceDefinition = z.infer<typeof definitionSchema>;
const fileSchema = z.object({ version: z.literal(1), definitions: z.array(definitionSchema) }).strict();

function key(identity: SourceIdentity): string {
  return identity.sourceType === 'SHARED_TAG'
    ? `SHARED_TAG:${identity.sourceId}`
    : `WORKFLOW_VARIABLE:${identity.workflowId}:${identity.variableId}`;
}
function missing(): never {
  throw Object.assign(new Error('Source definition or owning workflow not found'), { status: 404 });
}

/** Separate persisted definitions; no values, polling or automatic binding rewrites. */
export class DefinitionCatalog {
  private readonly file: string;
  private records = new Map<string, SourceDefinition>();
  constructor(dataDir: string, private readonly workflowExists: (id: string) => boolean) {
    this.file = path.join(dataDir, 'source-definitions.json');
    fs.mkdirSync(dataDir, { recursive: true });
    if (fs.existsSync(this.file)) {
      const data = fileSchema.parse(JSON.parse(fs.readFileSync(this.file, 'utf8')));
      for (const definition of data.definitions) {
        const identity = key(definition);
        if (this.records.has(identity)) throw Error('Duplicate Source definition identity');
        this.records.set(identity, definition);
      }
    }
  }
  private visible(identity: SourceIdentity): boolean {
    return identity.sourceType === 'SHARED_TAG' || this.workflowExists(identity.workflowId);
  }
  list(): SourceDefinition[] {
    // Orphans are retained on disk, but must resolve MISSING when a workflow is deleted.
    return structuredClone([...this.records.values()].filter(definition => this.visible(definition)));
  }
  get(input: SourceIdentity): SourceDefinition | undefined {
    const identity = sourceIdentitySchema.parse(input);
    const record = this.visible(identity) ? this.records.get(key(identity)) : undefined;
    return record ? structuredClone(record) : undefined;
  }
  create(input: unknown): SourceDefinition {
    const data = createDefinitionSchema.parse(input);
    if (data.sourceType === 'WORKFLOW_VARIABLE' && !this.workflowExists(data.workflowId)) missing();
    const definition: SourceDefinition = data.sourceType === 'SHARED_TAG'
      ? { ...data, sourceId: randomUUID() }
      : { ...data, variableId: randomUUID() };
    this.commit(next => next.set(key(definition), definition));
    return structuredClone(definition);
  }
  update(identity: SourceIdentity, input: unknown): SourceDefinition {
    const metadata = updateDefinitionSchema.parse(input);
    const previous = this.get(identity);
    if (!previous) missing();
    const next = definitionSchema.parse({ ...previous, ...metadata });
    this.commit(records => records.set(key(next), next));
    return structuredClone(next);
  }
  delete(identity: SourceIdentity): void {
    if (!this.get(identity)) missing();
    // Bindings are intentionally untouched; deleted identity is never re-used.
    this.commit(records => records.delete(key(identity)));
  }
  private commit(change: (records: Map<string, SourceDefinition>) => void): void {
    const next = new Map(this.records);
    change(next);
    const temporary = `${this.file}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify({ version: 1, definitions: [...next.values()] }, null, 2));
    fs.renameSync(temporary, this.file);
    this.records = next;
  }
}
