import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { ElementNode, CONTROL_PREVIEW_DESCRIPTION } from './ElementNode.js';
import { EditorMonitoring, RuntimeMonitoringView } from './RuntimeMonitoring.js';
import { RuntimeSafetyPanel } from './RuntimeSafetyPanel.js';
import { configuration, sampleItem } from '../../lib/overviewRuntimeFixtures.js';
import { runtimePresentation } from '../../lib/overviewRuntimePresentation.js';
import { createOverviewElement, OVERVIEW_ALL_ELEMENT_TYPES } from '../../lib/overviewElements.js';
import { canvasMonitoringLayout } from '../../lib/overviewCanvasPresentation.js';
import * as provider from './OverviewRuntimeProvider.js';
const render=renderToStaticMarkup,css=readFileSync(new URL('../../styles/overview-runtime.css',import.meta.url),'utf8'),editorCss=readFileSync(new URL('../../styles/overview.css',import.meta.url),'utf8');
const node=(element:ReturnType<typeof createOverviewElement>, mode:'EDIT'|'VIEW')=>render(<ElementNode {...({data:{element,mode},selected:false} as any)}/>);
const plain=(html:string)=>html.replace(/<[^>]*>/g,'');
describe('dev.15 A+B Canvas surfaces and rail replacement',()=>{
 it.each(['GOOD','UNCERTAIN','STALE','BAD','DISCONNECTED'] as const)('%s has no rail paint, a fixed 2px gutter, and one accessible operator status',quality=>{
  const f=configuration(),item=sampleItem(1,0,quality);item.reason='SYNTHETIC_INTERNAL_REASON';
  const p=runtimePresentation(f.element,f.resolution,item,'Connected'),html=render(<RuntimeMonitoringView element={f.element} presentation={p} age="12s since receive" onDetails={()=>{}}/>);
  expect(html).not.toContain(item.reason);expect(html).not.toContain('aria-live');expect(html).toContain('overview-runtime-abnormal');
  expect(css).not.toContain('.overview-runtime-value { border-left:');expect(css).toContain('.overview-runtime-value.has-abnormal { border-left: 2px solid transparent; }');
  expect(css).not.toMatch(/overview-runtime-value[^}]*border-left:[^;}]*var\(/);
  const text=plain(html);if(quality==='GOOD'){expect(text).not.toContain('GOOD');expect(html).toContain('data-empty="true"');}
  else {const label=quality==='STALE'?'Stale':quality==='UNCERTAIN'?'Uncertain':quality==='DISCONNECTED'?'Disconnected':'BAD';expect(text.split(label).length-1).toBe(1);expect(html).not.toContain('data-empty="true"');}
 });
 it('rail replacement is Element-local; Page/Details callouts and Edit selection are not removed',()=>{
  expect(css).toContain('.overview-runtime-status .overview-runtime-callout { padding: 6px 8px; border-left: 2px solid #fbbf24;');
  expect(css).toContain('.overview-runtime-detail-reading.is-disconnected { border-left: 3px solid #fbbf24; }');
  expect(editorCss).toContain('.overview-element.is-selected {\n  outline: 2px');expect(css).toContain('.overview-editor-chrome');
 });
 it.each(['NUMERIC_LABEL','VALUE_BADGE','STATUS_LIGHT','TEXT_LABEL'] as const)('%s shares Caption/reading/status/action allocation between representative Edit and View',type=>{
  const f=configuration(1,type);f.element.width=320;f.element.height=120;const before=JSON.stringify(f.element);
  const edit=render(<EditorMonitoring element={f.element} resolution={f.resolution}/>),view=render(<RuntimeMonitoringView element={f.element} presentation={runtimePresentation(f.element,f.resolution,sampleItem(1,type==='STATUS_LIGHT'?false:8888.88),'Connected')} age=""/>);
  for(const token of ['has-status-row','has-action-slot','has-caption','overview-runtime-reading','overview-runtime-abnormal']){expect(edit).toContain(token);expect(view).toContain(token);}
  expect(edit.match(/class="overview-runtime-reading".*?<\/span><\/span>/)?.[0]).toBe(view.match(/class="overview-runtime-reading".*?<\/span><\/span>/)?.[0]);expect(JSON.stringify(f.element)).toBe(before);
 });
 it('Edit never accesses Runtime hooks; selection/Binding chrome and no invented caption remain',()=>{
  const spies=(['useOverviewRuntime','useRuntimeItem','useRuntimeClock','useRuntimeStatus'] as const).map(key=>vi.spyOn(provider,key).mockImplementation(()=>{throw new Error('No Runtime in Edit');}));
  try {const f=configuration();f.element.style.text='';const html=render(<ElementNode {...({data:{element:f.element,mode:'EDIT',bindingResolution:f.resolution},selected:false} as any)}/>);expect(html).toContain('EDITOR PREVIEW');expect(html).toContain('BOUND');expect(html).not.toContain('overview-runtime-caption');spies.forEach(spy=>expect(spy).not.toHaveBeenCalled());}finally{spies.forEach(spy=>spy.mockRestore());}
 });
 it.each([true,false])('Light %s remains symbol-distinct, read-only and accessible with Show Text On/Off',value=>{
  const f=configuration(1,'STATUS_LIGHT');f.element.width=180;f.element.height=100;
  for(const showText of [true,false]){f.element.style.showText=showText;const html=render(<RuntimeMonitoringView element={f.element} presentation={runtimePresentation(f.element,f.resolution,sampleItem(1,value),'Connected')} age=""/>);
   expect(html).toContain(`lamp-${value}`);expect(html).toContain(value?'●':'−');expect(html).toContain(value?'TRUE':'FALSE');expect(html).toMatch(new RegExp(`${showText?'overview-runtime-number':'overview-runtime-sr'}"[^>]*>${value?'TRUE':'FALSE'}`));expect(html).not.toMatch(/role="switch"|aria-pressed|<button/);}
 });
 it.each(['none','BAD','DISCONNECTED','unsupported'] as const)('Light %s cannot look like FALSE; full qualifier survives small-element mode',state=>{
  const f=configuration(1,'STATUS_LIGHT');if(state==='unsupported')f.element.binding.dataType='String';
  const item=state==='none'||state==='unsupported'?undefined:sampleItem(1,false,state);
  const html=render(<RuntimeMonitoringView element={f.element} presentation={runtimePresentation(f.element,f.resolution,item,'Connected')} age=""/>);
  expect(html).toContain('lamp-unavailable');expect(html).toContain('>?</i>');expect(html).not.toContain('lamp-false');expect(html).toContain(state==='none'?'No data':state==='unsupported'?'Unsupported':state==='BAD'?'BAD':'Disconnected');expect(html).toContain('overview-runtime-attention');
 });
 it.each([[24,24],[48,48],[128,40]] as const)('small %s×%s prioritizes primary reading and critical marker; Page Details is still native/accessible', (width,height)=>{
  const f=configuration();f.element.width=width;f.element.height=height;const before=JSON.stringify(f.element),layout=canvasMonitoringLayout(f.element);
  const html=render(<RuntimeMonitoringView element={f.element} presentation={runtimePresentation(f.element,f.resolution,sampleItem(1,1.123456789,'BAD'),'Connected')} age="" onDetails={()=>{}}/>);
  expect(layout.inlineAction).toBe(false);expect(html).not.toContain('<button');expect(html).toContain('Page Runtime details and safety');expect(html).toContain('has-status-marker');expect(html).toContain('overview-runtime-attention');
  expect(html).toContain('1.123456789');const panel=render(<RuntimeSafetyPanel id="safety" origin={{current:null}} selection={f.selection} elements={[f.element]} message="Read only" onClose={()=>{}} onDetails={()=>{}}/>);expect(panel).toContain('— Runtime details</button>');expect(JSON.stringify(f.element)).toBe(before);
 });
 it.each(['STATIC_TEXT','STATIC_IMAGE','PICTURE_BOX','RECTANGLE','PANEL','DIVIDER','NAVIGATION_LINK','PUSH_BUTTON'] as const)('%s empty Text has no visible generic type-name fallback in either mode',type=>{
  const e=createOverviewElement(type,{id:'empty',x:0,y:0});e.style.text='';for(const mode of ['EDIT','VIEW'] as const){const html=node(e,mode),text=plain(html);expect(text).not.toMatch(/Static text|Picture|Image|Push|Link/);if(type==='STATIC_IMAGE'||type==='PICTURE_BOX'){expect(html).toContain('overview-element__preview--picture');expect(html).toContain('<svg');}if(type==='DIVIDER')expect(html).toContain('overview-element__preview--divider');}
 });
 it.each(['SWITCH','PUSH_BUTTON'] as const)('%s has exactly one visible Preview marker plus full accessible warning, not Binding diagnostics',type=>{
  const f=configuration(1,type);const html=render(<ElementNode {...({data:{element:f.element,mode:'VIEW',bindingResolution:f.resolution},selected:false} as any)}/>);
  expect(plain(html).match(/PREVIEW ONLY/g)).toHaveLength(1);expect(html).toContain(CONTROL_PREVIEW_DESCRIPTION);expect(html).toContain('aria-describedby="overview-preview-description-');expect(html).not.toContain('CONTROL RUNTIME NOT ENABLED');expect(html).not.toContain('overview-element__resolution');expect(html).not.toContain('overview-runtime-value');expect(f.selection.sources).toEqual([]);
 });
 it('Navigation uses directional glyph/link treatment, not a Preview/quality/command surface',()=>{
  const e=createOverviewElement('NAVIGATION_LINK',{id:'nav',x:0,y:0});e.style.text='Open panel';const html=node(e,'VIEW');expect(html).toContain('lucide-arrow-up-right');expect(html).toContain('Open panel');expect(html).toContain('aria-label="Open target Workflow"');expect(html).not.toMatch(/PREVIEW ONLY|overview-runtime-value|aria-pressed/);expect(editorCss).toContain('text-decoration: underline');
 });
});
describe('dev.15 background test surfaces (SSR/style contracts, NOT measured Browser contrast)',()=>{
 it.each(['#101820','#f5f5f5','#8f00ff'])('Owner Page background %s is untouched across alpha/frame/overall-opacity combinations',pageColor=>{
  for(const backgroundOpacity of [0,.5,1])for(const showBorder of [false,true])for(const opacity of [1,.4]){
   const e=createOverviewElement('STATUS_LIGHT',{id:'contrast',x:16,y:32});Object.assign(e.style,{backgroundColor:'rgba(12, 24, 36, 0.72)',textColor:'#e6eef5',borderColor:'#547080',backgroundOpacity,showBorder,opacity});const before=JSON.stringify(e);
   const html=render(<div style={{backgroundColor:pageColor}}><ElementNode {...({data:{element:e,mode:'EDIT'},selected:false} as any)}/></div>);
   expect(html).toContain(`background-color:${pageColor}`);expect(html).toContain('color:#e6eef5');expect(html).toContain(`opacity:${opacity}`);expect(html).toContain(`border:1px solid ${showBorder?'#547080':'transparent'}`);expect(html).toContain('overview-runtime-lamp');
   if(backgroundOpacity!==1)expect(html).toContain(`background:rgba(12, 24, 36, 0.72);opacity:${backgroundOpacity}`);expect(JSON.stringify(e)).toBe(before);
  }
 });
 it.each(OVERVIEW_ALL_ELEMENT_TYPES)('%s keeps all persisted style/geometry unchanged with transparent background and hidden frame',type=>{
  const e=createOverviewElement(type,{id:'all',x:16,y:32});e.style.backgroundOpacity=0;e.style.showBorder=false;const before=JSON.stringify(e);const html=node(e,'VIEW');expect(html).toContain('border:1px solid transparent');expect(html).toContain(`width:${e.width}px;height:${e.height}px`);expect(JSON.stringify(e)).toBe(before);
 });
 it('focus uses inset two-tone paint, selection remains separate, and transparent surfaces gain no automatic fill',()=>{
  expect(css).toContain('.overview-element .overview-runtime-detail-button:focus-visible { outline: 2px solid #fff;');expect(css).toContain('box-shadow: inset 0 0 0 4px #111');expect(editorCss).toContain('.overview-element .overview-element__preview--interactive:focus-visible');expect(editorCss).toContain('.overview-element.is-selected');
  const f=configuration();f.element.style.backgroundOpacity=0;const html=node(f.element,'EDIT');expect(html).toContain('background:transparent');expect(html).toContain('opacity:0');
 });
});
