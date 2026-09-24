import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveOverviewBinding, bindingPresentation, ELEMENT_DATA_TYPES, DIRECTION_CAPABILITIES } from './overviewBinding.js';
import { completeIdentity, definitionIdentity, sameSource, SOURCE_CAPABILITIES, SOURCE_DATA_TYPES, type SourceDefinition } from './sourceDefinitions.js';
import { createOverviewElement, emptyOverviewHistory, patchOverviewBinding, pushOverviewHistory, redoOverviewHistory, undoOverviewHistory, validateOverviewElements, type OverviewElementType } from './overviewElements.js';
const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222', w = '33333333-3333-4333-8333-333333333333';
const definition = (patch: Partial<SourceDefinition> = {}): SourceDefinition => ({ sourceType: 'SHARED_TAG', sourceId: a, name: 'Pump', dataType: 'Boolean', capability: 'MONITOR_ONLY', description: '', unit: '', enabled: true, ...patch } as SourceDefinition);
function bound(type: OverviewElementType = 'STATUS_LIGHT', source = definition()) {
  const element = createOverviewElement(type, { id: 'element', x: 0, y: 0 });
  element.binding = patchOverviewBinding(element.category, element.binding, { source: definitionIdentity(source), dataType: source.dataType });
  return element;
}
const resolve = (element = bound(), definitions: SourceDefinition[] = [definition()]) => resolveOverviewBinding(element, { definitions, available: true });

describe('O2-A identity/status resolution', () => {
  it('NOT_BOUND without Source identity', () => { expect(resolve(createOverviewElement('STATUS_LIGHT', { id: 'e', x: 0, y: 0 })).status).toBe('NOT_BOUND'); });
  it.each([{ tagId: 'Pump', tagName: '' }, { tagId: '', tagName: 'Pump' }, { tagId: a, tagName: 'Pump' }])('legacy free text %j stays DRAFT; no name/Node/Monitor matching', legacy => {
    const element = bound(); delete element.binding.source; Object.assign(element.binding, legacy);
    expect(resolve(element).status).toBe('DRAFT');
  });
  it('incomplete source identity is DRAFT', () => {
    const element = bound(); element.binding.source = { sourceType: 'WORKFLOW_VARIABLE', workflowId: w };
    expect(resolve(element).status).toBe('DRAFT');
  });
  it('BOUND only for enabled, typed compatible identity', () => { expect(resolve().status).toBe('BOUND'); });
  it('MISSING for deleted/absent definition, not for failed catalog load', () => {
    expect(resolve(bound(), []).status).toBe('MISSING');
    const unavailable = resolveOverviewBinding(bound(), { definitions: [], available: false });
    expect(unavailable.status).toBe('DRAFT'); expect(unavailable.reason).toContain('unavailable');
  });
  it('renaming source does not modify binding or identity', () => {
    const element = bound(), before = structuredClone(element);
    expect(resolve(element, [definition({ name: 'Renamed' })])).toMatchObject({ status: 'BOUND', definition: { name: 'Renamed' } });
    expect(element).toEqual(before);
  });
  it('deletion is MISSING, recreation under same name/other ID never rebinds', () => {
    expect(resolve(bound(), [definition({ sourceId: b })]).status).toBe('MISSING');
  });
  it('disabled is INCOMPATIBLE with reason, enabled again restores BOUND', () => {
    expect(resolve(bound(), [definition({ enabled: false })])).toMatchObject({ status: 'INCOMPATIBLE', reason: 'Source definition is disabled.' });
    expect(resolve().status).toBe('BOUND');
  });
  it('metadata change can make an existing reference INCOMPATIBLE', () => {
    expect(resolve(bound(), [definition({ dataType: 'String' })]).status).toBe('INCOMPATIBLE');
    expect(resolve(bound(), [definition({ capability: 'COMMAND_ONLY' })]).reason).toContain('Direction');
  });
  it.each(['dataType', 'capability'])('missing %s metadata has explicit reason', field => {
    const source = definition(); delete (source as any)[field];
    expect(resolve(bound(), [source])).toMatchObject({ status: 'INCOMPATIBLE', reason: expect.stringContaining('Missing') });
  });
  it('Unknown legacy type is not inferred/coerced to source type', () => {
    const element = bound(); element.binding.dataType = 'Unknown';
    expect(resolve(element)).toMatchObject({ status: 'INCOMPATIBLE', reason: expect.stringContaining('Unknown legacy') });
  });
  it('NONE bypasses resolution and never claims BOUND', () => {
    const element = bound(); element.binding.direction = 'NONE';
    expect(resolve(element, [])).toMatchObject({ status: 'DRAFT', reason: expect.stringContaining('no Source resolution') });
  });
  it('workflow and source-type identity are isolated, not matched by bare UUID', () => {
    const variable: SourceDefinition = { ...definition(), sourceType: 'WORKFLOW_VARIABLE', workflowId: w, variableId: a };
    expect(resolve(bound(), [variable]).status).toBe('MISSING');
    const element = bound('STATUS_LIGHT', variable);
    expect(resolve(element, [variable]).status).toBe('BOUND');
    expect(resolve(element, [{ ...variable, workflowId: b }]).status).toBe('MISSING');
    expect(sameSource(definitionIdentity(variable), definition())).toBe(false);
  });
  it('rejects partial/non-UUID identities and cross-source fields', () => {
    expect(completeIdentity({ sourceType: 'WORKFLOW_VARIABLE', workflowId: w, variableId: 'Pump' })).toBe(false);
    const element = bound(); (element.binding.source as any).variableId = b;
    expect(validateOverviewElements({ id: 'p', layerOrder: ['element'] }, [element]).join(' ')).toContain('Invalid Source identity');
  });
});

