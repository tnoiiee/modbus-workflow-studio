import { afterEach, describe, expect, it, vi } from 'vitest';
import { OverviewRuntimeStore } from './overviewRuntimeStore.js';
import { sampleItem, id, configuration } from './overviewRuntimeFixtures.js';
afterEach(()=>vi.useRealTimers());
describe('B3 isolated bounded presentation store',()=>{
 it('publishes atomically, reuses unchanged objects and notifies only dependent keys',()=>{
  const s=new OverviewRuntimeStore(),a=vi.fn(),b=vi.fn(),allowed=new Set([id(),id(2)]);s.subscribeItem(id(),a);s.subscribeItem(id(2),b);s.publish([sampleItem(),sampleItem(2)],allowed);const old=s.getItem(id(2));a.mockClear();b.mockClear();s.publish([sampleItem(1,5),sampleItem(2)],allowed);expect(a).toHaveBeenCalledTimes(1);expect(b).not.toHaveBeenCalled();expect(s.getItem(id(2))).toBe(old);expect(Object.isFrozen(s.getItem(id())!.sample)).toBe(true);
 });
 it('checkpoint/equal data never notify values or change stable references',()=>{const s=new OverviewRuntimeStore(),fn=vi.fn();s.subscribeItem(id(),fn);s.publish([sampleItem()],new Set([id()]));const old=s.getItem(id());fn.mockClear();s.publish([sampleItem()],new Set([id()]));expect(fn).not.toHaveBeenCalled();expect(s.getItem(id())).toBe(old);});
 it('rejects byte/count/unselected/duplicate identities atomically',()=>{const s=new OverviewRuntimeStore(),allowed=new Set([id()]);s.publish([sampleItem()],allowed);const old=s.getItem(id());expect(()=>s.publish([{...sampleItem(),reason:'x'.repeat(524288)}],allowed)).toThrow();expect(()=>s.publish(Array(201).fill(sampleItem()),allowed)).toThrow();expect(()=>s.publish([sampleItem(2)],allowed)).toThrow();expect(()=>s.publish([sampleItem(),sampleItem()],allowed)).toThrow();expect(s.getItem(id())).toBe(old);expect(s.payloadBytes).toBeLessThanOrEqual(524288);});
 it('does not mutate Page/Draft/revision/history/geometry/viewport/Control state',()=>{
  const page={revision:7,elements:[configuration().element],savedViewport:{x:4,y:5,zoom:1}},draft=structuredClone(page),history={past:[structuredClone(page)],future:[]},control={switch:true};const before=JSON.stringify({page,draft,history,control});const s=new OverviewRuntimeStore();s.publish([sampleItem()],new Set([id()]));s.setStatus('Reconnecting','Cached');s.clear();expect(JSON.stringify({page,draft,history,control})).toBe(before);
 });
 it('age clock runs at 1 Hz, stop and unsubscribe release timers/listeners',()=>{vi.useFakeTimers();const s=new OverviewRuntimeStore(),fn=vi.fn(),off=s.subscribeClock(fn),offItem=s.subscribeItem(id(),()=>{}),offStatus=s.subscribeStatus(()=>{});s.startClock();fn.mockClear();vi.advanceTimersByTime(999);expect(fn).not.toHaveBeenCalled();vi.advanceTimersByTime(1);expect(fn).toHaveBeenCalledTimes(1);s.stopClock();vi.advanceTimersByTime(5000);expect(fn).toHaveBeenCalledTimes(1);off();offItem();offStatus();expect(s.observers).toBe(0);expect(vi.getTimerCount()).toBe(0);});
 it('bounds observers and isolates listener errors',()=>{const s=new OverviewRuntimeStore(),off=Array.from({length:300},()=>s.subscribeItem(id(),()=>{}));expect(s.observers).toBe(256);off.forEach(f=>f());s.subscribeItem(id(),()=>{throw Error('view');});expect(()=>s.publish([sampleItem()],new Set([id()]))).not.toThrow();});
});
