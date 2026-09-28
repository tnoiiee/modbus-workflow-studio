import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PresentationNumberField } from './PresentationNumberField.js';

// Deterministic hook/callback harness, not a mounted browser or input-device certification.
const h=vi.hoisted(()=>({ states:[] as any[], refs:[] as any[], effects:[] as any[], si:0,ri:0,ei:0, pending:[] as Array<()=>void> }));
vi.mock('react',async original=>({...await original<typeof import('react')>(), useId:()=> 'gesture',
  useState:(initial:any)=>{const i=h.si++;if(!(i in h.states))h.states[i]=typeof initial==='function'?initial():initial;return[h.states[i],(v:any)=>{h.states[i]=typeof v==='function'?v(h.states[i]):v;}];},
  useRef:(initial:any)=>{const i=h.ri++;return h.refs[i]??(h.refs[i]={current:initial});},
  useEffect:(fn:any,deps:any[])=>{const i=h.ei++,old=h.effects[i];if(!old||deps.some((v,j)=>v!==old.deps[j])){h.pending.push(()=>{old?.cleanup?.();h.effects[i]={deps,cleanup:fn()};});}},
}));
beforeEach(()=>{h.states=[];h.refs=[];h.effects=[];h.pending=[];h.si=h.ri=h.ei=0;});
function setup(value=16,slider=false){
 const preview=vi.fn(),commit=vi.fn();let prop=value;
 const render=()=>{h.si=h.ri=h.ei=0;const tree=PresentationNumberField({label:slider?'Background Opacity':'Caption Font Size',value:prop,min:slider?0:8,max:slider?100:96,unit:slider?'%':'px',slider,onPreview:preview,onCommit:commit});h.pending.splice(0).forEach(f=>f());return(tree.props.children as any[]).filter(n=>n&&n.type==='input');};
 const key=(name:string)=>({key:name,preventDefault:vi.fn(),stopPropagation:vi.fn()});
 return{preview,commit,render,key,setProp:(n:number)=>{prop=n;},unmount:()=>h.effects.forEach(e=>e.cleanup?.())};
}
describe('dev.14 real numeric-field callbacks preserve one-gesture transaction semantics',()=>{
 it('typing previews live; Enter then blur commits exactly once',()=>{
  const f=setup();let [input]=f.render();expect(f.commit).not.toHaveBeenCalled();
  input.props.onChange({target:{value:'24'}});expect(f.preview).toHaveBeenLastCalledWith(24);
  [input]=f.render();expect(input.props.value).toBe('24');input.props.onChange({target:{value:'48'}});
  input.props.onKeyDown(f.key('Enter'));input.props.onBlur();expect(f.commit).toHaveBeenCalledTimes(1);expect(f.commit).toHaveBeenCalledWith(48);
 });
 it('Escape cancels preview and a later blur does not commit',()=>{
  const f=setup();const[input]=f.render();input.props.onChange({target:{value:'32'}});const event=f.key('Escape');input.props.onKeyDown(event);input.props.onBlur();
  expect(f.commit).not.toHaveBeenCalled();expect(f.preview).toHaveBeenLastCalledWith(null);expect(event.stopPropagation).toHaveBeenCalledOnce();expect(f.render()[0].props.value).toBe('16');
 });
 it('invalid and empty inputs never commit; Undo/parent reset replaces the baseline; unmount clears preview',()=>{
  const f=setup();const[input]=f.render();for(const value of['','7','97','Infinity']){input.props.onChange({target:{value}});input.props.onBlur();}
  expect(f.commit).not.toHaveBeenCalled();f.setProp(24);f.render();expect(f.render()[0].props.value).toBe('24');f.unmount();expect(f.preview).toHaveBeenLastCalledWith(null);
 });
 it('slider drag previews repeatedly, pointer-up + blur commits once; cancellation restores last commit',()=>{
  const f=setup(100,true);let[,range]=f.render();range.props.onChange({target:{value:'75'}});range.props.onChange({target:{value:'50'}});
  expect(f.preview).toHaveBeenLastCalledWith(50);expect(f.commit).not.toHaveBeenCalled();range.props.onPointerUp();range.props.onBlur();expect(f.commit).toHaveBeenCalledTimes(1);expect(f.commit).toHaveBeenCalledWith(50);
  [,range]=f.render();range.props.onChange({target:{value:'0'}});range.props.onPointerCancel();range.props.onPointerUp();expect(f.commit).toHaveBeenCalledTimes(1);expect(f.render()[0].props.value).toBe('50');
 });
 it('slider keyboard gesture commits on key-up; Escape restores and Enter/blur do not duplicate',()=>{
  const f=setup(100,true);const[,range]=f.render();range.props.onChange({target:{value:'0'}});range.props.onKeyUp(f.key('Home'));range.props.onBlur();expect(f.commit).toHaveBeenCalledTimes(1);expect(f.commit).toHaveBeenCalledWith(0);
  range.props.onChange({target:{value:'50'}});range.props.onKeyDown(f.key('Escape'));range.props.onKeyDown(f.key('Enter'));range.props.onBlur();expect(f.commit).toHaveBeenCalledTimes(1);
 });
 it('changing callback identities during preview does not reset user input or write the draft',()=>{
  const f=setup();f.render()[0].props.onChange({target:{value:'36'}});f.render();expect(f.render()[0].props.value).toBe('36');expect(f.commit).not.toHaveBeenCalled();
 });
});
