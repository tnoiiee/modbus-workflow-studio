import { describe, expect, it } from 'vitest';
import { configuration, id } from './overviewRuntimeFixtures.js';
import { overviewRuntimeSelection, runtimeViewAllowed } from './overviewRuntimeSelection.js';
import { canonicalTagSelection } from './tagDeliveryProtocol.js';
import { resolveOverviewBinding } from './overviewBinding.js';
import type { OverviewElementType } from './overviewElements.js';
describe('B3 canonical eligible selection', () => {
  it.each(['NUMERIC_LABEL','STATUS_LIGHT','VALUE_BADGE','TEXT_LABEL'] as OverviewElementType[])('includes explicit BOUND %s (String availability only)', type => { const f = configuration(1,type); expect(f.selection.sources).toEqual([{ sourceType:'SHARED_TAG',sourceId:id() }]); });
  it.each(['SWITCH','PUSH_BUTTON','NAVIGATION_LINK','STATIC_TEXT','RECTANGLE','PANEL','DIVIDER','STATIC_IMAGE','PICTURE_BOX'] as OverviewElementType[])('excludes %s', type => expect(configuration(1,type).selection.sources).toEqual([]));
  it.each(['hidden','incomplete','legacy','variable','missing','disabled','incompatible','direction'])('excludes %s', scenario => {
    const f=configuration();
    if(scenario==='hidden')f.element.visible=false;
    if(scenario==='incomplete')f.element.binding.source={sourceType:'SHARED_TAG'};
    if(scenario==='legacy'){delete f.element.binding.source;f.element.binding.tagId=id();}
    if(scenario==='variable')f.element.binding.source={sourceType:'WORKFLOW_VARIABLE',workflowId:id(2),variableId:id()};
    if(scenario==='disabled')f.definition.enabled=false;
    if(scenario==='incompatible')f.element.binding.dataType='Boolean';
    if(scenario==='direction')f.element.binding.direction='NONE';
    const resolution=resolveOverviewBinding(f.element,{definitions:scenario==='missing'?[]:[f.definition],available:true});
    expect(overviewRuntimeSelection([f.element],{[f.element.id]:resolution}).sources).toEqual([]);
  });
  it('deduplicates and sorts using B2, without mutating input',()=>{
    const a=configuration(2),b=configuration(1),elements=[a.element,b.element,{...a.element,id:'duplicate'}],before=JSON.stringify(elements);
    const selected=overviewRuntimeSelection(elements,{[a.element.id]:a.resolution,[b.element.id]:b.resolution,duplicate:a.resolution});
    expect(selected.key).toBe(canonicalTagSelection([b.selection.sources[0],a.selection.sources[0]]).key);expect(selected.sources).toHaveLength(2);expect(selected.elementIds).toHaveLength(3);expect(JSON.stringify(elements)).toBe(before);
  });
  it('accepts exactly 200 Elements/identities, rejects 201 without a subset, including duplicates',()=>{
    const cases=Array.from({length:201},(_,n)=>configuration(n+1)),resolutions=Object.fromEntries(cases.map(f=>[f.element.id,f.resolution]));
    expect(overviewRuntimeSelection(cases.slice(0,200).map(f=>f.element),resolutions).sources).toHaveLength(200);
    expect(overviewRuntimeSelection(cases.map(f=>f.element),resolutions)).toMatchObject({sources:[],elementIds:[],error:expect.stringContaining('200')});
    const a=cases[0];const duplicates=Array.from({length:201},(_,n)=>({...a.element,id:String(n)}));expect(overviewRuntimeSelection(duplicates,Object.fromEntries(duplicates.map(e=>[e.id,a.resolution]))).sources).toEqual([]);
  });
  it.each([[true,'VIEW',true,true],[false,'VIEW',true,false],[true,'EDIT',true,false],[true,'VIEW',false,false]])('active/mode/ready gate %j', (active,mode,ready,expected)=>expect(runtimeViewAllowed(active as boolean,mode as string,ready as boolean,configuration().selection)).toBe(expected));
});
