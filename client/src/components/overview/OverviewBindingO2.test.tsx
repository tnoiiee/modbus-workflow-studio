import { readFileSync } from 'node:fs';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ElementInspector } from './ElementInspector.js';
import { SourceBindingFields } from './SourceBindingFields.js';
import { DefinitionCatalogEditor } from './DefinitionCatalogEditor.js';
import { createOverviewElement, patchOverviewBinding } from '../../lib/overviewElements.js';
import { resolveOverviewBinding } from '../../lib/overviewBinding.js';
import { definitionIdentity, type SourceDefinition } from '../../lib/sourceDefinitions.js';
const id = '11111111-1111-4111-8111-111111111111';
const source: SourceDefinition = { sourceType: 'SHARED_TAG', sourceId: id, name: 'Pump', dataType: 'Boolean', capability: 'COMMAND_ONLY', description: 'Motor command metadata', unit: '', enabled: true };
const noop = () => {};
const callbacks = { onPatch: noop, onPatchStyle: noop, onPatchBinding: noop, onToggleLock: noop, onToggleVisible: noop, onDuplicate: noop, onDelete: noop, onBringForward: noop, onBringToFront: noop, onSendBackward: noop, onSendToBack: noop };
function element() {
  const e = createOverviewElement('SWITCH', { id: 'e', x: 0, y: 0 });
  e.binding = patchOverviewBinding(e.category, e.binding, { source: definitionIdentity(source), dataType: 'Boolean' }); return e;
}
const resolution = () => resolveOverviewBinding(element(), { definitions: [source], available: true });
function children(node: ReactNode): ReactElement<any>[] {
  if (Array.isArray(node)) return node.flatMap(children);
  if (!isValidElement(node)) return [];
  return [node, ...children((node.props as { children?: ReactNode }).children)];
}
describe('O2-A Inspector/configuration UI', () => {
  it('presents stable identity, current metadata, reason and Control Runtime disabled', () => {
    const html = renderToStaticMarkup(<ElementInspector {...callbacks} element={element()} definitions={[source]} resolution={resolution()} />);
    for (const text of ['Source Type', 'Source definition', id, 'Pump', 'COMMAND_ONLY', 'Boolean', 'BOUND', 'CONTROL RUNTIME NOT ENABLED', 'Clear binding', 'aria-live="polite"', 'aria-readonly="true"']) expect(html).toContain(text);
    expect(html).not.toContain('CONNECTED');
  });
  it('shows incompatibility reason rather than a false BOUND label', () => {
    const definition = { ...source, enabled: false };
    const html = renderToStaticMarkup(<ElementInspector {...callbacks} element={element()} definitions={[definition]} resolution={resolveOverviewBinding(element(), { definitions: [definition], available: true })} />);
    expect(html).toContain('INCOMPATIBLE'); expect(html).toContain('disabled');
  });
  it('navigation inspector uses targetWorkflowId, not a Tag source or command selector', () => {
    const e = createOverviewElement('NAVIGATION_LINK', { id: 'link', x: 0, y: 0 }); e.targetWorkflowId = id;
    const html = renderToStaticMarkup(<ElementInspector {...callbacks} element={e} workflows={[]} />);
    expect(html).toContain('Missing target'); expect(html).toContain('targetWorkflowId');
    expect(html).not.toContain('Source definition'); expect(html).not.toContain('Binding direction'); expect(html).not.toContain('COMMAND_ONLY');
  });
  it('explicit selection commits stable identity; clear is one user action', () => {
    const e = element(); const patch = vi.fn();
    const tree = SourceBindingFields({ element: e, definitions: [source], workflows: [], resolution: resolution(), onPatchBinding: patch });
    const nodes = children(tree);
    const selects = nodes.filter(node => node.type === 'select');
    selects[1]!.props.onChange({ target: { value: id } });
    expect(patch).toHaveBeenCalledTimes(1); expect(patch).toHaveBeenCalledWith({ source: { sourceType: 'SHARED_TAG', sourceId: id }, dataType: 'Boolean' });
    patch.mockClear(); nodes.find(node => node.type === 'button')!.props.onClick();
    expect(patch).toHaveBeenCalledTimes(1); expect(patch).toHaveBeenCalledWith({ source: undefined, tagId: '', tagName: '', dataType: 'Unknown' });
  });
  it('switching workflow clears variable selection instead of crossing workflow identities', () => {
    const e = element(); e.binding.source = { sourceType: 'WORKFLOW_VARIABLE', workflowId: id, variableId: id };
    const patch = vi.fn();
    const selects = children(SourceBindingFields({ element: e, definitions: [], workflows: [], resolution: resolution(), onPatchBinding: patch })).filter(node => node.type === 'select');
    selects[1]!.props.onChange({ target: { value: '22222222-2222-4222-8222-222222222222' } });
    expect(patch).toHaveBeenCalledWith({ source: { sourceType: 'WORKFLOW_VARIABLE', workflowId: '22222222-2222-4222-8222-222222222222', variableId: '' } });
  });
  it('catalog has explicit persistence notice, metadata-only form and Disable default', () => {
    const html = renderToStaticMarkup(<DefinitionCatalogEditor definitions={[source]} workflows={[]} available onClose={noop} onChanged={async () => {}} />);
    for (const text of ['Source Definition Catalog', 'independent of Page Save/Cancel', 'Disable', 'Data type', 'Capability', 'Description', 'Unit', 'Create definition']) expect(html).toContain(text);
    expect(html).not.toContain('Delete definition');
  });
  it('no Runtime API or transport is added to the new UI modules', () => {
    for (const path of ['./DefinitionCatalogEditor.tsx', './SourceBindingFields.tsx', './ElementNode.tsx']) {
      const text = readFileSync(new URL(path, import.meta.url), 'utf8');
      expect(text).not.toMatch(/WebSocket|mqtt|\/runtime|\/run|\/stop|manual-trigger|\/write/);
    }
  });
});
