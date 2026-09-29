import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it } from 'vitest';
import { deliveryFixture } from './tagDeliveryFixtures.js';
import { TagSocketSession, TagOutboundQueue } from '../src/tagDeliverySocket.js';
class Socket extends EventEmitter {
  readyState = 1; bufferedAmount = 0; frames: any[] = []; paused = false;
  send(data: string, callback?: (error?: Error) => void) { this.frames.push(JSON.parse(data)); if (!this.paused) callback?.(); }
  close() { this.readyState = 3; this.emit('close'); }
  terminate() { this.close(); }
  control(body: object) { this.emit('message', Buffer.from(JSON.stringify({ protocolVersion: 1, requestId: 'r', ...body })), false); }
}
const cleanup: Array<() => void> = []; afterEach(() => cleanup.splice(0).reverse().forEach(fn => fn()));
function setup() {
  let now = 0; const f = deliveryFixture(undefined, () => now), socket = new Socket(), session = new TagSocketSession(socket as any, f.broker, () => now);
  cleanup.push(f.cleanup, session.dispose); const snapshot = f.broker.snapshot([f.source]);
  const subscribe = (generation = 1) => socket.control({ type: 'subscribe', generation, sources: [f.source], selectionKey: snapshot.selectionKey, cursor: snapshot.cursor });
  return { ...f, socket, session, snapshot, subscribe, advance: (ms: number) => { now += ms; } };
}
describe('dedicated Tag control/delivery', () => {
  it('subscribe, replay/live range, ACK and unsubscribe define the last-delivery boundary', () => {
    const f = setup(), t = f.store.activate(f.source.sourceId, 'Number'); f.subscribe();
    const accepted = f.socket.frames.find(x => x.type === 'subscribed'), replay = f.socket.frames.find(x => x.type === 'delta');
    expect(replay.fromExclusive).toBe(f.snapshot.cursor); expect(accepted.generation).toBe(1);
    f.socket.control({ type: 'ack', subscriptionId: accepted.subscriptionId, generation: 1, cursor: replay.toInclusive });
    f.store.good(t, 1, 0); f.session.tick(); const delta = f.socket.frames.at(-1); expect(delta.fromExclusive).toBe(replay.toInclusive); expect(delta.updates[0].item.sample.value).toBe(0);
    f.socket.control({ type: 'unsubscribe', subscriptionId: accepted.subscriptionId, generation: 1 }); const count = f.socket.frames.length;
    expect(f.socket.frames.at(-1).type).toBe('unsubscribed'); f.store.good(t, 2, 8); f.session.tick(); expect(f.socket.frames).toHaveLength(count); expect(f.session.count).toBe(0);
  });
  it('filtered checkpoint advances cursor without unrelated data or a false gap', () => {
    const f = setup(); f.subscribe(); f.store.activate('11111111-1111-4111-8111-111111111111','Number'); f.session.tick();
    const checkpoint = f.socket.frames.at(-1); expect(checkpoint.type).toBe('checkpoint'); expect(checkpoint.updates).toEqual([]); expect(checkpoint.fromExclusive).toBe(f.snapshot.cursor);
    f.store.activate('22222222-2222-4222-8222-222222222222','Number'); f.session.tick(); expect(f.socket.frames.at(-1)).toBe(checkpoint);
    f.advance(250); f.session.tick(); expect(f.socket.frames.at(-1).fromExclusive).toBe(checkpoint.toInclusive);
  });
  it('idle is not ACK timeout; pending delivery without progress is', () => {
    const f = setup(); f.subscribe(); f.advance(20000); f.session.tick(); expect(f.socket.readyState).toBe(1);
    f.store.activate(f.source.sourceId,'Number'); f.session.tick(); f.advance(10001); f.session.tick(); expect(f.socket.frames.at(-1).reason).toBe('ACK_TIMEOUT'); expect(f.session.count).toBe(0);
  });
  it('ACK progress prevents false timeout and future/unknown ACKs are rejected', () => {
    const f = setup(); f.subscribe(); const accepted = f.socket.frames[0]; f.store.activate(f.source.sourceId,'Number'); f.session.tick();
    f.advance(9000); f.socket.control({ type: 'ack', generation: 1, subscriptionId: accepted.subscriptionId, cursor: f.socket.frames.at(-1).toInclusive }); f.advance(11000); f.session.tick(); expect(f.socket.readyState).toBe(1);
    f.socket.control({ type: 'ack', generation: 1, subscriptionId: '11111111-1111-4111-8111-111111111111', cursor: f.snapshot.cursor }); expect(f.socket.frames.at(-1).code).toBe('UNKNOWN_SUBSCRIPTION');
  });
  it.each([{ protocolVersion: 2, type: 'subscribe' }, { type: 'write' }, { type: 'subscribe', sources: [] }])('rejects invalid/version control %j', input => {
    const f = setup(); f.socket.control(input); expect(f.socket.frames.at(-1).type).toBe('error'); expect(f.session.count).toBe(0);
  });
  it('bounds invalid messages, oversized frames and control rates', () => {
    const f = setup(); f.socket.emit('message',Buffer.from('bad'),false); f.socket.emit('message',Buffer.from('bad'),false); f.socket.emit('message',Buffer.from('bad'),false); expect(f.socket.readyState).toBe(3);
    const large = setup(); large.socket.emit('message',Buffer.alloc(65537),false); expect(large.socket.frames.at(-1).reason).toBe('CONTROL_TOO_LARGE');
    const rate = setup(); for (let i=1;i<=5;i++) rate.subscribe(i); expect(rate.socket.frames.at(-1).reason).toBe('CONTROL_RATE_LIMIT');
  });
  it('maximum subscriptions and stale generation cannot affect accepted subscriptions', () => {
    const f = setup(); for (let i=1;i<=4;i++) f.subscribe(i); expect(f.session.count).toBe(4);
    const first = f.socket.frames[0]; f.socket.control({ type:'unsubscribe', subscriptionId:first.subscriptionId, generation:999 }); expect(f.session.count).toBe(4);
    f.advance(1000); f.subscribe(5); expect(f.socket.frames.at(-1).code).toBe('SUBSCRIPTION_LIMIT');
  });
  it('counts unique identities per connection; duplicates do not consume extra slots', () => {
    const f = setup(); const ids = Array.from({ length: 501 }, (_, n) => ({ ...f.source, sourceId: `${n.toString(16).padStart(8,'0')}-1111-4111-8111-111111111111` }));
    for (let i=0;i<3;i++) { const sources=ids.slice(i*200,Math.min((i+1)*200,501)), snap=f.broker.snapshot(sources); f.socket.control({ type:'subscribe', generation:i+1, sources, selectionKey:snap.selectionKey,cursor:snap.cursor }); }
    expect(f.session.count).toBe(2); expect(f.socket.frames.at(-1).code).toBe('CONNECTION_IDENTITY_LIMIT');
    const dup=setup(); dup.socket.control({ type:'subscribe',generation:1,sources:[dup.source,dup.source],selectionKey:dup.snapshot.selectionKey,cursor:dup.snapshot.cursor });expect(dup.session.count).toBe(1);
  });
  it('socket bufferedAmount overflow fails closed with no unsafe resync send', () => {
    const f=setup();f.subscribe(); f.socket.bufferedAmount=1024*1024+1; const count=f.socket.frames.length; f.session.tick();expect(f.socket.readyState).toBe(3);expect(f.socket.frames).toHaveLength(count);expect(f.session.count).toBe(0);
  });
  it('journal expiry during paused replay requires resync; dispose releases queues and leases', () => {
    const f=setup(); f.subscribe(); f.store.activate(f.source.sourceId,'Number');f.advance(60001); f.session.tick();expect(f.socket.frames.at(-1).reason).toBe('REPLAY_EXPIRED');
    f.session.dispose();expect(f.session.queue.count).toBe(0);expect(f.session.queue.bytes).toBe(0);expect(f.session.count).toBe(0);
  });
  it('queue count, byte and per-frame limits are independently bounded', () => {
    const count=new TagOutboundQueue(2,1024);expect(count.push({x:1})).toBe(true);expect(count.push({x:2})).toBe(true);expect(count.push({x:3})).toBe(false);
    const bytes=new TagOutboundQueue(256,20);expect(bytes.push({x:'12345'})).toBe(true);expect(bytes.push({x:'12345'})).toBe(false);
    const frame=new TagOutboundQueue();expect(frame.push({x:'a'.repeat(65536)})).toBe(false);count.clear();expect(count.bytes).toBe(0);
  });
  it('control backlog overflow explicitly resyncs rather than dropping a middle frame', () => {
    const f=setup(); f.socket.paused=true;
    for(let i=0;i<256;i++) expect(f.session.queue.push({type:'checkpoint'})).toBe(true);
    f.subscribe();expect(f.session.count).toBe(0);expect(f.socket.frames.at(-1).type).toBe('resync-required');f.session.dispose();
  });
  it('stale subscribe generation and mismatched selection/cursor cannot resume', () => {
    const f=setup();f.subscribe();f.subscribe();expect(f.socket.frames.at(-1).code).toBe('STALE_GENERATION');
    const other=setup(); other.socket.control({type:'subscribe',generation:1,sources:[other.source],selectionKey:'bad',cursor:other.snapshot.cursor});expect(other.socket.frames.at(-1).type).toBe('resync-required');
  });
  it('splits large replay/live ranges by actual frame bytes without losing an event', () => {
    const f = setup(); f.catalog.update(f.source, { dataType: 'String' }); const token = f.store.activate(f.source.sourceId, 'String'); f.subscribe();
    for (let n=1;n<=50;n++) f.store.good(token,n,'x'.repeat(1024));
    for (let n=0;n<5;n++) f.session.tick();
    const deltas=f.socket.frames.filter(frame=>frame.type==='delta'); expect(deltas.length).toBeGreaterThan(2);
    for (const frame of f.socket.frames) expect(Buffer.byteLength(JSON.stringify(frame))).toBeLessThanOrEqual(65536);
    expect(deltas.flatMap(frame=>frame.updates)).toEqual(f.broker.range(f.broker.decode(f.snapshot.cursor,f.snapshot.selectionKey)));
    for (let n=1;n<deltas.length;n++) expect(deltas[n].fromExclusive).toBe(deltas[n-1].toInclusive);
  });
  it('send failure and socket error release all subscription and queue state', () => {
    const f=setup();f.socket.send=(data,callback)=>{f.socket.frames.push(JSON.parse(data));callback?.(Error('send failed'));};f.subscribe();
    expect(f.session.count).toBe(0);expect(f.session.queue.count).toBe(0);expect(f.socket.frames.at(-1).reason).toBe('SEND_FAILED');
    const g=setup();g.subscribe();g.socket.emit('error',Error('network'));expect(g.session.count).toBe(0);expect(g.socket.readyState).toBe(3);
  });

  it('unsubscribe discards queued old frames before its acknowledgment even with an in-flight send', () => {
    const f=setup();f.subscribe();const accepted=f.socket.frames[0];let complete:()=>void=()=>{};
    f.socket.send=(data,callback)=>{f.socket.frames.push(JSON.parse(data));complete=()=>callback?.();};
    const token=f.store.activate(f.source.sourceId,'Number');f.session.tick();f.store.good(token,1,1);f.session.tick();expect(f.session.queue.count).toBe(1);
    f.socket.control({type:'unsubscribe',subscriptionId:accepted.subscriptionId,generation:1});expect(f.session.queue.count).toBe(1);
    complete();expect(f.socket.frames.at(-1).type).toBe('unsubscribed');const count=f.socket.frames.length;f.store.good(token,2,2);f.session.tick();complete();expect(f.socket.frames.length).toBe(count);expect(f.session.queue.count).toBe(0);
  });

});
