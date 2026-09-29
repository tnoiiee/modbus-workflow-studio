import type { Express, Request, Response } from 'express';
import { z, ZodError } from 'zod';
import type { AcquisitionConfig } from './acquisitionConfig.js';
/** Configuration CRUD only. These routes never read or expose runtime samples. */
export function registerAcquisitionRoutes(app: Express, config: AcquisitionConfig) {
  const handle = (action: (q: Request, r: Response) => void) => (q: Request, r: Response) => {
    try { action(q, r); } catch (error) {
      const status = error instanceof ZodError ? 400 : (error as { status?: number }).status ?? 500;
      r.status(status).json({ error: error instanceof ZodError ? `Invalid acquisition mapping / unsupported codec: ${error.issues.map(i => i.message).join('; ')}` : status === 500 ? 'Unable to persist acquisition configuration' : (error as Error).message });
    }
  };
  const route = '/api/shared-tag-acquisition';
  app.get(route, handle((_q, r) => { r.json(config.list().map(mapping => ({ mapping, availability: config.availability(mapping) }))); }));
  app.get(`${route}/:sourceId`, handle((q, r) => {
    const id = z.string().uuid().parse(q.params.sourceId), mapping = config.get(id);
    r.json({ mapping: mapping ?? null, availability: mapping ? config.availability(mapping) : 'UNCONFIGURED' });
  }));
  app.put(`${route}/:sourceId`, handle((q, r) => {
    const id = z.string().uuid().parse(q.params.sourceId);
    if (q.body?.sourceId !== id) { r.status(400).json({ error: 'sourceId must match the stable route identity' }); return; }
    const mapping = config.put(q.body); r.json({ mapping, availability: config.availability(mapping) });
  }));
  app.delete(`${route}/:sourceId`, handle((q, r) => { config.delete(z.string().uuid().parse(q.params.sourceId)); r.json({ ok: true }); }));
}
