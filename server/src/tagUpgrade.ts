import type { Server, IncomingMessage } from 'node:http';
import { WebSocketServer } from 'ws';
import { TAG_DELIVERY_LIMITS as L } from './tagDeliveryContract.js';
import { TagSocketSession } from './tagDeliverySocket.js';
import type { TagDeliveryBroker } from './tagDeliveryBroker.js';
import { DeliveryRate } from './tagDeliveryAdmission.js';
/** Single dispatcher owns upgrade routing; legacy connection callback/envelope is untouched. */
export function installTagUpgrade(server: Server, legacy: WebSocketServer, broker: TagDeliveryBroker, origin: (request: IncomingMessage) => boolean) {
  const tags = new WebSocketServer({ noServer: true, maxPayload: L.controlBytes, perMessageDeflate: false });
  const sessions = new Map<import('ws').WebSocket, TagSocketSession>();
  const rate = new DeliveryRate(4, 16);
  const dispatch = (request: IncomingMessage, socket: import('node:stream').Duplex, head: Buffer) => {
    const reject = (status: string) => { socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); };
    const pathname = (request.url ?? '').split('?')[0];
    if (pathname === '/ws/live') { legacy.handleUpgrade(request, socket, head, ws => legacy.emit('connection', ws, request)); return; }
    if (pathname !== '/ws/tag-runtime') { reject('404 Not Found'); return; }
    if (!origin(request)) { reject('403 Origin Rejected'); return; }
    if (tags.clients.size >= L.connections || !rate.take()) { reject('429 Tag Connection Limit'); return; }
    tags.handleUpgrade(request, socket, head, ws => {
      const session = new TagSocketSession(ws, broker); sessions.set(ws, session);
      ws.once('close', () => { session.dispose(); sessions.delete(ws); });
    });
  };
  server.on('upgrade', dispatch);
  const timer = setInterval(() => { broker.prune(); for (const session of sessions.values()) session.tick(); }, L.tickMs); timer.unref();
  let disposed = false;
  const dispose = () => { if (disposed) return; disposed = true; clearInterval(timer); server.off('upgrade', dispatch); for (const [ws, session] of sessions) { session.dispose(); ws.terminate(); } sessions.clear(); tags.close(); };
  server.once('close', dispose);
  return { dispose, tags, sessions };
}
