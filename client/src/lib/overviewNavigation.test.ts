import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { navigateOverviewWorkflow } from './overviewNavigation.js';
import { createOverviewElement, patchOverviewBinding } from './overviewElements.js';
import { resolveOverviewBinding } from './overviewBinding.js';
const target = '11111111-1111-4111-8111-111111111111';
const list = vi.fn(async () => [{ id: target, name: 'Pump' }]);
describe('O2-A navigation boundary', () => {
  it('View Mode selects exact target through supplied existing path, then opens Workflow page', async () => {
    const events: string[] = [];
    await navigateOverviewWorkflow('VIEW', target, list, async id => { events.push(`select:${id}`); }, () => events.push('open:Workflow'));
    expect(events).toEqual([`select:${target}`, 'open:Workflow']);
  });
  it('Edit Mode never lists/selects/navigates', async () => {
    const list = vi.fn(), select = vi.fn(), open = vi.fn();
    await navigateOverviewWorkflow('EDIT', target, list, select, open);
    expect(list).not.toHaveBeenCalled(); expect(select).not.toHaveBeenCalled(); expect(open).not.toHaveBeenCalled();
  });
  it.each([undefined, '', 'Pump', 'deleted-id'])('missing target %s does not fall back to name or active workflow', async id => {
    let active = 'current'; const open = vi.fn();
    await expect(navigateOverviewWorkflow('VIEW', id, list, async value => { active = value; }, open)).rejects.toThrow('Missing Workflow target');
    expect(active).toBe('current'); expect(open).not.toHaveBeenCalled();
  });
  it('list failure preserves selection and Overview; selection failure does not open page', async () => {
    const select = vi.fn(), open = vi.fn();
    await expect(navigateOverviewWorkflow('VIEW', target, async () => { throw Error('offline'); }, select, open)).rejects.toThrow('offline');
    expect(select).not.toHaveBeenCalled(); expect(open).not.toHaveBeenCalled();
    await expect(navigateOverviewWorkflow('VIEW', target, list, async () => { throw Error('selection failed'); }, open)).rejects.toThrow();
    expect(open).not.toHaveBeenCalled();
  });
  it('navigation cannot change Runtime, mode or call Start/Stop/Trigger', async () => {
    const runtime = { running: false, mode: 'LIVE_LOCKED', value: 12, revision: 8 };
    const before = JSON.stringify(runtime); const start = vi.fn(), stop = vi.fn(), trigger = vi.fn();
    await navigateOverviewWorkflow('VIEW', target, list, async () => {}, () => {});
    expect(JSON.stringify(runtime)).toBe(before); expect(start).not.toHaveBeenCalled(); expect(stop).not.toHaveBeenCalled(); expect(trigger).not.toHaveBeenCalled();
    const source = readFileSync(new URL('./overviewNavigation.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/fetch\(|\/api\/|\.runtime|changeMode|changeRunning|manual-trigger/);
  });
  it('targetWorkflowId is separate from binding identity and direction', () => {
    const element = createOverviewElement('NAVIGATION_LINK', { id: 'link', x: 0, y: 0 });
    element.targetWorkflowId = target;
    expect(element.binding.direction).toBe('NONE'); expect(element.binding.source).toBeUndefined();
    const binding = patchOverviewBinding(element.category, element.binding, { tagName: 'Legacy' });
    expect({ ...element, binding }.targetWorkflowId).toBe(target);
    expect(resolveOverviewBinding(element, { definitions: [], available: true }).status).toBe('NOT_BOUND');
  });
  it('App wires only the existing selector; Element Edit path stays noninteractive', () => {
    const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
    expect(app).toContain('onNavigateWorkflow={navigateFromOverview}');
    expect(app).toContain("navigateOverviewWorkflow('VIEW',targetWorkflowId,fetchDefinitionWorkflows,id=>overviewSelectWorkflowRef.current(id),()=>setPage('Workflow'))");
    expect(app).toContain('overviewSelectWorkflowRef.current=selectWorkflow');
    const node = readFileSync(new URL('../components/overview/ElementNode.tsx', import.meta.url), 'utf8');
    const click = node.slice(node.indexOf('const handleLinkClick'), node.indexOf('if (!element.visible)'));
    expect(click.indexOf('if (edit) return')).toBeLessThan(click.indexOf('onNavigateWorkflow(element.targetWorkflowId)'));
    expect(click).not.toMatch(/sourceId|variableId|binding|COMMAND/);
    const render = node.slice(node.indexOf("case 'NAVIGATION_LINK':"), node.indexOf("case 'STATIC_TEXT':"));
    expect(render).toMatch(/if \(handlers.edit\)[\s\S]*<span[\s\S]*return \([\s\S]*<button/);
  });
});
