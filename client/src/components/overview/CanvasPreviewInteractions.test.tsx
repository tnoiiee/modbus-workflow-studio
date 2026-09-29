import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ElementNode } from './ElementNode.js';
import { createOverviewElement } from '../../lib/overviewElements.js';
// Real ElementNode callbacks with deterministic React state, not a mounted Browser test.
const h=vi.hoisted(()=>({state:[] as any[],index:0}));
vi.mock('react',async original=>({...await original<typeof import('react')>(),useCallback:(fn:any)=>fn,useState:(initial:any)=>{const i=h.index++;if(!(i in h.state))h.state[i]=initial;return[h.state[i],(value:any)=>{h.state[i]=typeof value==='function'?value(h.state[i]):value;}];}}));
beforeEach(()=>{h.state=[];h.index=0;});
const walk=(n:any):any[]=>Array.isArray(n)?n.flatMap(walk):n&&typeof n==='object'&&n.props?[n,...walk(n.props.children)]:[];
function setup(type:'SWITCH'|'PUSH_BUTTON'|'NAVIGATION_LINK',mode='VIEW'){
 const element=createOverviewElement(type,{id:'control',x:16,y:32}),preview=vi.fn(),navigate=vi.fn();element.targetWorkflowId='synthetic-workflow';
 const data={element,mode,controlValue:false,onControlStateChange:preview,onNavigateWorkflow:navigate};
 const draw=()=>{h.index=0;return (ElementNode as any).type({data,selected:false});};
 const button=(tree:any)=>walk(tree).find(n=>n.type==='button');return{element,data,preview,navigate,draw,button};
}
describe('dev.15 presentation retains independent Control/Navigation handlers',()=>{
 it('Switch issues only the existing independent Preview callback, blocks pending duplicate, and returns to confirmed state',async()=>{
  const f=setup('SWITCH'),before=JSON.stringify(f.element);let resolve!:(value:any)=>void;f.preview.mockReturnValue(new Promise(r=>{resolve=r;}));const stop=vi.fn();
  f.button(f.draw()).props.onClick({stopPropagation:stop});expect(f.preview).toHaveBeenCalledTimes(1);expect(f.preview).toHaveBeenCalledWith('control',true);let b=f.button(f.draw());expect(b.props.disabled).toBe(true);b.props.onClick({stopPropagation:stop});expect(f.preview).toHaveBeenCalledTimes(1);
  resolve({ok:true});await Promise.resolve();f.data.controlValue=true;b=f.button(f.draw());expect(b.props['aria-pressed']).toBe(true);expect(b.props.disabled).toBe(false);expect(f.navigate).not.toHaveBeenCalled();expect(JSON.stringify(f.element)).toBe(before);
 });
 it('Push pressed feedback stays transient and pointer-cancel releases without a Preview mutation or Workflow action',()=>{
  const f=setup('PUSH_BUTTON'),before=JSON.stringify(f.element),event={stopPropagation:vi.fn()};f.button(f.draw()).props.onPointerDown(event);expect(f.button(f.draw()).props.className).toContain('is-pressed');f.button(f.draw()).props.onPointerCancel(event);expect(f.button(f.draw()).props.className).not.toContain('is-pressed');expect(f.preview).not.toHaveBeenCalled();expect(f.navigate).not.toHaveBeenCalled();expect(JSON.stringify(f.element)).toBe(before);
 });
 it('Navigation retains native button keyboard semantics and invokes only existing navigation target callback',()=>{
  const f=setup('NAVIGATION_LINK'),b=f.button(f.draw());expect(b.props.type).toBe('button');expect(b.props['aria-label']).toBe('Open target Workflow');b.props.onClick({stopPropagation:vi.fn()});expect(f.navigate).toHaveBeenCalledWith('synthetic-workflow');expect(f.preview).not.toHaveBeenCalled();expect(b.props).not.toHaveProperty('aria-pressed');
 });
 it.each(['SWITCH','PUSH_BUTTON','NAVIGATION_LINK'] as const)('%s in Edit is authoring preview, never an interactive command',type=>{
  const f=setup(type,'EDIT'),tree=f.draw();expect(f.button(tree)).toBeUndefined();expect(f.preview).not.toHaveBeenCalled();expect(f.navigate).not.toHaveBeenCalled();expect(walk(tree).some(n=>n.props.className==='overview-editor-chrome')).toBe(true);
 });
});