describe('O2-A explicit compatibility matrix', () => {
  for (const type of Object.keys(ELEMENT_DATA_TYPES) as OverviewElementType[]) {
    for (const dataType of SOURCE_DATA_TYPES) {
      it(`${type} × ${dataType} is explicit, without value conversion`, () => {
        const source = definition({ dataType, capability: 'MONITOR_AND_COMMAND' });
        const element = bound(type, source);
        // No data interaction on display/navigation; separate from data compatibility.
        if (element.binding.direction === 'NONE') {
          expect(resolve(element, [source]).status).not.toBe('BOUND');
        } else {
          expect(resolve(element, [source]).status).toBe(ELEMENT_DATA_TYPES[type].includes(dataType) ? 'BOUND' : 'INCOMPATIBLE');
        }
      });
    }
  }
  for (const direction of ['MONITOR', 'COMMAND'] as const) {
    for (const capability of SOURCE_CAPABILITIES) {
      it(`${direction} × ${capability}`, () => {
        const source = definition({ capability });
        const element = bound(direction === 'COMMAND' ? 'SWITCH' : 'STATUS_LIGHT', source);
        expect(resolve(element, [source]).status).toBe(DIRECTION_CAPABILITIES[direction].includes(capability) ? 'BOUND' : 'INCOMPATIBLE');
      });
    }
  }
  it('intended type must exactly match source type; no JavaScript coercion', () => {
    const source = definition({ dataType: 'Number' }), element = bound('VALUE_BADGE', source);
    element.binding.dataType = 'Boolean'; expect(resolve(element, [source]).status).toBe('INCOMPATIBLE');
  });
  it.each(['SWITCH', 'PUSH_BUTTON'] as const)('%s is BOUND with Control Runtime explicitly disabled', type => {
    const source = definition({ capability: 'COMMAND_ONLY' });
    expect(resolve(bound(type, source), [source])).toMatchObject({ status: 'BOUND', controlRuntimeDisabled: true, reason: expect.stringContaining('CONTROL RUNTIME NOT ENABLED') });
  });
});

