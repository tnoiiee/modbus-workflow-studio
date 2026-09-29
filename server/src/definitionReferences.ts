import type { DefinitionCatalog, SourceIdentity } from './definitionCatalog.js';
import type { OverviewPageManager } from './overviewPages.js';

export interface DefinitionReferenceSummary {
  scope: 'SAVED_OVERVIEW_PAGES';
  pageCount: number;
  bindingCount: number;
  references: Array<{ pageId: string; pageName: string; elementId: string; elementName: string; elementType: string; direction?: 'MONITOR' | 'COMMAND' | 'NONE' }>;
}

/** Configuration reference inspection only. No names-as-identity or writes/cascades. */
export function definitionReferences(pages: Pick<OverviewPageManager, 'list' | 'get'>, identity: SourceIdentity): DefinitionReferenceSummary {
  const references: DefinitionReferenceSummary['references'] = [];
  for (const summary of pages.list()) {
    const page = pages.get(summary.id);
    for (const element of page?.elements ?? []) {
      if (element.type === 'NAVIGATION_LINK') continue;
      const binding = element.binding as { source?: Partial<SourceIdentity>; direction?: unknown } | undefined;
      const source = binding?.source;
      const matches = source?.sourceType === identity.sourceType && (
        identity.sourceType === 'SHARED_TAG' && source.sourceType === 'SHARED_TAG'
          ? source.sourceId === identity.sourceId
          : identity.sourceType === 'WORKFLOW_VARIABLE' && source.sourceType === 'WORKFLOW_VARIABLE'
            && source.workflowId === identity.workflowId && source.variableId === identity.variableId
      );
      if (matches) references.push({ pageId: summary.id, pageName: summary.name, elementId: element.id,
        elementName: typeof element.name === 'string' ? element.name : element.id, elementType: element.type, ...savedDirection(binding?.direction) });
    }
  }
  return { scope: 'SAVED_OVERVIEW_PAGES', pageCount: new Set(references.map(reference => reference.pageId)).size,
    bindingCount: references.length, references };
}

/** Legacy missing/invalid direction is absent, never inferred or persisted. */
function savedDirection(value: unknown): { direction?: 'MONITOR' | 'COMMAND' | 'NONE' } {
  return value === 'MONITOR' || value === 'COMMAND' || value === 'NONE' ? { direction: value } : {};
}

export interface DefinitionReferenceBatch {
  scope: 'SAVED_OVERVIEW_PAGES';
  unsavedDraftsIncluded: false;
  results: Array<{ source: SourceIdentity; found: boolean; pageCount: number; bindingCount: number }>;
}

function identityKey(source: Partial<SourceIdentity> | undefined): string | undefined {
  if (source?.sourceType === 'SHARED_TAG' && typeof source.sourceId === 'string') return `SHARED_TAG:${source.sourceId}`;
  if (source?.sourceType === 'WORKFLOW_VARIABLE' && typeof source.workflowId === 'string' && typeof source.variableId === 'string') return `WORKFLOW_VARIABLE:${source.workflowId}:${source.variableId}`;
  return undefined;
}

/** One saved-page enumeration/scan per batch. No persistent cache or runtime state. */
export function definitionReferenceBatch(pages: Pick<OverviewPageManager, 'list' | 'get'>, catalog: Pick<DefinitionCatalog, 'get'>, sources: readonly SourceIdentity[]): DefinitionReferenceBatch {
  const requested = new Map<string, { result: DefinitionReferenceBatch['results'][number]; pages: Set<string> }>();
  for (const source of sources) {
    const key = identityKey(source)!;
    if (!requested.has(key)) requested.set(key, {
      result: { source, found: Boolean(catalog.get(source)), pageCount: 0, bindingCount: 0 }, pages: new Set(),
    });
  }
  for (const summary of pages.list()) {
    const page = pages.get(summary.id);
    for (const element of page?.elements ?? []) {
      if (element.type === 'NAVIGATION_LINK') continue;
      const source = (element.binding as { source?: Partial<SourceIdentity> } | undefined)?.source;
      const key = identityKey(source), entry = key === undefined ? undefined : requested.get(key);
      if (!entry?.result.found) continue;
      entry.result.bindingCount++;
      entry.pages.add(summary.id);
    }
  }
  return { scope: 'SAVED_OVERVIEW_PAGES', unsavedDraftsIncluded: false,
    results: [...requested.values()].map(({ result, pages }) => ({ ...result, pageCount: pages.size })) };
}
