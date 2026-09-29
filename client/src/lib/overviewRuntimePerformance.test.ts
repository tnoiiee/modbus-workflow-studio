import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { configuration,harness,settle,sampleItem,id } from './overviewRuntimeFixtures.js';
import { overviewRuntimeSelection } from './overviewRuntimeSelection.js';
const cases:ReturnType<typeof harness>[]=[];beforeEach(()=>vi.useFakeTimers());afterEach(()=>{cases.splice(0).forEach(f=>f.adapter.stop());vi.useRealTimers();});
describe('B3 keyed rendering boundary and bounded publication',()=>{
 it('applies and ACKs before UI publication; 5 Hz coalesces only presentation',async()=>{
  const f=harness();cases.push(f);const a=configuration(),b=configuration(2);const s=overviewRuntimeSelection([a.element,b.element],{[a.element.id]:a.resolution,[b.element.id]:b.resolution});f.adapter.activate('p',s);await settle();f.accept();await vi.advanceTimersByTimeAsync(200);
  const changed=vi.fn(),untouched=vi.fn(),off=f.store.subscribeItem(id(),changed),offOther=f.store.subscribeItem(id(2),untouched);let from='cursor-0';
  for(let n=1;n<=20;n++){const item=sampleItem(1,n);item.sample!.sampleSequence=n;f.delta(from,`c${n}`,item,n);from=`c${n}`;await vi.advanceTimersByTimeAsync(10);}
  expect(f.socket().sent.some(m=>m.type==='ack')).toBe(true);expect(changed.mock.calls.length).toBeLessThanOrEqual(1);expect(untouched).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(200);expect(f.store.getItem(id())!.sample!.value).toBe(20);off();offOther();expect(f.store.observers).toBe(0);
 });
 it('checkpoint-only traffic advances ACK without notifying values',async()=>{const f=harness();cases.push(f);f.adapter.activate('p',configuration().selection);await settle();f.accept();await vi.advanceTimersByTimeAsync(200);const fn=vi.fn();f.store.subscribeItem(id(),fn);f.socket().receive({...f.context(),type:'checkpoint',fromExclusive:'cursor-0',toInclusive:'cursor-9',updates:[]});await vi.advanceTimersByTimeAsync(500);expect(fn).not.toHaveBeenCalled();expect(f.socket().sent.at(-1)).toMatchObject({type:'ack',cursor:'cursor-9'});});
 it('hidden tab cancels presentation/age/core timers and buffers',async()=>{const f=harness();cases.push(f);f.adapter.activate('p',configuration().selection);await settle();f.accept();f.delta('cursor-0','c1');f.adapter.pause(false);expect(vi.getTimerCount()).toBe(0);const bytes=f.store.payloadBytes;await vi.advanceTimersByTimeAsync(60000);expect(f.store.payloadBytes).toBe(bytes);expect(f.io.socket).toHaveBeenCalledTimes(1);});
});
