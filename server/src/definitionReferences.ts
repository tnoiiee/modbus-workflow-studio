import type { SourceIdentity } from './definitionCatalog.js';
import type { OverviewPageManager } from './overviewPages.js';

export interface DefinitionReferenceSummary {
  scope: 'SAVED_OVERVIEW_PAGES';
  pageCount: number;
  bindingCount: number;
  references: Array<{ pageId: string; pageName: string; elementId: string; elementName: string; elementType: string }>;
}

/** Configuration reference inspection only. No names-as-identity or writes/cascades. */
export function definitionReferences(pages: Pick<OverviewPageManager, 'list' | 'get'>, identity: SourceIdentity): DefinitionReferenceSummary {
  const references: DefinitionReferenceSummary['references'] = [];
  for (const summary of pages.list()) {
    const page = pages.get(summary.id);
    for (const element of page?.elements ?? []) {
      if (element.type === 'NAVIGATION_LINK') continue;
      const binding = element.binding as { source?: Partial<SourceIdentity> } | undefined;
      const source = binding?.source;
      const matches = source?.sourceType === identity.sourceType && (
        identity.sourceType === 'SHARED_TAG' && source.sourceType === 'SHARED_TAG'
          ? source.sourceId === identity.sourceId
          : identity.sourceType === 'WORKFLOW_VARIABLE' && source.sourceType === 'WORKFLOW_VARIABLE'
            && source.workflowId === identity.workflowId && source.variableId === identity.variableId
      );
      if (matches) references.push({ pageId: summary.id, pageName: summary.name, elementId: element.id,
        elementName: typeof element.name === 'string' ? element.name : element.id, elementType: element.type });
    }
  }
  return { scope: 'SAVED_OVERVIEW_PAGES', pageCount: new Set(references.map(reference => reference.pageId)).size,
    bindingCount: references.length, references };
}
