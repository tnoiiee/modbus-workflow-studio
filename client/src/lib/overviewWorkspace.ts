import type { OverviewMode } from './overviewState.js';

/** Presentation only: never touches viewport, saved geometry, Draft or selection. */
export function overviewInspectorPresentation(mode: OverviewMode, selectedId: string | null, collapsed: boolean): 'hidden' | 'collapsed' | 'expanded' {
  if (mode !== 'EDIT' || !selectedId) return 'hidden';
  return collapsed ? 'collapsed' : 'expanded';
}
