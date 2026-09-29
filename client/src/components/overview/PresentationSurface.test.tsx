import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { ElementNode } from './ElementNode.js';
import { EditorMonitoring, RuntimeMonitoringView } from './RuntimeMonitoring.js';
import { ElementInspector } from './ElementInspector.js';
import { PresentationFontControl } from './PresentationFontControl.js';
import { RuntimeSafetyPanel } from './RuntimeSafetyPanel.js';
import { createOverviewElement, OVERVIEW_ALL_ELEMENT_TYPES } from '../../lib/overviewElements.js';
import { runtimePresentation } from '../../lib/overviewRuntimePresentation.js';
import { configuration, sampleItem } from '../../lib/overviewRuntimeFixtures.js';
const render = renderToStaticMarkup;
const node = (element: ReturnType<typeof createOverviewElement>, mode: 'EDIT' | 'VIEW' = 'VIEW') => render(<ElementNode {...({ data: { element, mode }, selected: false } as any)} />);
const runtimeCss = readFileSync(new URL('../../styles/overview-runtime.css', import.meta.url), 'utf8');
const editorCss = readFileSync(new URL('../../styles/overview.css', import.meta.url), 'utf8');
const noop = () => {};
const handlers = { onPatch: noop, onPatchStyle: noop, onPatchBinding: noop, onToggleLock: noop, onToggleVisible: noop, onDuplicate: noop, onDelete: noop, onBringForward: noop, onBringToFront: noop, onSendBackward: noop, onSendToBack: noop };
describe('dev.14 scoped paint layer and complete frame applicability matrix', () => {
  it.each(OVERVIEW_ALL_ELEMENT_TYPES)('%s Border Off preserves width, geometry and intrinsic representation in both modes', type => {
    const e = createOverviewElement(type,{id:'e',x:0,y:0}); e.style.borderWidth=3; e.style.backgroundColor='rgba(12, 24, 36, 0.72)'; e.style.backgroundOpacity=.5;
    for (const mode of ['EDIT','VIEW'] as const) {
      const on=node(e,mode); e.style.showBorder=false; const off=node(e,mode);
      expect(off).toContain('border:3px solid transparent'); expect(off).toContain(`width:${e.width}px;height:${e.height}px`);
      expect(on.replace(`border:3px solid ${e.style.borderColor}`, 'border:3px solid transparent')).toBe(off);
      if (type==='STATUS_LIGHT') expect(off).toContain('overview-runtime-lamp');
      if (type==='SWITCH') expect(off).toContain('overview-element__switch-track');
      if (type==='PUSH_BUTTON') expect(off).toContain('overview-element__preview--button');
      if (type==='NAVIGATION_LINK') expect(off).toContain('overview-element__preview--link');
      if (['STATIC_IMAGE','PICTURE_BOX'].includes(type)) expect(off).toContain('overview-element__preview--picture');
      if (type==='DIVIDER') expect(off).toContain('overview-element__preview--divider');
      if (['SWITCH','PUSH_BUTTON'].includes(type)) expect(off).toContain('PREVIEW ONLY');
      e.style.showBorder=true;
    }
  });
  it.each([0,.5,1])('background alpha %s only affects paint; whole-element opacity and border stay independent', opacity => {
    const e=createOverviewElement('NUMERIC_LABEL',{id:'e',x:0,y:0}); e.style.backgroundColor='rgba(12, 24, 36, 0.72)'; e.style.backgroundOpacity=opacity; e.style.opacity=.8;
    const html=node(e); expect(html).toContain('opacity:0.8'); expect(html).toContain(`border:1px solid ${e.style.borderColor}`);
    if(opacity!==1) expect(html).toContain(`class="overview-element__background" aria-hidden="true" style="background:rgba(12, 24, 36, 0.72);opacity:${opacity}"`);
    else { expect(html).not.toContain('overview-element__background'); expect(html).toContain('background:rgba(12, 24, 36, 0.72)'); }
    // CSS compositing of the isolated child multiplies its color alpha (no parser/reinterpretation).
    expect(.72*opacity).toBe(opacity===0?0:opacity===.5?.36:.72);
    expect(editorCss).toContain('.overview-element__background { position: absolute; inset: 0; z-index: -1;');
    expect(editorCss).toContain('pointer-events: none');
    expect(editorCss).toContain('.overview-element.is-selected {\n  outline: 2px');
    expect(runtimeCss).toContain('.overview-control-runtime-warning { display: block');
  });
  it('absent alpha/border leave the legacy paint and frame intact, without adding fields on read', () => {
    const e=createOverviewElement('RECTANGLE',{id:'e',x:0,y:0}); delete e.style.backgroundOpacity; delete e.style.showBorder;
    const before=JSON.stringify(e), html=node(e); expect(html).toContain(`background:${e.style.backgroundColor}`); expect(html).toContain(`solid ${e.style.borderColor}`); expect(JSON.stringify(e)).toBe(before);
  });
});
describe('dev.14 custom font surface and contextual Inspector', () => {
  it.each(['NUMERIC_LABEL','VALUE_BADGE','STATUS_LIGHT','TEXT_LABEL'] as const)('%s custom Caption and Value do not change base/unit/lamp scales or geometry', type => {
    const f=configuration(1,type); f.element.style.captionFontSize=24; f.element.style.valueFontSize=40; f.element.style.showText=true; f.element.width=400; f.element.height=160;
    const before=JSON.stringify(f.element);
    const edit=render(<EditorMonitoring element={f.element} resolution={f.resolution}/>);
    const view=render(<RuntimeMonitoringView element={f.element} presentation={runtimePresentation(f.element,f.resolution,sampleItem(1,type==='STATUS_LIGHT'?false:8888.88),'Connected')} age=""/>);
    for(const html of [edit,view]) { expect(html).toContain('class="overview-runtime-caption" aria-hidden="true" style="font-size:24px"'); expect(html).toContain('class="overview-runtime-number" style="font-size:40px"'); expect(html).not.toMatch(/overview-runtime-unit" style=|overview-runtime-lamp[^>]+style=/); }
    expect(JSON.stringify(f.element)).toBe(before); expect(f.element.style.fontSize).toBe(16);
  });
  it('legacy fallback adds no inline sizes; empty caption creates no node; long value stays accessible', () => {
    const f=configuration(); delete f.element.style.captionFontSize; delete f.element.style.valueFontSize; f.element.style.text='';
    const html=render(<RuntimeMonitoringView element={f.element} presentation={runtimePresentation(f.element,f.resolution,sampleItem(1,1.2345678912345),'Connected')} age=""/>);
    expect(html).not.toContain('overview-runtime-caption'); expect(html).not.toContain('font-size:'); expect(html).toContain('1.2345678912345'); expect(runtimeCss).toContain('text-overflow: ellipsis');
  });
  it.each(OVERVIEW_ALL_ELEMENT_TYPES)('%s Inspector exposes contextual groups and no deferred fields', type => {
    const e=createOverviewElement(type,{id:'e',x:0,y:0}); const html=render(<ElementInspector element={e} {...handlers}/>);
    for(const label of ['Content','Typography','Appearance','Border','Layout and geometry','Background Opacity','Show Border','Overall Opacity — legacy','Legacy/Base Font Size','Duplicate element']) expect(html).toContain(label);
    expect(html.includes('Caption Font Size')).toBe(['NUMERIC_LABEL','TEXT_LABEL','STATUS_LIGHT','VALUE_BADGE'].includes(type));
    expect(html.includes('Value Font Size')).toBe(['NUMERIC_LABEL','VALUE_BADGE'].includes(type));
    expect(html).not.toMatch(/Unit Visibility|Caption Font Weight|Value Font Weight|Internal Padding|<details open/);
    expect(html.indexOf('<legend>Content')).toBeLessThan(html.indexOf('<legend>Typography'));
    expect(html.indexOf('<legend>Appearance')).toBeLessThan(html.indexOf('<legend>Border'));
  });
  it('Inherited/Custom and explicit reset stay presentation-only and preserve no-op inspection', () => {
    const f=configuration(); delete f.element.style.captionFontSize; const before=JSON.stringify(f.element), patch=vi.fn();
    const html=render(<PresentationFontControl element={f.element} property="captionFontSize" onPatchStyle={patch}/>);
    expect(html).toContain('Inherited · 11 px'); expect(html).toContain('Customize Caption Font Size'); expect(patch).not.toHaveBeenCalled(); expect(JSON.stringify(f.element)).toBe(before);
    f.element.style.captionFontSize=20;
    const tree=PresentationFontControl({element:f.element,property:'captionFontSize',onPatchStyle:patch});
    const walk=(n:any):any[]=>Array.isArray(n)?n.flatMap(walk):n&&typeof n==='object'&&n.props?[n,...walk(n.props.children)]:[];
    const reset=walk(tree).find(n=>n.type==='button'&&String(n.props.children).includes('Reset'));
    expect(reset).toBeDefined(); reset.props.onClick(); expect(patch).toHaveBeenCalledWith({captionFontSize:undefined});
  });
});
describe('dev.14 Details action / safe small-element fallback', () => {
  it.each(['GOOD','UNCERTAIN','STALE','BAD','DISCONNECTED'] as const)('%s retains fixed action slot and decorative centered SVG', quality => {
    const f=configuration(), open=vi.fn(), stop=vi.fn(); f.element.style.text='Long caption '.repeat(15);f.element.style.showRuntimeDetails=true;
    const tree=RuntimeMonitoringView({element:f.element,presentation:runtimePresentation(f.element,f.resolution,sampleItem(1,8888.88,quality),'Connected'),age:'1s',onDetails:open});
    const button=(tree.props.children as any[]).find(n=>n?.type==='button'); expect(button.props.type).toBe('button'); expect(button.props.className).toContain('nodrag nopan'); expect(button.props['aria-label']).toContain('Runtime details:');
    button.props.onClick({stopPropagation:stop}); expect(open).toHaveBeenCalledOnce(); expect(stop).toHaveBeenCalledOnce();
    const html=render(tree); expect(html).toContain('has-action-slot'); expect(html).toContain('<svg'); expect(html).toContain('aria-hidden="true"'); expect(html).not.toContain('ⓘ');
    expect(runtimeCss).toContain('display: grid; place-items: center; width: 24px; height: 24px;'); expect(runtimeCss).toContain('.overview-runtime-value.has-action-slot { padding-right: 36px; }'); expect(runtimeCss).toContain('outline-offset: -2px'); expect(runtimeCss).toContain('justify-content: var(--reading-align, flex-start); overflow: hidden;');
  });
  it.each(['NUMERIC_LABEL','STATUS_LIGHT','VALUE_BADGE','TEXT_LABEL'] as const)('%s tiny Element keeps diagnostics reachable through the existing Page path', type => {
    const f=configuration(1,type); f.element.width=24;f.element.height=24;
    const html=render(<RuntimeMonitoringView element={f.element} presentation={runtimePresentation(f.element,f.resolution,undefined,'Connected')} age="" onDetails={noop}/>);
    expect(html).not.toContain('<button'); expect(html).toContain('Page Runtime details and safety'); expect(html).toContain('has-page-action');
    const panel=render(<RuntimeSafetyPanel id="safety" origin={{current:null}} selection={f.selection} elements={[f.element]} message="READ_ONLY" onClose={noop} onDetails={noop}/>);
    expect(panel).toContain('— Runtime details</button>'); expect(f.element.width).toBe(24);
  });
});
