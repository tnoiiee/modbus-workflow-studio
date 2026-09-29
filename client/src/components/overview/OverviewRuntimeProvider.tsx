import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, useCallback, useSyncExternalStore, type ReactNode } from 'react';
import type { OverviewElement } from '../../lib/overviewElements.js';
import type { BindingResolution } from '../../lib/overviewBinding.js';
import type { RuntimeSelection } from '../../lib/overviewRuntimeSelection.js';
import { OverviewTagClientAdapter } from '../../lib/overviewTagClientAdapter.js';
import { overviewRuntimeSessionKey, startOverviewRuntimeSession } from '../../lib/overviewRuntimeSession.js';
import { RuntimeDetails } from './RuntimeDetails.js';
import '../../styles/overview-runtime.css';
const Context = createContext<{ adapter: OverviewTagClientAdapter; enabled: boolean; error: string; openDetails: (id: string) => void } | null>(null);
export const useOverviewRuntime = () => useContext(Context);
// Browser lifecycle fences before paint; SSR never opens a client or runs layout work.
const useLifecycleEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
export function OverviewRuntimeProvider({ adapter, enabled, pageId, selection, elements, resolutions, children }: {
  adapter: OverviewTagClientAdapter; enabled: boolean; pageId: string; selection: RuntimeSelection;
  elements: readonly OverviewElement[]; resolutions: Readonly<Record<string, BindingResolution>>; children: ReactNode;
}) {
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const openDetails = useCallback((id: string) => setDetailsId(id), []);
  const sessionKey = overviewRuntimeSessionKey(selection, resolutions);
  useLifecycleEffect(() => startOverviewRuntimeSession(adapter, enabled, pageId, selection),
    // Semantic confirmed metadata + canonical selection, never refresh/object identity.
    [adapter, enabled, pageId, selection.key, selection.error, sessionKey]);
  useEffect(() => { setDetailsId(null); }, [pageId, enabled, selection.key, sessionKey]);
  const context = useMemo(() => ({ adapter, enabled, error: selection.error, openDetails }), [adapter, enabled, selection.error, openDetails]);
  const detail = enabled && detailsId && selection.elementIds.includes(detailsId) ? elements.find(e => e.id === detailsId) : undefined;
  return <Context.Provider value={context}>{children}{detail && <RuntimeDetails element={detail} resolution={resolutions[detail.id]} onClose={() => setDetailsId(null)} />}</Context.Provider>;
}
export function useRuntimeItem(adapter: OverviewTagClientAdapter, sourceId: string) {
  const subscribe = useCallback((notify: () => void) => adapter.store.subscribeItem(sourceId, notify), [adapter, sourceId]);
  const get = useCallback(() => adapter.store.getItem(sourceId), [adapter, sourceId]);
  return useSyncExternalStore(subscribe, get, get);
}
export function useRuntimeStatus(adapter: OverviewTagClientAdapter) { return useSyncExternalStore(adapter.store.subscribeStatus, adapter.store.getStatus, adapter.store.getStatus); }
export function useRuntimeClock(adapter: OverviewTagClientAdapter) { return useSyncExternalStore(adapter.store.subscribeClock, adapter.store.getClock, adapter.store.getClock); }
