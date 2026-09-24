import type { OverviewBindingStatus, OverviewElement, OverviewElementType } from './overviewElements.js';
import { completeIdentity, sameSource, type SourceCapability, type SourceDataType, type SourceDefinition } from './sourceDefinitions.js';

/** Explicit, non-coercing matrix. Picture Box behavior is reserved for O2-C. */
export const ELEMENT_DATA_TYPES: Readonly<Record<OverviewElementType, readonly SourceDataType[]>> = {
  NUMERIC_LABEL: ['Number'], TEXT_LABEL: ['String'], STATUS_LIGHT: ['Boolean'],
  VALUE_BADGE: ['Boolean', 'Number', 'String'], SWITCH: ['Boolean'], PUSH_BUTTON: ['Boolean'],
  NAVIGATION_LINK: [], PICTURE_BOX: [], STATIC_TEXT: [], RECTANGLE: [], PANEL: [], DIVIDER: [], STATIC_IMAGE: [],
};
export const DIRECTION_CAPABILITIES: Readonly<Record<'MONITOR' | 'COMMAND', readonly SourceCapability[]>> = {
  MONITOR: ['MONITOR_ONLY', 'MONITOR_AND_COMMAND'],
  COMMAND: ['COMMAND_ONLY', 'MONITOR_AND_COMMAND'],
};
export interface BindingResolution {
  status: OverviewBindingStatus;
  reason: string;
  definition?: SourceDefinition;
  controlRuntimeDisabled: boolean;
}
export type CatalogState = { definitions: readonly SourceDefinition[]; available: boolean };
export function resolveOverviewBinding(element: OverviewElement, catalog: CatalogState): BindingResolution {
  const { binding } = element;
  const result = (status: OverviewBindingStatus, reason: string, definition?: SourceDefinition): BindingResolution => ({
    status, reason, definition,
    controlRuntimeDisabled: element.category === 'CONTROL' && element.type !== 'NAVIGATION_LINK' && binding.direction === 'COMMAND',
  });
  if (element.type === 'NAVIGATION_LINK') return result('NOT_BOUND', 'Navigation uses targetWorkflowId only; no Tag binding.');
  if (!binding.source) {
    return binding.tagId?.trim() || binding.tagName?.trim()
      ? result('DRAFT', 'Legacy free-text binding. Explicitly select a Definition Catalog source; names are never matched.')
      : result('NOT_BOUND', 'No Source identity selected.');
  }
  if (binding.direction === 'NONE') return result('DRAFT', 'Direction NONE: identity retained as draft; no Source resolution required.');
  if (!completeIdentity(binding.source)) return result('DRAFT', 'Incomplete stable Source identity. Select a catalog definition.');
  if (!catalog.available) return result('DRAFT', 'Definition Catalog unavailable or refreshing; resolution is not confirmed.');
  const definition = catalog.definitions.find(item => sameSource(binding.source!, item));
  if (!definition) return result('MISSING', 'Source definition or owning Workflow does not exist.');
  if (!definition.enabled) return result('INCOMPATIBLE', 'Source definition is disabled.', definition);
  if (!definition.dataType || !definition.capability || !binding.dataType) return result('INCOMPATIBLE', 'Missing data type or capability metadata.', definition);
  if (binding.dataType === 'Unknown') return result('INCOMPATIBLE', 'Unknown legacy data type. Select an explicit intended data type.', definition);
  if (!ELEMENT_DATA_TYPES[element.type].includes(definition.dataType) || binding.dataType !== definition.dataType) {
    return result('INCOMPATIBLE', `Data type mismatch: ${element.type} accepts ${ELEMENT_DATA_TYPES[element.type].join(', ') || 'no data binding in O2-A'}; intended ${binding.dataType}, source ${definition.dataType}.`, definition);
  }
  const direction = binding.direction;
  if ((element.category === 'CONTROL' && direction !== 'COMMAND') || (element.category === 'MONITORING' && direction !== 'MONITOR')
      || !DIRECTION_CAPABILITIES[direction]?.includes(definition.capability)) {
    return result('INCOMPATIBLE', `Direction ${direction} is incompatible with capability ${definition.capability}.`, definition);
  }
  return result('BOUND', direction === 'COMMAND'
    ? 'Configuration compatible. CONTROL RUNTIME NOT ENABLED.'
    : 'Configuration compatible. Monitoring Runtime is not enabled.', definition);
}

export interface BindingPresentation {
  resolutions: Readonly<Record<string, BindingResolution>>;
  entries: Readonly<Record<string, { element: OverviewElement; resolution: BindingResolution }>>;
  definitions: readonly SourceDefinition[];
  available: boolean;
}
/** Bounded, configuration-only presentation memo. Geometry changes reuse resolution objects. */
export function bindingPresentation(elements: readonly OverviewElement[], catalog: CatalogState, previous?: BindingPresentation): BindingPresentation {
  const entries: Record<string, { element: OverviewElement; resolution: BindingResolution }> = {};
  const resolutions: Record<string, BindingResolution> = {};
  for (const element of elements) {
    const old = previous?.entries[element.id];
    const unchanged = old && previous?.definitions === catalog.definitions && previous.available === catalog.available
      && old.element.binding === element.binding && old.element.type === element.type && old.element.category === element.category;
    const resolution = unchanged ? old.resolution : resolveOverviewBinding(element, catalog);
    entries[element.id] = { element, resolution }; resolutions[element.id] = resolution;
  }
  return { entries, resolutions, definitions: catalog.definitions, available: catalog.available };
}
