import { z } from 'zod';

const draftId = z.union([z.string().uuid(), z.literal('')]).optional();
const source = z.discriminatedUnion('sourceType', [
  z.object({ sourceType: z.literal('WORKFLOW_VARIABLE'), workflowId: draftId, variableId: draftId }).strict(),
  z.object({ sourceType: z.literal('SHARED_TAG'), sourceId: draftId }).strict(),
]);
const binding = z.object({
  source,
  tagId: z.string(), tagName: z.string(),
  dataType: z.enum(['Boolean', 'Number', 'String', 'Unknown']),
  direction: z.enum(['MONITOR', 'COMMAND', 'NONE']),
}).strict();
/** Additive validation for O2 identities only; never migrates O1 free-text fields. */
export function validateOverviewIdentity(element: { type: string; [key: string]: unknown }, context: z.RefinementCtx): void {
  const config = element.binding;
  if (config && typeof config === 'object' && 'source' in config && config.source !== undefined) {
    const parsed = binding.safeParse(config);
    if (!parsed.success || element.type === 'NAVIGATION_LINK') {
      context.addIssue({ code: 'custom', message: 'Invalid configuration-only Source identity; derived status and Runtime fields must not be persisted', path: ['binding'] });
    }
  }
  if (element.targetWorkflowId !== undefined && (element.type !== 'NAVIGATION_LINK' || !z.union([z.string().uuid(), z.literal('')]).safeParse(element.targetWorkflowId).success)) {
    context.addIssue({ code: 'custom', message: 'Navigation target must be a Workflow UUID on NAVIGATION_LINK only', path: ['targetWorkflowId'] });
  }
}
