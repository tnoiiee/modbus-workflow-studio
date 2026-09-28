import { describe, expect, it } from 'vitest';
import { createOverviewElement, OVERVIEW_ALL_ELEMENT_TYPES, validateOverviewElements, emptyOverviewHistory, pushOverviewHistory, undoOverviewHistory, redoOverviewHistory } from './overviewElements.js';
import { inheritedMonitoringFont, hasInlineRuntimeAction, previewOverviewPresentation, PresentationNumberSession, validatePresentationStyle } from './overviewPresentationStyle.js';
import { beginOverviewEdit, cancelOverviewEdit, finishOverviewSave, overviewDraftMatchesBaseline } from './overviewState.js';
const make = () => createOverviewElement('NUMERIC_LABEL', { id: 'e', x: 16, y: 32 });
const legacy = () => { const e = make(); delete e.style.captionFontSize; delete e.style.valueFontSize; delete e.style.backgroundOpacity; delete e.style.showBorder; return e; };
describe('dev.14 narrow presentation schema and lazy defaults', () => {
  it.each(OVERVIEW_ALL_ELEMENT_TYPES)('%s new-element defaults add only applicable four-field presentation metadata', type => {
    const e = createOverviewElement(type, { id: 'e', x: 0, y: 0 });
    expect(e.style.backgroundOpacity).toBe(1); expect(e.style.showBorder).toBe(true);
    expect(e.style.captionFontSize).toBe(['NUMERIC_LABEL', 'TEXT_LABEL', 'STATUS_LIGHT', 'VALUE_BADGE'].includes(type) ? 11 : undefined);
    expect(e.style.valueFontSize).toBe(type === 'STATUS_LIGHT' ? 12 : ['NUMERIC_LABEL', 'VALUE_BADGE'].includes(type) ? 16 : undefined);
    expect(validateOverviewElements({ id: 'page', layerOrder: ['e'] }, [e])).toEqual([]);
    expect(Object.keys(e.style).sort()).toEqual(['text','fontSize','textColor','backgroundColor','borderColor','borderWidth','borderRadius','opacity','alignment','backgroundOpacity','showBorder',
      ...(['NUMERIC_LABEL','TEXT_LABEL','STATUS_LIGHT','VALUE_BADGE'].includes(type) ? ['captionFontSize'] : []),
      ...(['NUMERIC_LABEL','VALUE_BADGE','STATUS_LIGHT'].includes(type) ? ['valueFontSize'] : []), ...(type === 'STATUS_LIGHT' ? ['showText'] : [])].sort());
  });
  it.each([8,16,48,96])('legacy base %s retains exact dev.13 caption/value rules without mutation', base => {
    const e = legacy(); e.style.fontSize = base; const before = JSON.stringify(e);
    expect(inheritedMonitoringFont(e, 'captionFontSize')).toBe(Math.min(15, Math.max(11, .65 * base)));
    expect(inheritedMonitoringFont(e, 'valueFontSize')).toBe(base);
    expect(JSON.stringify(e)).toBe(before);
    e.width = 48; e.type = 'STATUS_LIGHT'; expect(inheritedMonitoringFont(e, 'captionFontSize')).toBe(.65 * base); expect(inheritedMonitoringFont(e, 'valueFontSize')).toBe(.75 * base);
  });
  it.each(['captionFontSize','valueFontSize','backgroundOpacity'] as const)('%s validates finite numbers only, no coercion', property => {
    for (const value of [NaN, Infinity, -1, '16', null, property === 'backgroundOpacity' ? 1.01 : 97]) {
      const e = make(); (e.style as any)[property] = value; expect(validatePresentationStyle(e.style).length).toBeGreaterThan(0);
    }
    for (const value of property === 'backgroundOpacity' ? [0,.5,1] : [8,16,96]) { const e = make(); e.style[property] = value; expect(validatePresentationStyle(e.style)).toEqual([]); }
  });
  it('legacy fallback/inspection leaves Page clean; unknown style fields survive clone/spread', () => {
    const e = legacy(); (e.style as any).futurePresentation = { unchanged: true };
    const page = { id: 'p', revision: 4, elements: [e], layerOrder: ['e'], savedViewport: { x: 2, y: 4, zoom: .5 } } as any;
    const before = JSON.stringify(page), session = beginOverviewEdit(page);
    inheritedMonitoringFont(e, 'captionFontSize'); inheritedMonitoringFont(e, 'valueFontSize');
    expect(overviewDraftMatchesBaseline(session.baseline, session.draft)).toBe(true); expect(JSON.stringify(page)).toBe(before);
    expect(validatePresentationStyle(e.style)).toEqual([]); (e.style as any).showBorder = 'false'; expect(validatePresentationStyle(e.style)).toContain('showBorder must be boolean');
  });
});
describe('dev.14 render-only preview and one-gesture history contract', () => {
  it.each(['captionFontSize','valueFontSize','backgroundOpacity'] as const)('%s is live Edit-only, preserving geometry/Binding/revision/history', property => {
    const e = legacy(), before = JSON.stringify(e), value = property === 'backgroundOpacity' ? .5 : 32;
    const rendered = previewOverviewPresentation([e], { elementId: e.id, property, value }, 'EDIT');
    expect(rendered[0].style[property]).toBe(value); expect(rendered[0].binding).toBe(e.binding); expect(JSON.stringify(e)).toBe(before);
    const elements = [e]; expect(previewOverviewPresentation(elements, { elementId: e.id, property, value }, 'VIEW')).toBe(elements);
    expect(previewOverviewPresentation(elements, { elementId: e.id, property, value: Infinity }, 'EDIT')).toBe(elements);
    e.locked = true; expect(previewOverviewPresentation(elements, { elementId: e.id, property, value }, 'EDIT')[0]).toBe(e);
  });
  it.each([[16,8,96],[100,0,100]])('numeric gesture %s previews then commits once; Escape/invalid/Undo reset are safe', (base,min,max) => {
    const s = new PresentationNumberSession(base,min,max); expect(s.change('')).toBeNull(); expect(s.change('Infinity')).toBeNull(); expect(s.finish()).toEqual({ text: String(base) });
    s.change('32'); s.change('48'); expect(s.finish()).toEqual({ text: '48', commit: 48 }); expect(s.finish()).toEqual({ text: '48' });
    s.change('24'); expect(s.cancel()).toBe('48'); expect(s.finish()).toEqual({ text: '48' }); expect(s.reset(base)).toBe(String(base));
  });
  it('custom, explicit reset-to-inherited, Undo/Redo, Save and Cancel preserve transaction boundaries', () => {
    const e = legacy(); (e.style as any).futurePresentation = 'preserved';
    const page = { id: 'p', revision: 1, elements: [e], layerOrder: ['e'], savedViewport: { x: 1, y: 2, zoom: 1 } } as any;
    const s = new PresentationNumberSession(16,8,96); s.change('24'); s.change('48'); const result = s.finish();
    const next = { ...e, style: { ...e.style, valueFontSize: result.commit! } }, history = pushOverviewHistory(emptyOverviewHistory(), [e]);
    expect(history.past).toHaveLength(1); const undo = undoOverviewHistory(history,[next])!; expect(undo.value).toEqual([e]); expect(redoOverviewHistory(undo.history,undo.value)!.value).toEqual([next]);
    const reset = { ...next, style: { ...next.style, valueFontSize: undefined } }; expect(JSON.stringify(reset)).toBe(JSON.stringify(e));
    expect(cancelOverviewEdit(page).draft.elements).toEqual([e]); expect(finishOverviewSave({ ...page, elements: [next] }).draft.elements).toEqual([next]);
    expect((JSON.parse(JSON.stringify(next)).style).futurePresentation).toBe('preserved'); expect(page.revision).toBe(1);
  });
  it.each([[8,8,false],[48,48,false],[144,48,true],[128,40,true],[400,200,true],[116,36,true],[115,35,false]] as const)('action eligibility %s×%s is fixed by geometry, not sample', (width,height,expected) => {
    const e = make(); e.width = width; e.height = height; e.style.borderWidth = 2; expect(hasInlineRuntimeAction(e)).toBe(expected);
  });
});
