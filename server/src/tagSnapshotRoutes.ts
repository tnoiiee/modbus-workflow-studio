import express, { type Express } from 'express';
import type { IncomingMessage } from 'node:http';
import { DeliveryError, snapshotSchema, TAG_DELIVERY_LIMITS as L } from './tagDeliveryContract.js';
import type { TagDeliveryBroker } from './tagDeliveryBroker.js';
import { DeliveryRate } from './tagDeliveryAdmission.js';
/** Mount BEFORE the legacy global CORS/body parser so Tag-specific limits also cover preflight. */
export function registerTagSnapshot(app: Express, broker: () => TagDeliveryBroker, origin: (request: IncomingMessage) => boolean) {
  const router = express.Router(), rate = new DeliveryRate(20, 20);
  let active = 0;
  router.use((q, r, next) => {
    r.setHeader('Cache-Control', 'no-store'); r.vary('Origin');
    if (!origin(q)) { r.status(403).json({ error: 'ORIGIN_REJECTED' }); return; }
    if (!rate.take()) { r.status(429).json({ error: 'SNAPSHOT_RATE_LIMIT' }); return; }
    if (q.headers.origin) r.setHeader('Access-Control-Allow-Origin', q.headers.origin);
    if (q.method === 'OPTIONS') { r.setHeader('Access-Control-Allow-Methods', 'POST'); r.setHeader('Access-Control-Allow-Headers', 'Content-Type'); r.sendStatus(204); return; }
    if (q.method !== 'POST') { r.status(405).json({ error: 'POST_REQUIRED' }); return; }
    if (active >= 8) { r.status(429).json({ error: 'SNAPSHOT_CONCURRENCY_LIMIT' }); return; }
    active++; let released = false;
    const deadline = setTimeout(() => { r.status(408).json({ error: 'SNAPSHOT_BODY_TIMEOUT' }); q.destroy(); }, 5000);
    const release = () => { if (!released) { released = true; active--; clearTimeout(deadline); } };
    r.once('finish', release); r.once('close', release);
    next();
  });
  router.use(express.json({ limit: L.requestBytes, strict: true, inflate: false }));
  router.post('/', (q, r) => {
    const parsed = snapshotSchema.safeParse(q.body);
    if (!parsed.success) { r.status(400).json({ error: q.body?.protocolVersion !== 1 ? 'UNSUPPORTED_PROTOCOL' : 'INVALID_SNAPSHOT_REQUEST' }); return; }
    try { r.json(broker().snapshot(parsed.data.sources)); } catch (error) { const fault = error instanceof DeliveryError ? error : new DeliveryError('DELIVERY_UNAVAILABLE', 503); r.status(fault.status).json({ error: fault.code }); }
  });
  router.use((error: { status?: number }, _q: express.Request, r: express.Response, _next: express.NextFunction) => { if (r.headersSent || r.destroyed) return; r.status(error.status === 413 ? 413 : 400).json({ error: error.status === 413 ? 'REQUEST_TOO_LARGE' : 'INVALID_JSON_BODY' }); });
  app.use('/api/tag-runtime/snapshot', router);
}
