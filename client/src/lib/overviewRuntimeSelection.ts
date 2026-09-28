import type { OverviewElement } from './overviewElements.js';
import { ELEMENT_DATA_TYPES, type BindingResolution } from './overviewBinding.js';
import { completeIdentity } from './sourceDefinitions.js';
import { canonicalTagSelection, type TagIdentity } from './tagDeliveryProtocol.js';
export const OVERVIEW_RUNTIME_LIMITS = Object.freeze({ elements: 200, identities: 200, cacheBytes: 512 * 1024, publicationMs: 200, ageMs: 1000, recoveryAttempts: 5, recoveryWindowMs: 60000, retryMs: 1000 });
export const isRuntimeMonitoring = (type: string) => ['NUMERIC_LABEL', 'STATUS_LIGHT', 'VALUE_BADGE', 'TEXT_LABEL'].includes(type);
export interface RuntimeSelection { sources: TagIdentity[]; key: string; elementIds: string[]; error: string }
/** Configuration inspection only. Neither names nor legacy tagId fields establish identity. */
export function overviewRuntimeSelection(elements: readonly OverviewElement[], resolutions: Readonly<Record<string, BindingResolution>>): RuntimeSelection {
  const candidates = elements.filter(e => {
    const definition = resolutions[e.id]?.definition, source = e.binding.source;
    return e.visible && e.category === 'MONITORING' && isRuntimeMonitoring(e.type)
      && e.binding.direction === 'MONITOR' && source?.sourceType === 'SHARED_TAG' && completeIdentity(source)
      && resolutions[e.id]?.status === 'BOUND' && definition?.sourceType === 'SHARED_TAG'
      && definition.sourceId === source.sourceId && definition.enabled && e.binding.dataType === definition.dataType
      && ELEMENT_DATA_TYPES[e.type].includes(definition.dataType);
  });
  const identities = new Map<string, TagIdentity>();
  for (const e of candidates) { const source = e.binding.source as TagIdentity; identities.set(source.sourceId, { sourceType: 'SHARED_TAG', sourceId: source.sourceId }); }
  const error = candidates.length > OVERVIEW_RUNTIME_LIMITS.elements ? 'Page exceeds 200 eligible Runtime-bound Elements.'
    : identities.size > OVERVIEW_RUNTIME_LIMITS.identities ? 'Page exceeds 200 unique SHARED_TAG identities.' : '';
  if (error || !candidates.length) return { sources: [], key: '', elementIds: [], error };
  const selected = canonicalTagSelection([...identities.values()]);
  return { sources: selected.sources, key: selected.key, elementIds: candidates.map(e => e.id), error: '' };
}
export function runtimeViewAllowed(active: boolean, mode: string, ready: boolean, selection: RuntimeSelection) {
  return active && mode === 'VIEW' && ready && !selection.error && selection.sources.length > 0;
}
