import type { DefinitionReferenceBatch, DefinitionReferenceSummary } from './definitionReferences.js';
import type { Express, Request, Response, ErrorRequestHandler } from 'express';
import { z, ZodError } from 'zod';
import { DefinitionCatalog, sourceIdentitySchema, type SourceIdentity } from './definitionCatalog.js';

export function registerDefinitionRoutes(app: Express, catalog: DefinitionCatalog, references: (identity: SourceIdentity) => DefinitionReferenceSummary, batch: (sources: SourceIdentity[]) => DefinitionReferenceBatch): void {
  const handle = (action: (request: Request, response: Response) => void) => (request: Request, response: Response) => {
    try { action(request, response); }
    catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json({ error: 'Invalid Source definition configuration', details: error.issues.map(issue => issue.message) });
      } else {
        const status = (error as { status?: number }).status ?? 500;
        response.status(status).json({ error: status === 500 ? 'Unable to persist Source definition' : (error as Error).message });
      }
    }
  };
  app.get('/api/source-definitions', handle((_request, response) => { response.json(catalog.list()); }));
  app.post('/api/source-definitions', handle((request, response) => { response.status(201).json(catalog.create(request.body)); }));
  app.post('/api/source-definitions/references/batch', (request, response) => {
    const parsed = z.object({ sources: z.array(sourceIdentitySchema).min(1).max(100) }).strict().safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'Expected sources: 1–100 valid stable Source identities; unknown fields are not allowed' });
      return;
    }
    try { response.json(batch(parsed.data.sources)); }
    catch { response.status(500).json({ error: 'Unable to load saved reference counts' }); }
  });
  // Scope parser-error sanitization to the new route; existing APIs are unchanged.
  const batchBodyError: ErrorRequestHandler = (error, _request, response, _next) => {
    response.status(error?.type === 'entity.too.large' ? 413 : 400).json({ error: 'Invalid batch reference JSON request' });
  };
  app.use('/api/source-definitions/references/batch', batchBodyError);
  const routes = [
    { path: '/api/source-definitions/shared-tags/:sourceId', identity: (r: Request) => ({ sourceType: 'SHARED_TAG', sourceId: r.params.sourceId }) },
    { path: '/api/source-definitions/workflow-variables/:workflowId/:variableId', identity: (r: Request) => ({ sourceType: 'WORKFLOW_VARIABLE', workflowId: r.params.workflowId, variableId: r.params.variableId }) },
  ];
  for (const route of routes) {
    const identity = (r: Request): SourceIdentity => sourceIdentitySchema.parse(route.identity(r));
    app.get(route.path, handle((request, response) => {
      const definition = catalog.get(identity(request));
      if (!definition) { response.status(404).json({ error: 'Source definition not found' }); return; }
      response.json(definition);
    }));
    app.get(`${route.path}/references`, handle((request, response) => {
      const source = identity(request);
      if (!catalog.get(source)) { response.status(404).json({ error: 'Source definition not found' }); return; }
      response.json(references(source));
    }));
    app.patch(route.path, handle((request, response) => { response.json(catalog.update(identity(request), request.body)); }));
    app.delete(route.path, handle((request, response) => { catalog.delete(identity(request)); response.json({ ok: true }); }));
  }
}