describe('O2-A Draft/history/persistence separation', () => {
  it('resolver refresh changes no Page bytes, dirty flag, revision or Undo/Redo', () => {
    const element = bound();
    const state = { page: { revision: 4, elements: [element] }, dirty: false, history: emptyOverviewHistory() };
    const before = JSON.stringify(state);
    Object.freeze(element.binding); Object.freeze(element);
    for (const sources of [[definition()], [definition({ name: 'Changed' })], [], [definition({ enabled: false })]]) resolve(element, sources);
    expect(JSON.stringify(state)).toBe(before);
  });
  it('one selection/clear commits once; Undo/Redo and Cancel restore baseline', () => {
    const baseline = createOverviewElement('STATUS_LIGHT', { id: 'element', x: 0, y: 0 });
    const after = { ...baseline, binding: patchOverviewBinding(baseline.category, baseline.binding, { source: definitionIdentity(definition()), dataType: 'Boolean' }) };
    const history = pushOverviewHistory(emptyOverviewHistory(), [baseline]);
    expect(history.past).toHaveLength(1);
    const undo = undoOverviewHistory(history, [after])!;
    expect(undo.value).toEqual([baseline]);
    expect(redoOverviewHistory(undo.history, undo.value)!.value).toEqual([after]);
    const saved = JSON.parse(JSON.stringify(after));
    expect(saved.binding.source).toEqual(definitionIdentity(definition()));
    expect(saved.binding).not.toHaveProperty('status');
    expect(resolve(saved).status).toBe('BOUND');
    const cleared = patchOverviewBinding(after.category, after.binding, { source: undefined, tagId: '', tagName: '', dataType: 'Unknown' });
    expect(resolve({ ...after, binding: cleared }).status).toBe('NOT_BOUND');
    expect(JSON.parse(JSON.stringify(baseline)).binding).not.toHaveProperty('source');
  });
  it('Page catalog refresh code never calls the mutation/history/save pipelines', () => {
    const text = readFileSync(new URL('../components/overview/OverviewPage.tsx', import.meta.url), 'utf8');
    const refresh = text.slice(text.indexOf('const refreshCatalog'), text.indexOf('const [pages'));
    expect(refresh).not.toMatch(/setDraft|setHistory|setSaveState|updateOverviewPage|applyElementMutation/);
    expect(text).toContain('resolution={selectedElement ? bindingResolutions[selectedElement.id] : undefined}');
  });
});


describe('O2-A presentation memo and resize isolation', () => {
  it('geometry-only changes reuse every resolution; removed elements do not accumulate', () => {
    const element = bound(), catalog = { definitions: [definition()], available: true };
    const first = bindingPresentation([element], catalog);
    const resized = bindingPresentation([{ ...element, width: 900, x: 16 }], catalog, first);
    expect(resized.resolutions[element.id]).toBe(first.resolutions[element.id]);
    const empty = bindingPresentation([], catalog, resized);
    expect(Object.keys(empty.entries)).toHaveLength(0);
    expect(Object.keys(empty.resolutions)).toHaveLength(0);
  });
  it('catalog changes invalidate only presentation, never geometry or stored binding', () => {
    const element = bound(), before = JSON.stringify(element);
    const first = bindingPresentation([element], { definitions: [definition()], available: true });
    const refreshed = bindingPresentation([element], { definitions: [], available: true }, first);
    expect(refreshed.resolutions[element.id]!.status).toBe('MISSING');
    expect(first.resolutions[element.id]!.status).toBe('BOUND');
    expect(JSON.stringify(element)).toBe(before);
  });
});

it('delete confirmation receives presentation status without modifying the persisted binding', async () => {
  const { buildElementDeleteFacts } = await import('./overviewState.js');
  const element = bound();
  expect(buildElementDeleteFacts(element, resolve(element).status)).toContain('Binding status: BOUND');
  expect(element.binding).not.toHaveProperty('status');
});
