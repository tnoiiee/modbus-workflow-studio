import { completeIdentity, definitionIdentity, SOURCE_CAPABILITIES, SOURCE_DATA_TYPES, type SourceDefinition, type DefinitionWorkflow } from './sourceDefinitions.js';

export interface OverviewCatalogState {
  definitions: SourceDefinition[];
  workflows: DefinitionWorkflow[];
  available: boolean;
  pending: boolean;
  error: string;
}
type LoadCatalog = () => Promise<[SourceDefinition[], DefinitionWorkflow[]]>;
const definitionKey = (d: SourceDefinition) => JSON.stringify([definitionIdentity(d), d.name, d.dataType, d.capability, d.enabled, d.unit, d.description]);
const catalogKey = (definitions: SourceDefinition[], workflows: DefinitionWorkflow[]) => JSON.stringify([
  definitions.map(definitionKey).sort(), workflows.map(w => JSON.stringify([w.id, w.name])).sort(),
]);
function validCatalog(definitions: SourceDefinition[], workflows: DefinitionWorkflow[]) {
  return Array.isArray(definitions) && definitions.every(d => d && (d.sourceType === 'SHARED_TAG' || d.sourceType === 'WORKFLOW_VARIABLE')
    && completeIdentity(definitionIdentity(d)) && SOURCE_DATA_TYPES.includes(d.dataType) && SOURCE_CAPABILITIES.includes(d.capability)
    && typeof d.enabled === 'boolean' && [d.name, d.unit, d.description].every(value => typeof value === 'string'))
    && new Set(definitions.map(d => JSON.stringify(definitionIdentity(d)))).size === definitions.length
    && Array.isArray(workflows) && workflows.every(w => w && typeof w.id === 'string' && typeof w.name === 'string');
}
/** Metadata-only state. Pending/failure never revoke a previously confirmed Catalog.
 * No timers or retries; overlapping explicit/focus refreshes share one request.
 */
export class OverviewCatalog {
  private state: OverviewCatalogState = { definitions: [], workflows: [], available: false, pending: false, error: '' };
  private listeners = new Set<() => void>();
  private request = 0;
  private inFlight?: Promise<void>;
  constructor(private load: LoadCatalog) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(state: OverviewCatalogState) { this.state = state; for (const listener of this.listeners) listener(); }
  refresh = (): Promise<void> => {
    if (this.inFlight) return this.inFlight;
    const token = ++this.request;
    // Defer I/O so StrictMode setup/cleanup/setup fences the discarded request too.
    const task = Promise.resolve().then(async () => {
      if (token !== this.request) return;
      try {
        const [definitions, workflows] = await this.load();
        if (token !== this.request) return;
        if (!validCatalog(definitions, workflows)) throw Error('Invalid Definition Catalog response');
        const same = this.state.available && catalogKey(definitions, workflows) === catalogKey(this.state.definitions, this.state.workflows);
        this.publish({ definitions: same ? this.state.definitions : structuredClone(definitions), workflows: same ? this.state.workflows : structuredClone(workflows), available: true, pending: false, error: '' });
      } catch (cause) {
        if (token === this.request) this.publish({ ...this.state, pending: false, error: cause instanceof Error ? cause.message : 'Catalog unavailable' });
      } finally { if (token === this.request) this.inFlight = undefined; }
    });
    this.inFlight = task;
    this.publish({ ...this.state, pending: true });
    return task;
  };
  cancel() { ++this.request; this.inFlight = undefined; if (this.state.pending) this.publish({ ...this.state, pending: false }); }
}
/** Called only by the active Overview effect; cleanup fences late metadata replies. */
export function observeOverviewCatalog(catalog: OverviewCatalog, target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>) {
  const refresh = () => { void catalog.refresh(); };
  refresh(); target.addEventListener('focus', refresh);
  return () => { target.removeEventListener('focus', refresh); catalog.cancel(); };
}
export function overviewCatalogNotice({ available, pending, error }: OverviewCatalogState) {
  if (error) return available
    ? `Catalog refresh warning: ${error}. Using last confirmed definitions; read-only Runtime continues. Refresh Source definitions to retry.`
    : `Catalog unavailable: ${error}. Runtime is disabled until a valid Catalog is loaded. Refresh Source definitions to retry.`;
  return pending ? available ? 'Refreshing Source definitions; using last confirmed Catalog.' : 'Loading Source definitions; Runtime is not ready.' : '';
}
