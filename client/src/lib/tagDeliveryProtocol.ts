import { z } from 'zod';
/** Wire DTOs only. No React/Overview or producer types. Must match server protocol v1. */
export const tagIdentity = z.object({ sourceType: z.literal('SHARED_TAG'), sourceId: z.string().uuid().max(36) }).strict();
export type TagIdentity = z.infer<typeof tagIdentity>;
export function canonicalTagSelection(input: unknown) {
  const sources = z.array(tagIdentity).min(1).max(200).parse(input);
  const sorted = [...new Map(sources.map(s => [s.sourceId, s])).values()].sort((a, b) => a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0);
  return { sources: sorted, key: JSON.stringify({ protocolVersion: 1, sources: sorted }) };
}
const time = z.string().max(64).datetime().nullable();
const value = z.union([z.number().finite(), z.boolean(), z.string().refine(s => new TextEncoder().encode(s).length <= 1024)]).nullable();
const sample = z.object({ source: tagIdentity, dataType: z.enum(['Boolean','Number','String']), value, hasValue: z.boolean(),
  quality: z.enum(['GOOD','UNCERTAIN','STALE','BAD','DISCONNECTED']), reason: z.string().max(256), sourceTimestamp: time, receiveTimestamp: time,
  stateUpdatedAt: z.string().datetime(), serverEpoch: z.string().uuid(), sampleSequence: z.number().int().positive().safe(), lastGoodValue: value, lastGoodReceiveTimestamp: time }).strict().refine(s => {
    const compatible = (v: unknown) => v === null || typeof v === (s.dataType === 'Boolean' ? 'boolean' : s.dataType === 'Number' ? 'number' : 'string');
    return compatible(s.value) && compatible(s.lastGoodValue) && (s.hasValue ? s.value !== null : s.value === null);
  });
export const deliveryItem = z.object({ source: tagIdentity, availability: z.enum(['DEFINITION_MISSING','UNCONFIGURED','DEFINITION_DISABLED','MAPPING_DISABLED','DEVICE_MISSING','DEVICE_DISABLED','UNSUPPORTED','INCOMPATIBLE','NO_SAMPLE','DISCONNECTED','AVAILABLE']), reason: z.string().max(256), sample: sample.nullable() }).strict().refine(i => !i.sample || i.source.sourceId === i.sample.source.sourceId);
export type ClientTagItem = z.infer<typeof deliveryItem>;
export const snapshotReply = z.object({ protocolVersion: z.literal(1), scope: z.literal('TAG_RUNTIME'), serverEpoch: z.string().uuid(), cursor: z.string().min(1).max(1024), selectionKey: z.string().max(20000), capturedAt: z.string().datetime(), items: z.array(deliveryItem).min(1).max(200) }).strict();
export const deliveryUpdate = z.object({ deliverySequence: z.number().int().positive().safe(), kind: z.enum(['updated','removed','availability']), sampleSequence: z.number().int().positive().safe().optional(), item: deliveryItem }).strict();
export const deliveryRange = z.object({ protocolVersion: z.literal(1), type: z.enum(['delta','checkpoint']), serverEpoch: z.string().uuid(), subscriptionId: z.string().uuid(), generation: z.number().int().positive().safe(), selectionKey: z.string().max(20000), fromExclusive: z.string().min(1).max(1024), toInclusive: z.string().min(1).max(1024), updates: z.array(deliveryUpdate).max(128) }).strict();
