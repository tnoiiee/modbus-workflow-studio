import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { TagRuntimeClient, type TagClientSocket, type TagClientIO } from './tagRuntimeClient.js';
import { canonicalTagSelection } from './tagDeliveryProtocol.js';
const source = { sourceType: 'SHARED_TAG' as const, sourceId: '11111111-1111-4111-8111-111111111111' };
const epoch = '22222222-2222-4222-8222-222222222222', subscriptionId = '33333333-3333-4333-8333-333333333333';
const item = { source, availability: 'UNCONFIGURED', reason: 'UNCONFIGURED', sample: null };
class Socket implements TagClientSocket {
  readyState=0; sent:any[]=[]; onopen:(()=>void)|null=null; onclose:(()=>void)|null=null; onerror:(()=>void)|null=null; onmessage:((event:{data:unknown})=>void)|null=null;
  send(data:string){this.sent.push(JSON.parse(data));} close(){this.readyState=3;} open(){this.readyState=1;this.onopen?.();} receive(value:unknown){this.onmessage?.({data:JSON.stringify(value)});}
}
const clients:TagRuntimeClient[]=[];
beforeEach(()=>vi.useFakeTimers());afterEach(()=>{clients.splice(0).forEach(c=>c.dispose());vi.useRealTimers();});
const flush=async()=>{await Promise.resolve();await Promise.resolve();};
function setup(deferred=false){
 const sockets:Socket[]=[], applies:Array<()=>void>=[];
 const reply={protocolVersion:1,scope:'TAG_RUNTIME',serverEpoch:epoch,cursor:'opaque-0',selectionKey:canonicalTagSelection([source]).key,capturedAt:'2026-09-28T00:00:00.000Z',items:[item]};
 const io:TagClientIO={snapshot:vi.fn(async()=>structuredClone(reply)),socket:vi.fn(()=>{const s=new Socket();sockets.push(s);return s;}),scheduleApply:callback=>{if(deferred)applies.push(callback);else callback();}};
 const client=new TagRuntimeClient([source],io);clients.push(client);
 const context=(generation=clientSocket()?.sent.find(m=>m.type==='subscribe')?.generation??1)=>({protocolVersion:1,serverEpoch:reply.serverEpoch,selectionKey:reply.selectionKey,subscriptionId,generation});
 function clientSocket(){return sockets.at(-1)!;}
 const accept=()=>{const s=clientSocket();s.open();s.receive({...context(),type:'subscribed',requestId:s.sent.at(-1).requestId,cursor:client.appliedCursor});if(deferred)applies.shift()?.();};
 return {client,io,sockets,applies,reply,context,accept,socket:clientSocket};
}
describe('headless Tag delivery',()=>{
 it('canonical selection deduplicates/sorts and never uses names',()=>{
  const b={...source,sourceId:epoch};expect(canonicalTagSelection([source,b,source]).key).toBe(canonicalTagSelection([b,source]).key);
  expect(()=>canonicalTagSelection([])).toThrow();expect(()=>canonicalTagSelection([{sourceType:'WORKFLOW_VARIABLE',workflowId:epoch,variableId:epoch}])).toThrow();expect(()=>canonicalTagSelection([{...source,name:'x'}])).toThrow();
 });
 it('does not connect until explicit start; snapshots once and subscribes exact opaque boundary',async()=>{
  const f=setup();expect(f.io.snapshot).not.toHaveBeenCalled();expect(f.io.socket).not.toHaveBeenCalled();f.client.start();f.client.start();await flush();f.accept();
  expect(f.io.snapshot).toHaveBeenCalledTimes(1);expect(f.io.socket).toHaveBeenCalledTimes(1);expect(f.socket().sent[0]).toMatchObject({type:'subscribe',cursor:'opaque-0',selectionKey:f.reply.selectionKey,sources:[source],generation:1});expect(f.client.items).toEqual([item]);expect(f.client.transport).toBe('LIVE');
 });
 it('applies replay/live zero and false without coercion, ACK only after apply',async()=>{
  const f=setup();f.client.start();await flush();f.accept();
  for(const [i,value] of [0,false].entries()){
   const sample={source,dataType:typeof value==='boolean'?'Boolean':'Number',value,hasValue:true,quality:'GOOD',reason:'READ_OK',sourceTimestamp:null,receiveTimestamp:'2026-09-28T00:00:00.000Z',stateUpdatedAt:'2026-09-28T00:00:00.000Z',serverEpoch:epoch,sampleSequence:i+1,lastGoodValue:value,lastGoodReceiveTimestamp:'2026-09-28T00:00:00.000Z'};
   f.socket().receive({...f.context(),type:'delta',fromExclusive:`opaque-${i}`,toInclusive:`opaque-${i+1}`,updates:[{deliverySequence:i+5,kind:'updated',sampleSequence:i+1,item:{...item,availability:'AVAILABLE',reason:'READ_OK',sample}}]});
   expect(f.client.items[0].sample?.value).toBe(value);expect(f.client.appliedCursor).toBe(`opaque-${i+1}`);
  }
  expect(f.socket().sent.some(m=>m.type==='ack')).toBe(false);await vi.advanceTimersByTimeAsync(100);expect(f.socket().sent.at(-1)).toMatchObject({type:'ack',cursor:'opaque-2'});
 });
 it('filtered checkpoint advances without needing consecutive sample sequences',async()=>{
  const f=setup();f.client.start();await flush();f.accept();f.socket().receive({...f.context(),type:'checkpoint',fromExclusive:'opaque-0',toInclusive:'opaque-500',updates:[]});expect(f.client.appliedCursor).toBe('opaque-500');expect(f.client.items).toEqual([item]);expect(f.client.transport).toBe('LIVE');
 });
 it.each(['gap','epoch','selection','duplicate','version'] as const)('detects %s and stops apply before new snapshot',async reason=>{
  const f=setup();f.client.start();await flush();f.accept();
  const frame={...f.context(),type:'checkpoint',fromExclusive:'opaque-0',toInclusive:'opaque-1',updates:[]};
  if(reason==='duplicate')f.socket().receive(frame);
  f.socket().receive({...frame,...(reason==='gap'?{fromExclusive:'wrong'}:reason==='epoch'?{serverEpoch:subscriptionId}:reason==='selection'?{selectionKey:'other'}:reason==='version'?{protocolVersion:9}:{})});
  expect(f.client.transport).toBe('RECOVERING');expect(f.client.appliedCursor).toBeUndefined();expect(f.client.items).toEqual([]);expect(f.client.pendingFrames).toBe(0);
 });
 it('old subscription generations and stale sockets cannot mutate the current selection',async()=>{
  const f=setup();f.client.start();await flush();f.accept();const old=f.socket(), late=old.onmessage!;
  old.receive({...f.context(99),type:'checkpoint',fromExclusive:'opaque-0',toInclusive:'wrong',updates:[]});expect(f.client.appliedCursor).toBe('opaque-0');
  old.onclose?.();await vi.advanceTimersByTimeAsync(350);await flush();f.accept();late({data:JSON.stringify({...f.context(),type:'checkpoint',fromExclusive:'opaque-0',toInclusive:'wrong',updates:[]})});expect(f.client.appliedCursor).toBe('opaque-0');expect(f.io.snapshot).toHaveBeenCalledTimes(1);
 });
 it('resume retains cached samples and original cursor without changing Device quality',async()=>{
  const f=setup();f.client.start();await flush();f.accept();const before=f.client.items;f.socket().onclose?.();expect(f.client.items).toEqual(before);
  await vi.advanceTimersByTimeAsync(350);await flush();f.accept();expect(f.io.snapshot).toHaveBeenCalledTimes(1);expect(f.socket().sent[0].cursor).toBe('opaque-0');expect(f.client.transport).toBe('LIVE');
 });
 it.each(['REPLAY_EXPIRED','CURSOR_CONTEXT_MISMATCH'])('resync-required %s obtains a new snapshot, including a new epoch',async reason=>{
  const f=setup();f.client.start();await flush();f.accept();f.reply.serverEpoch=subscriptionId;f.reply.cursor='fresh-0';
  f.socket().receive({protocolVersion:1,type:'resync-required',reason});expect(f.client.items).toEqual([]);
  await vi.advanceTimersByTimeAsync(350);await flush();f.accept();expect(f.io.snapshot).toHaveBeenCalledTimes(2);expect(f.client.appliedCursor).toBe('fresh-0');expect(f.client.transport).toBe('LIVE');
 });
 it('unsubscribe waits for acknowledgment then rejects queued or late frames',async()=>{
  const f=setup();f.client.start();await flush();f.accept();const socket=f.socket(), late=socket.onmessage!;f.client.unsubscribe();expect(socket.sent.at(-1).type).toBe('unsubscribe');
  socket.receive({...f.context(),type:'unsubscribed',requestId:socket.sent.at(-1).requestId});expect(f.client.transport).toBe('STOPPED');late({data:JSON.stringify({...f.context(),type:'checkpoint',fromExclusive:'opaque-0',toInclusive:'bad',updates:[]})});expect(f.client.items).toEqual([]);expect(vi.getTimerCount()).toBe(0);
 });
 it.each(['count','bytes','frame'] as const)('bounds pending apply %s without silent middle-frame drops',async mode=>{
  const f=setup(true);f.client.start();await flush();f.accept();
  const frame={...f.context(),type:'checkpoint',fromExclusive:'opaque-0',toInclusive:'opaque-1',updates:[],...(mode==='bytes'?{padding:'x'.repeat(60000)}:mode==='frame'?{padding:'x'.repeat(65536)}:{})};
  for(let i=0;i<(mode==='count'?65:mode==='bytes'?9:1);i++)f.socket()?.receive(frame);
  expect(f.client.transport).toBe('RECOVERING');expect(f.client.pendingBytes).toBe(0);expect(f.client.pendingFrames).toBe(0);f.applies.forEach(fn=>fn());expect(f.client.appliedCursor).toBeUndefined();
 });
 it('snapshot/identity caps, malformed items and contextual mismatch fail closed',async()=>{
  expect(()=>new TagRuntimeClient(Array(201).fill(source))).toThrow();const f=setup();f.reply.selectionKey='wrong';f.client.start();await flush();expect(f.client.transport).toBe('RECOVERING');expect(f.io.socket).not.toHaveBeenCalled();
 });
 it('dispose cancels pending snapshot, timers, queued apply and old callbacks',async()=>{
  let resolve!:(value:unknown)=>void;const f=setup();vi.mocked(f.io.snapshot).mockImplementation(()=>new Promise(r=>{resolve=r;}));f.client.start();f.client.dispose();resolve(f.reply);await flush();expect(f.io.socket).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
  const g=setup();g.client.start();await flush();g.accept();g.socket().onerror?.();g.client.dispose();await vi.advanceTimersByTimeAsync(40000);expect(g.io.socket).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
 });
 it('no automatic App/Overview activation or Device action',()=>{
  const code=readFileSync(new URL('./tagRuntimeClient.ts',import.meta.url),'utf8');expect(code).not.toMatch(/\/api\/devices|App\.load|OverviewPage|ElementNode|\/write/);
  for(const file of ['../App.tsx','../components/overview/OverviewPage.tsx','../components/overview/ElementNode.tsx'])expect(readFileSync(new URL(file,import.meta.url),'utf8')).not.toMatch(/TagRuntimeClient|ws\/tag-runtime/);
 });
 it('invalid JSON/binary messages and subscribe timeouts are bounded recovery',async()=>{
  const f=setup();f.client.start();await flush();f.accept();f.socket().onmessage?.({data:'not json'});expect(f.client.transport).toBe('RECOVERING');expect(f.client.error.length).toBeLessThanOrEqual(128);
  const g=setup();g.client.start();await flush();g.accept();g.socket().onmessage?.({data:new Uint8Array(1)});expect(g.client.transport).toBe('RECOVERING');
  const h=setup();h.client.start();await flush();await vi.advanceTimersByTimeAsync(10001);expect(h.client.transport).toBe('RECOVERING');
 });
 it('wrong request correlation and malformed sample quality cannot be accepted',async()=>{
  const f=setup();f.client.start();await flush();f.socket().open();f.socket().receive({...f.context(),type:'subscribed',requestId:'wrong',cursor:'opaque-0'});expect(f.client.transport).toBe('RECOVERING');
  const g=setup();g.client.start();await flush();g.accept();g.socket().receive({...g.context(),type:'delta',fromExclusive:'opaque-0',toInclusive:'opaque-1',updates:[{deliverySequence:1,kind:'updated',item:{...item,sample:{quality:'UNKNOWN'}}}]});expect(g.client.transport).toBe('RECOVERING');
 });
 it('reentrant consumer disposal cannot leak an ACK timer or start a fetch',async()=>{
  const f=setup();let client!:TagRuntimeClient;client=new TagRuntimeClient([source],f.io,()=>client.dispose());clients.push(client);client.start();await flush();expect(f.io.snapshot).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
 });

 it('cache byte cap applies across otherwise-valid delta frames, not just individual messages',async()=>{
  const sources=Array.from({length:200},(_,i)=>({...source,sourceId:`${i.toString(16).padStart(8,'0')}-1111-4111-8111-111111111111`}));
  const key=canonicalTagSelection(sources).key, socket=new Socket();
  const client=new TagRuntimeClient(sources,{snapshot:async()=>({protocolVersion:1,scope:'TAG_RUNTIME',serverEpoch:epoch,selectionKey:key,cursor:'c0',capturedAt:'2026-09-28T00:00:00.000Z',items:sources.map(source=>({...item,source}))}),socket:()=>socket,scheduleApply:fn=>fn()});clients.push(client);
  client.start();await flush();socket.open();const context={protocolVersion:1,serverEpoch:epoch,selectionKey:key,subscriptionId,generation:1};socket.receive({...context,type:'subscribed',requestId:socket.sent[0].requestId,cursor:'c0'});
  let completed=0;
  for(let i=0;i<20&&client.transport==='LIVE';i++){
   const updates=sources.slice(i*10,i*10+10).map((source,j)=>({deliverySequence:i*10+j+1,kind:'updated',item:{source,availability:'UNSUPPORTED',reason:'中'.repeat(256),sample:{source,dataType:'String',value:'x'.repeat(1024),hasValue:true,quality:'GOOD',reason:'中'.repeat(256),sourceTimestamp:null,receiveTimestamp:null,stateUpdatedAt:'2026-09-28T00:00:00.000Z',serverEpoch:epoch,sampleSequence:i*10+j+1,lastGoodValue:'x'.repeat(1024),lastGoodReceiveTimestamp:null}}}));
   const frame={...context,type:'delta',fromExclusive:`c${i}`,toInclusive:`c${i+1}`,updates};expect(new TextEncoder().encode(JSON.stringify(frame)).length).toBeLessThanOrEqual(65536);socket.receive(frame);completed++;
  }
  expect(completed).toBeGreaterThan(10);expect(client.transport).toBe('RECOVERING');expect(client.items).toEqual([]);
 });

});
