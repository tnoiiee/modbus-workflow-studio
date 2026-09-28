import type { BindingResolution } from './overviewBinding.js';
import type { RuntimeSelection } from './overviewRuntimeSelection.js';
import type { OverviewTagClientAdapter } from './overviewTagClientAdapter.js';

/** Local lifecycle key, NEVER a wire selectionKey/cursor. Only confirmed inputs
 * consumed by eligible monitoring affect lifetime; names/description/order and
 * unrelated Definitions do not. Number units must not relabel an old session.
 */
export function overviewRuntimeSessionKey(selection: RuntimeSelection, resolutions: Readonly<Record<string, BindingResolution>>) {
  const eligible = new Map<string, BindingResolution>();
  for (const id of selection.elementIds) {
    const resolution = resolutions[id], definition = resolution?.definition;
    if (definition?.sourceType === 'SHARED_TAG') eligible.set(definition.sourceId, resolution);
  }
  return JSON.stringify([selection.key, selection.sources.map(source => {
    const resolution = eligible.get(source.sourceId), definition = resolution?.definition;
    return [source.sourceId, resolution?.status, definition?.enabled, definition?.dataType, definition?.capability,
      definition?.dataType === 'Number' ? definition.unit : ''];
  })]);
}
type Events = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
export interface OverviewBrowserEnvironment {
  window: Events;
  document: Events & { readonly hidden: boolean };
  navigator: { readonly onLine: boolean };
}
/** Provider effect body, also exercised with deterministic browser event targets.
 * No new reconnect policy: unchanged adapter/B2 own all recovery and disposal.
 */
export function startOverviewRuntimeSession(adapter: OverviewTagClientAdapter, enabled: boolean, pageId: string, selection: RuntimeSelection,
  browser: OverviewBrowserEnvironment = { window, document, navigator }) {
  if (!enabled) { adapter.stop(); if (selection.error) adapter.store.setStatus('Error', selection.error, pageId); return; }
  adapter.activate(pageId, selection);
  const environment = () => { if (!browser.navigator.onLine || browser.document.hidden) adapter.pause(!browser.navigator.onLine); else adapter.resume(); };
  environment(); browser.window.addEventListener('online', environment); browser.window.addEventListener('offline', environment); browser.document.addEventListener('visibilitychange', environment);
  return () => { adapter.stop(); browser.window.removeEventListener('online', environment); browser.window.removeEventListener('offline', environment); browser.document.removeEventListener('visibilitychange', environment); };
}
