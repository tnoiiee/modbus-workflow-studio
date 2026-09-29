import type { DefinitionWorkflow } from './sourceDefinitions.js';
/** Select through the existing App selection path; no Runtime or command dependencies. */
export async function navigateOverviewWorkflow(
  mode: 'VIEW' | 'EDIT', targetWorkflowId: string | undefined,
  listWorkflows: () => Promise<readonly DefinitionWorkflow[]>,
  selectWorkflow: (id: string) => Promise<void>, openWorkflowPage: () => void,
): Promise<void> {
  if (mode !== 'VIEW') return;
  if (!targetWorkflowId) throw Error('Missing Workflow target. Select a targetWorkflowId in Edit Mode.');
  const workflows = await listWorkflows();
  if (!workflows.some(item => item.id === targetWorkflowId)) throw Error('Missing Workflow target. No other Workflow was selected.');
  await selectWorkflow(targetWorkflowId);
  openWorkflowPage();
}
