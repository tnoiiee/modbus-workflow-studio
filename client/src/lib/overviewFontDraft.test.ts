import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FontSizeDraftSession, parseOverviewFontSize, previewOverviewFontSize } from './overviewFontDraft.js';
import { createOverviewElement, emptyOverviewHistory, pushOverviewHistory, undoOverviewHistory, redoOverviewHistory, type OverviewElementType } from './overviewElements.js';

const textTypes: OverviewElementType[] = ['NUMERIC_LABEL', 'TEXT_LABEL', 'STATUS_LIGHT', 'VALUE_BADGE', 'PICTURE_BOX', 'SWITCH', 'PUSH_BUTTON', 'NAVIGATION_LINK', 'STATIC_TEXT', 'RECTANGLE', 'PANEL', 'STATIC_IMAGE'];
describe('O2-A punchlist real-time Font Size Draft', () => {
  it.each(textTypes)('%s previews immediately without mutating Draft or saved configuration', type => {
    const e = createOverviewElement(type, { id: 'target', x: 16, y: 32 });
    const original = JSON.stringify(e), elements = [e];
    const rendered = previewOverviewFontSize(elements, { elementId: 'target', fontSize: 48 }, 'EDIT');
    expect(rendered[0].style.fontSize).toBe(48); expect(JSON.stringify(e)).toBe(original);
    expect(rendered[0].binding).toBe(e.binding); expect(rendered[0].width).toBe(e.width);
    expect(previewOverviewFontSize(elements, null, 'EDIT')).toBe(elements);
    expect(previewOverviewFontSize(elements, { elementId: 'target', fontSize: 48 }, 'VIEW')).toBe(elements);
  });
  it('typing and spinner changes produce one commit; Enter followed by blur cannot double-commit', () => {
    const session = new FontSizeDraftSession(16);
    expect(session.change('2')).toBeNull(); expect(session.change('24')).toBe(24); expect(session.change('25')).toBe(25);
    expect(session.finish()).toEqual({ text: '25', commit: 25 }); expect(session.finish()).toEqual({ text: '25' });
    expect(session.change('26')).toBe(26); expect(session.finish()).toEqual({ text: '26', commit: 26 });
  });
  it.each(['', ' ', '7', '97', 'abc', 'Infinity', '-4'])('invalid input %j never commits', input => {
    const session = new FontSizeDraftSession(16); expect(session.change(input)).toBeNull();
    expect(session.finish()).toEqual({ text: '16' }); expect(parseOverviewFontSize(input)).toBeUndefined();
  });
  it('Escape cancels transient input, blur remains no-op, Undo/reset updates the field baseline', () => {
    const session = new FontSizeDraftSession(16); session.change('32'); expect(session.cancel()).toBe('16'); expect(session.finish()).toEqual({ text: '16' });
    session.change('48'); expect(session.reset(24)).toBe('24'); expect(session.finish()).toEqual({ text: '24' });
  });
  it('one gesture uses one Undo entry; Save roundtrip persists, Cancel/Undo restore and Redo reapplies', () => {
    const original = createOverviewElement('TEXT_LABEL', { id: 'target', x: 0, y: 0 });
    const session = new FontSizeDraftSession(original.style.fontSize), history = emptyOverviewHistory();
    session.change('24'); session.change('48');
    expect(history.past).toHaveLength(0);
    const result = session.finish(), next = { ...original, style: { ...original.style, fontSize: result.commit! } };
    const committedHistory = pushOverviewHistory(history, [original]); expect(committedHistory.past).toHaveLength(1);
    const undo = undoOverviewHistory(committedHistory, [next])!; expect(undo.value).toEqual([original]);
    expect(redoOverviewHistory(undo.history, undo.value)!.value).toEqual([next]);
    expect(JSON.parse(JSON.stringify(next)).style.fontSize).toBe(48);
    expect(previewOverviewFontSize([original], null, 'VIEW')[0]).toBe(original);
  });
  it('locked elements and invalid overlay values never change rendering', () => {
    const e = { ...createOverviewElement('STATIC_TEXT', { id: 'target', x: 0, y: 0 }), locked: true };
    expect(previewOverviewFontSize([e], { elementId: e.id, fontSize: 24 }, 'EDIT')[0]).toBe(e);
    const elements = [e]; expect(previewOverviewFontSize(elements, { elementId: e.id, fontSize: NaN }, 'EDIT')).toBe(elements);
  });
  it('font overlay is wired only to Canvas; persistence still uses Draft; BOUND remains Editor Preview', () => {
    const page = readFileSync(new URL('../components/overview/OverviewPage.tsx', import.meta.url), 'utf8');
    expect(page).toContain('elements={canvasElements}'); expect(page).toContain('elements: draft?.elements');
    expect(page).toContain('onPreviewFontSize={previewFontSize}');
    const preview = page.slice(page.indexOf('const previewFontSize'), page.indexOf('const previousPresentation'));
    expect(preview).not.toMatch(/setDraft|setHistory|updateOverviewPage|setSaveState/);
    const node = readFileSync(new URL('../components/overview/ElementNode.tsx', import.meta.url), 'utf8');
    expect(node).toContain('Editor Preview'); expect(node).toContain('resolution.status'); expect(node).toContain('CONTROL RUNTIME NOT ENABLED');
    const css = readFileSync(new URL('../styles/overview.css', import.meta.url), 'utf8');
    expect(css).toContain('.overview-element__body .overview-element__value { font-size: inherit; }');
  });
});
