import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import { once } from 'node:events';
import { WebSocket, WebSocketServer } from 'ws';
import { deliveryFixture } from './tagDeliveryFixtures.js';
import { installTagUpgrade } from '../src/tagUpgrade.js';
import { tagOriginPolicy, DeliveryRate } from '../src/tagDeliveryAdmission.js';
const cleanup: Array<() => void | Promise<void>>=[]; afterEach(async()=>{for(const fn of cleanup.splice(0).reverse())await fn();});
async function setup() {
 const f=deliveryFixture(),server=http.createServer(),legacy=new WebSocketServer({noServer:true});
 legacy.on('connection',ws=>ws.send(JSON.stringify({type:'hello',data:{version:'1.4.0-dev.13'},revision:0})));
 const transport=installTagUpgrade(server,legacy,f.broker,tagOriginPolicy({TAG_ALLOWED_ORIGINS:'https://trusted.invalid'}));
 server.listen(0,'127.0.0.1');await once(server,'listening');
 cleanup.push(()=>new Promise<void>(resolve=>{transport.dispose();for(const c of legacy.clients)c.terminate();legacy.close();f.cleanup();server.close(()=>resolve());}));
 return {...f,server,legacy,transport,base:`ws://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`};
}
describe('single upgrade dispatcher and admission',()=>{
 it('routes legacy unchanged, Tag separately, rejects unknown paths and enforces Origin',async()=>{
  const f=await setup(); expect(f.server.listenerCount('upgrade')).toBe(1);
  const old=new WebSocket(f.base+'/ws/live');const [hello]=await once(old,'message');expect(JSON.parse(String(hello))).toEqual({type:'hello',data:{version:'1.4.0-dev.13'},revision:0});old.close();
  const tag=new WebSocket(f.base+'/ws/tag-runtime',{origin:'https://trusted.invalid'});await once(tag,'open');const snap=f.broker.snapshot([f.source]);
  tag.send(JSON.stringify({protocolVersion:1,requestId:'s',type:'subscribe',generation:1,sources:[f.source],selectionKey:snap.selectionKey,cursor:snap.cursor}));const [data]=await once(tag,'message');expect(JSON.parse(String(data)).type).toBe('subscribed');tag.close();
  for(const [route,origin,status] of [['/unknown',undefined,404],['/ws/tag-runtime','https://evil.invalid',403]] as const){
   const ws=new WebSocket(f.base+route,{origin});const response=await new Promise<number>(resolve=>{ws.on('unexpected-response',(_q,r)=>{resolve(r.statusCode!);r.resume();ws.terminate();});ws.on('error',()=>{});});expect(response).toBe(status);
  }
 });
 it('connection cap/rate and shutdown cleanup remain bounded',async()=>{
  const f=await setup();const clients:WebSocket[]=[];
  for(let i=0;i<16;i++){const ws=new WebSocket(f.base+'/ws/tag-runtime');clients.push(ws);await once(ws,'open');}
  const extra=new WebSocket(f.base+'/ws/tag-runtime');const status=await new Promise<number>(resolve=>{extra.on('unexpected-response',(_q,r)=>{resolve(r.statusCode!);r.resume();extra.terminate();});extra.on('error',()=>{});});expect(status).toBe(429);
  expect(f.transport.sessions.size).toBe(16);f.transport.dispose();expect(f.transport.sessions.size).toBe(0);expect(f.server.listenerCount('upgrade')).toBe(0);clients.forEach(ws=>ws.terminate());
 });
 it('missing Origin is configurable, null/untrusted origins rejected, same host supported',()=>{
  const request=(origin?:string)=>({headers:{host:'localhost:8080',...(origin?{origin}:{})}} as any);
  expect(tagOriginPolicy({})(request())).toBe(true);expect(tagOriginPolicy({TAG_ALLOW_MISSING_ORIGIN:'false'})(request())).toBe(false);
  expect(tagOriginPolicy({})(request('null'))).toBe(false);expect(tagOriginPolicy({})(request('https://localhost:8080'))).toBe(true);
  expect(tagOriginPolicy({})(request('https://evil.invalid'))).toBe(false);expect(()=>tagOriginPolicy({TAG_ALLOWED_ORIGINS:'*'})).toThrow();
 });
 it('rate bucket cannot accumulate unbounded credits or per-client keys',()=>{let now=0;const rate=new DeliveryRate(2,4,()=>now);for(let i=0;i<4;i++)expect(rate.take()).toBe(true);expect(rate.take()).toBe(false);now=100000;for(let i=0;i<4;i++)expect(rate.take()).toBe(true);expect(rate.take()).toBe(false);});
});
