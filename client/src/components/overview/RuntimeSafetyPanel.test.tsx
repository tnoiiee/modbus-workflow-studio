import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { RuntimeSafetyAction, RuntimeSafetyPanel } from './RuntimeSafetyPanel.js';
import { configuration } from '../../lib/overviewRuntimeFixtures.js';
const h=vi.hoisted(()=>({states:[] as any[],refs:[] as any[],effects:[] as any[],pending:[] as Array<()=>void>,si:0,ri:0,ei:0}));
vi.mock('react',async original=>({...await original<typeof import('react')>(),useId:()=> 'safety',
 useState:(initial:any)=>{const i=h.si++;if(!(i in h.states))h.states[i]=initial;return[h.states[i],(v:any)=>{h.states[i]=typeof v==='function'?v(h.states[i]):v;}];},
 useRef:(initial:any)=>{const i=h.ri++;return h.refs[i]??(h.refs[i]={current:initial});},
 useEffect:(fn:any,deps:any[])=>{const i=h.ei++,old=h.effects[i];if(!old||deps.some((v,j)=>v!==old.deps[j]))h.pending.push(()=>{old?.cleanup?.();h.effects[i]={deps,cleanup:fn()};});},
}));
vi.mock('react-dom',async original=>({...await original<typeof import('react-dom')>(),createPortal:(content:any)=>content}));
beforeEach(()=>{vi.unstubAllGlobals();h.states=[];h.refs=[];h.effects=[];h.pending=[];h.si=h.ri=h.ei=0;});
const begin=()=>{h.si=h.ri=h.ei=0;};const flush=()=>h.pending.splice(0).forEach(f=>f());
const walk=(n:any):any[]=>Array.isArray(n)?n.flatMap(walk):n&&typeof n==='object'&&n.props?[n,...walk(n.props.children)]:[];
describe('dev.14 safety UI focus/hand-off contracts (deterministic stand-ins, not Browser geometry)',()=>{
 it('closed action has no mounted/focusable panel; button opens and toggles local UI only',()=>{
  const f=configuration(),details=vi.fn();const render=()=>{begin();const t=RuntimeSafetyAction({selection:f.selection,elements:[f.element],message:'READ_ONLY',onDetails:details});flush();return t;};
  let t=render();expect(walk(t).find(n=>n.type===RuntimeSafetyPanel)).toBeUndefined();let button=walk(t).find(n=>n.type==='button');expect(button.props['aria-expanded']).toBe(false);
  button.props.onClick();t=render();expect(walk(t).find(n=>n.type===RuntimeSafetyPanel)).toBeDefined();button=walk(t).find(n=>n.type==='button');expect(button.props['aria-expanded']).toBe(true);button.props.onClick();
  expect(walk(render()).find(n=>n.type===RuntimeSafetyPanel)).toBeUndefined();expect(details).not.toHaveBeenCalled();
 });
 it('Element Details opens only after panel removal, with focus on stable trigger and no competing trap',()=>{
  const f=configuration(),order:string[]=[],details=vi.fn(()=>order.push('details'));const render=()=>{begin();return RuntimeSafetyAction({selection:f.selection,elements:[f.element],message:'READ_ONLY',onDetails:details});};
  let t=render();h.refs[0].current={focus:vi.fn((options:any)=>{expect(options).toEqual({preventScroll:true});order.push('origin');})};flush();walk(t).find(n=>n.type==='button').props.onClick();t=render();flush();
  walk(t).find(n=>n.type===RuntimeSafetyPanel).props.onDetails(f.element.id);expect(details).not.toHaveBeenCalled();t=render();expect(walk(t).find(n=>n.type===RuntimeSafetyPanel)).toBeUndefined();order.push('unmounted');flush();
  expect(order).toEqual(['unmounted','origin','details']);expect(details).toHaveBeenCalledTimes(1);expect(details).toHaveBeenCalledWith(f.element.id);render();flush();expect(details).toHaveBeenCalledTimes(1);
 });
 it('panel focuses Close, Escape closes, cleanup restores without scrolling and Tab is not trapped',()=>{
  const f=configuration(),close=vi.fn(),target={},document={body:{},activeElement:target as any};vi.stubGlobal('document',document);
  const origin={current:{isConnected:true,focus:vi.fn()} as any};begin();const t=RuntimeSafetyPanel({id:'panel',selection:f.selection,elements:[f.element],message:'READ_ONLY',origin,onClose:close,onDetails:vi.fn()});
  h.refs[0].current={contains:(n:any)=>n===target};h.refs[1].current={focus:vi.fn()};flush();expect(h.refs[1].current.focus).toHaveBeenCalledWith({preventScroll:true});
  const key=(key:string)=>({key,preventDefault:vi.fn(),stopPropagation:vi.fn()});const tab=key('Tab');t.props.onKeyDown(tab);expect(tab.preventDefault).not.toHaveBeenCalled();const escape=key('Escape');t.props.onKeyDown(escape);expect(close).toHaveBeenCalledOnce();expect(escape.stopPropagation).toHaveBeenCalledOnce();
  h.effects.forEach(e=>e.cleanup?.());expect(origin.current.focus).toHaveBeenCalledWith({preventScroll:true});vi.unstubAllGlobals();
 });
 it('cleanup does not steal focus moved outside the panel or focus a detached Page trigger',()=>{
  const f=configuration(),document={body:{},activeElement:{}};vi.stubGlobal('document',document);const origin={current:{isConnected:false,focus:vi.fn()} as any};begin();RuntimeSafetyPanel({id:'p',selection:f.selection,elements:[],message:'',origin,onClose:vi.fn(),onDetails:vi.fn()});h.refs[0].current={contains:()=>false};flush();h.effects.forEach(e=>e.cleanup?.());expect(origin.current.focus).not.toHaveBeenCalled();vi.unstubAllGlobals();
 });
 it('Source/CSS enforce out-of-flow layout, bounded scroll, reduced motion and no persistence/viewport/transport actions',()=>{
  const src=readFileSync(new URL('./RuntimeSafetyPanel.tsx',import.meta.url),'utf8'),css=readFileSync(new URL('../../styles/overview-runtime.css',import.meta.url),'utf8');
  expect(src).toContain('createPortal(content, document.body)');expect(src).toContain('aria-modal="false"');expect(src).not.toMatch(/fitView|setViewport|fetch\(|PUT|PATCH|updateOverviewPage|setDraft|setHistory|subscribeItem|activate\(/);
  expect(css).toContain('.overview-runtime-safety-panel { position: fixed;');expect(css).toContain('max-height: calc(100dvh - 104px)');expect(css).toContain('overflow: auto; overscroll-behavior: contain');expect(css).toContain('prefers-reduced-motion: reduce) { .overview-runtime-safety-panel { animation: none; }');expect(css).not.toContain('.overview-runtime-status > details[open]');
  const page=readFileSync(new URL('./OverviewPage.tsx',import.meta.url),'utf8');expect(page).toContain('<OverviewRuntimeStatus pageId={activePageId}');expect(page).not.toMatch(/OverviewRuntimeProvider key=|OverviewCanvas key=/);
 });
 it('safety text, small-Element list and Escape/Close remain available when open',()=>{
  const f=configuration(),close=vi.fn(),details=vi.fn();begin();const t=RuntimeSafetyPanel({id:'p',selection:f.selection,elements:[f.element],message:'READ_ONLY',origin:{current:null},onClose:close,onDetails:details});
  const buttons=walk(t).filter(n=>n.type==='button');expect(buttons).toHaveLength(2);buttons[1].props.onClick();expect(details).toHaveBeenCalledWith(f.element.id);buttons[0].props.onClick();expect(close).toHaveBeenCalledOnce();
 });
});
