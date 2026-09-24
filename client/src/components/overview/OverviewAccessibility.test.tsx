import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ElementInspector } from './ElementInspector.js';
import { ElementLibrary } from './ElementLibrary.js';
import { createOverviewElement } from '../../lib/overviewElements.js';

const noop = () => {};
const callbacks = {
  onPatch: noop, onPatchStyle: noop, onPatchBinding: noop, onToggleLock: noop,
  onToggleVisible: noop, onDuplicate: noop, onDelete: noop, onBringForward: noop,
  onBringToFront: noop, onSendBackward: noop, onSendToBack: noop,
};
const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');
describe('O1-D Overview accessibility markup', () => {
  it('uses native disclosure buttons and lists instead of an incomplete ARIA tree', () => {
    const html = renderToStaticMarkup(<ElementLibrary onAddElement={noop} />);
    expect(html).toContain('role="region" aria-label="Element Library"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-controls=');
    expect(html).toContain('aria-label="Add Switch"');
    expect(html).not.toContain('role="tree');
    expect(html).toContain('<ul');
    expect(html).toContain('<li');
  });
  it('labels draft metadata without implying a runtime connection', () => {
    const html = renderToStaticMarkup(<ElementInspector {...callbacks} element={createOverviewElement('SWITCH', { id: 's', x: 0, y: 0 })} />);
    expect(html).toContain('role="region" aria-label="Element Inspector"');
    expect(html).toContain('<legend>Draft Tag binding</legend>');
    expect(html).toContain('DRAFT is not connected');
    expect(html).toContain('aria-describedby=');
    expect(html).toContain('aria-readonly="true"');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain('aria-invalid="true"');
  });
  it('announces invalid binding within the associated fieldset', () => {
    const element = createOverviewElement('SWITCH', { id: 's', x: 0, y: 0 });
    element.binding.status = 'DRAFT';
    const html = renderToStaticMarkup(<ElementInspector {...callbacks} element={element} />);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-atomic="true"');
    expect(html).toContain('DRAFT binding requires a non-empty Tag ID');
  });
  it('keeps Escape local to inspector input and restores focus to panel toggles (source contract)', () => {
    expect(read('./ElementInspector.tsx')).toContain("event.key === 'Escape'");
    expect(read('./ElementInspector.tsx')).toContain('event.stopPropagation()');
    const page = read('./OverviewPage.tsx');
    expect(page).toContain('panelFocusRef');
    expect(page).toContain(')?.focus()');
    expect(page).toContain("key={selectedElement?.id ?? 'empty'}");
  });
  it('continues to use shared dialog focus trap and alert contract without modifying shared components', () => {
    const page = read('./OverviewPage.tsx');
    expect(page).toContain('initialFocusRef={nameInputRef}');
    expect(page).toContain('error={saveConfirmError}');
    expect(read('../ui/Modal.tsx')).toContain('aria-modal="true"');
    expect(read('../ui/Modal.tsx')).toContain('previouslyFocused?.focus()');
    expect(read('../ui/ConfirmDialog.tsx')).toContain('role="alert"');
  });
});

describe('O1-D responsive CSS contracts (not browser layout verification)', () => {
  const css = read('../../styles/overview.css');
  it('keeps compact inspector in layout rather than over the canvas', () => {
    const compact = css.slice(css.indexOf('@media (max-width: 1200px)'), css.indexOf('@media (max-width: 1100px)'));
    expect(compact).toContain('174px minmax(0, 1fr) 248px');
    expect(compact).toContain('44px minmax(0, 1fr) 44px');
    expect(compact).toContain('position: static');
    expect(compact).not.toContain('position: absolute');
  });
  it('bounds short-viewport dialogs and provides scoped focus indicators', () => {
    expect(css).toContain('max-height: calc(100dvh - 32px)');
    expect(css).toContain('.overview .modal__body');
    expect(css).toContain('overflow-y: auto');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('prefers-reduced-motion');
  });
});
