import { definitionKey } from './definitionList.js';
import { fetchDefinitionReferenceBatch } from './overviewApi.js';
import { definitionIdentity, type SourceDefinition } from './sourceDefinitions.js';

export type ReferenceCountState = { loading?: boolean; found?: boolean; count?: number; pageCount?: number; error?: string };
export const bindingCountLabel = (count: number): string => `${count} ${count === 1 ? 'binding' : 'bindings'}`;

/** Sequential batches bound network concurrency to one per catalog generation.
 * Cancellation is logical: an obsolete in-flight request may finish, but neither
 * its result nor queued batches can reach a newer catalog or an unmounted page.
 */
export async function loadReferenceCounts(definitions: readonly SourceDefinition[], isCurrent: () => boolean,
  publish: (counts: Record<string, ReferenceCountState>) => void, fetchBatch = fetchDefinitionReferenceBatch): Promise<void> {
  const sources = [...new Map(definitions.map(definition => [definitionKey(definition), definitionIdentity(definition)])).values()];
  if (!isCurrent()) return;
  const counts: Record<string, ReferenceCountState> = Object.fromEntries(sources.map(source => [definitionKey(source), { loading: true }]));
  publish({ ...counts });
  for (let offset = 0; offset < sources.length; offset += 100) {
    if (!isCurrent()) return;
    const batch = sources.slice(offset, offset + 100);
    try {
      const response = await fetchBatch(batch);
      if (!isCurrent()) return;
      if (response.scope !== 'SAVED_OVERVIEW_PAGES' || response.unsavedDraftsIncluded !== false) throw Error('Unexpected reference scope');
      const results = new Map(response.results.map(result => [definitionKey(result.source), result]));
      for (const source of batch) {
        const key = definitionKey(source), result = results.get(key);
        counts[key] = result && typeof result.found === 'boolean' && Number.isInteger(result.bindingCount) && result.bindingCount >= 0 && Number.isInteger(result.pageCount) && result.pageCount >= 0
          ? { found: result.found, count: result.bindingCount, pageCount: result.pageCount }
          : { error: 'Counts unavailable' };
      }
    } catch {
      if (!isCurrent()) return;
      for (const source of batch) counts[definitionKey(source)] = { error: 'Counts unavailable' };
    }
    if (isCurrent()) publish({ ...counts });
  }
}
