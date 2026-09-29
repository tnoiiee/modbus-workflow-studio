import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ElementInspector } from './ElementInspector.js';
import { createOverviewElement } from '../../lib/overviewElements.js';
const noop = vi.fn();
const handlers = { onPatch: noop, onPatchStyle: noop, onPatchBinding: noop, onToggleLock: noop, onToggleVisible: noop, onDuplicate: noop, onDelete: noop, onBringForward: noop, onBringToFront: noop, onSendBackward: noop, onSendToBack: noop };
const render = (element: ReturnType<typeof createOverviewElement> | null) => renderToStaticMarkup(<ElementInspector element={element} {...handlers} />);
describe('dev.3 Inspector presentation', () => {
  it('no selection hides all active property fields and presents compact neutral empty state', () => {
    const html = render(null); expect(html).toContain('No element selected'); expect(html).toContain('role="status"');
    expect(html).not.toMatch(/<input|<select|<fieldset|Delete element|Draft Tag binding/);
  });
  it('selection, deselection and re-selection show only current fields', () => {
    const a = createOverviewElement('TEXT_LABEL', { id: 'A', x: 16, y: 32 }); a.name = 'Element A';
    const b = createOverviewElement('SWITCH', { id: 'B', x: 160, y: 32 }); b.name = 'Element B';
    expect(render(a)).toContain('value="Element A"'); expect(render(null)).not.toContain('Element A');
    expect(render(b)).toContain('value="Element B"'); expect(render(b)).not.toContain('Element A');
    expect(noop).not.toHaveBeenCalled();
  });
  it('preserves all field meanings and constraints in consistent groups', () => {
    const html = render(createOverviewElement('NUMERIC_LABEL', { id: 'number', x: 16, y: 32 }));
    for (const field of ['Element Name', 'Geometry', 'Width', 'Height', 'Rotation', 'Z-index', 'Appearance', 'Text', 'Font Size', 'Opacity', 'Text Color', 'Background', 'Border Color', 'Border Width', 'Border Radius', 'Alignment', 'Draft Tag binding', 'Legacy Tag ID', 'Legacy Tag Name', 'Intended Data Type', 'Direction', 'Status', 'Duplicate element', 'Delete element']) expect(html).toContain(field);
    expect(html).toContain('aria-label="Element actions"'); expect(html).toContain('min="8" max="96"');
  });
  it('Navigation has navigation fields rather than binding selectors; controls retain disabled Runtime semantics', () => {
    const navigation = render(createOverviewElement('NAVIGATION_LINK', { id: 'link', x: 0, y: 0 }));
    expect(navigation).toContain('Workflow navigation'); expect(navigation).not.toContain('Draft Tag binding');
    expect(render(createOverviewElement('PUSH_BUTTON', { id: 'button', x: 0, y: 0 }))).toContain('CONTROL RUNTIME NOT ENABLED');
  });
  it('locked fields/Delete remain disabled and long values use safe normal-flow CSS', () => {
    const element = createOverviewElement('STATIC_TEXT', { id: 'a-long-stable-element-id', x: 0, y: 0 }); element.locked = true;
    expect(render(element)).toContain('disabled="" aria-label="Delete element"');
    const css = readFileSync(new URL('../../styles/overview.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.overview-inspector\s*\{[^}]*position:\s*static/s);
    expect(css).toContain('.element-inspector .element-inspector__id { white-space: normal; overflow-wrap: anywhere;');
    const page = readFileSync(new URL('./OverviewPage.tsx', import.meta.url), 'utf8');
    expect(page).toContain("key={selectedElement?.id ?? 'empty'}"); expect(page).toContain('onSelectElement={setSelectedElementId}');
  });
});
