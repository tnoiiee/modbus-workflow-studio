import { describe,expect,it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { ElementNode } from './ElementNode.js';
import { configuration } from '../../lib/overviewRuntimeFixtures.js';
describe('B3 preserves independent preview-only controls',()=>{
 it.each(['SWITCH','PUSH_BUTTON'] as const)('%s remains Preview, never Runtime selection',type=>{const f=configuration(1,type);const html=renderToStaticMarkup(<ElementNode {...({data:{element:f.element,mode:'VIEW',bindingResolution:f.resolution,controlValue:true},selected:false} as any)}/>);expect(html).toContain('PREVIEW');expect(html).toContain('PREVIEW ONLY');expect(html).not.toContain('overview-runtime-value');expect(f.selection.sources).toEqual([]);});
 it('Navigation Link stays navigation-only',()=>{const f=configuration(1,'NAVIGATION_LINK');const html=renderToStaticMarkup(<ElementNode {...({data:{element:f.element,mode:'VIEW',bindingResolution:f.resolution},selected:false} as any)}/>);expect(html).toContain('Open target Workflow');expect(html).not.toContain('overview-runtime-value');});
 it('Edit monitoring stays EDITOR PREVIEW with existing Binding status',()=>{const f=configuration();const html=renderToStaticMarkup(<ElementNode {...({data:{element:f.element,mode:'EDIT',bindingResolution:f.resolution},selected:false} as any)}/>);expect(html).toContain('Editor Preview');expect(html).toContain('BOUND');expect(html).toContain('overview-runtime-value');expect(html).toContain('EDITOR PREVIEW');expect(html).toContain('8888.88');});
 it('new runtime modules contain no command/Device/Workflow/Page persistence path',()=>{for(const path of ['../../lib/overviewRuntimeStore.ts','../../lib/overviewTagClientAdapter.ts','./RuntimeMonitoring.tsx','./RuntimeDetails.tsx']){const source=readFileSync(new URL(path,import.meta.url),'utf8');expect(source).not.toMatch(/\/api\/devices|\/write(?![a-zA-Z])|\/run(?![a-zA-Z])|manual-trigger|LIVE_ARMED|updateOverviewPage|patchOverviewControlState|App\.load/);}});
});
