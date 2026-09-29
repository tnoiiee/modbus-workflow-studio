import { z } from 'zod';
import type { SharedTagIdentity, TagSample } from './tagRuntime.js';
export const TAG_DELIVERY_LIMITS = Object.freeze({ requestBytes: 32 * 1024, controlBytes: 64 * 1024, snapshotBytes: 512 * 1024, frameBytes: 64 * 1024,
  journalCount: 16384, journalBytes: 16 * 1024 * 1024, journalAgeMs: 60000, queueCount: 256, queueBytes: 1024 * 1024,
  bufferedBytes: 1024 * 1024, subscriptions: 4, connectionIdentities: 500, requestIdentities: 200, connections: 16,
  globalIdentities: 2000, ackMs: 10000, checkpointMs: 250, tickMs: 50 });
export type Availability = 'DEFINITION_MISSING' | 'UNCONFIGURED' | 'DEFINITION_DISABLED' | 'MAPPING_DISABLED' | 'DEVICE_MISSING' | 'DEVICE_DISABLED' | 'UNSUPPORTED' | 'INCOMPATIBLE' | 'NO_SAMPLE' | 'DISCONNECTED' | 'AVAILABLE';
export interface DeliveryItem { source: SharedTagIdentity; availability: Availability; reason: string; sample: TagSample | null }
export interface DeliveryEvent { deliverySequence: number; kind: 'updated' | 'removed' | 'availability'; sampleSequence?: number; item: DeliveryItem }
export interface TagSnapshot { protocolVersion: 1; scope: 'TAG_RUNTIME'; serverEpoch: string; cursor: string; selectionKey: string; capturedAt: string; items: DeliveryItem[] }
export class DeliveryError extends Error { constructor(readonly code: string, readonly status = 400) { super(code); } }
const identity = z.object({ sourceType: z.literal('SHARED_TAG'), sourceId: z.string().uuid().max(36) }).strict();
const sources = z.array(identity).min(1).max(TAG_DELIVERY_LIMITS.requestIdentities);
export const snapshotSchema = z.object({ protocolVersion: z.literal(1), sources }).strict();
const requestId = z.string().min(1).max(64), subscriptionId = z.string().uuid();
const generation = z.number().int().positive().safe();
export const controlSchema = z.discriminatedUnion('type', [
  z.object({ protocolVersion: z.literal(1), type: z.literal('subscribe'), requestId, generation, sources, selectionKey: z.string().max(20000), cursor: z.string().max(1024) }).strict(),
  z.object({ protocolVersion: z.literal(1), type: z.literal('unsubscribe'), requestId, subscriptionId, generation }).strict(),
  z.object({ protocolVersion: z.literal(1), type: z.literal('ack'), requestId, subscriptionId, generation, cursor: z.string().max(1024) }).strict(),
]);
export function selection(input: unknown): { sources: SharedTagIdentity[]; key: string } {
  const parsed = sources.safeParse(input); if (!parsed.success) throw new DeliveryError('INVALID_IDENTITIES');
  const sorted = [...new Map(parsed.data.map(s => [s.sourceId, s])).values()].sort((a, b) => a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0);
  return { sources: sorted, key: JSON.stringify({ protocolVersion: 1, sources: sorted }) };
}
export const jsonBytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
