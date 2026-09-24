import type { Express } from 'express';
import { z } from 'zod';
import type { OverviewPageManager } from './overviewPages.js';
import { OverviewControlStateStore, overviewControlValueSchema } from './overviewControlStates.js';

export function registerOverviewControlRoutes(app: Express, overviewPageManager: OverviewPageManager, overviewControlStore: OverviewControlStateStore): void {
const overviewIdSchema = z.string().uuid();
app.get('/api/overview-control-states/:pageId',(q,r)=>{
  if(!overviewIdSchema.safeParse(q.params.pageId).success)return r.status(400).json({error:'Invalid Overview page ID'});
  const page=overviewPageManager.get(q.params.pageId);
  if(!page)return r.status(404).json({error:'Overview page not found'});
  const independent=new Map(overviewControlStore.listForPage(page.id).map(item=>[item.elementId,item]));
  const effective=[];
  for(const element of page.elements){
    const category=String((element as{category?:unknown}).category??'');
    if(category!=='CONTROL'||element.type!=='SWITCH')continue;
    const record=independent.get(element.id);
    if(record){effective.push(record);continue;}
    const legacy=(element as{controlState?:{value?:unknown;updatedAt?:unknown}}).controlState;
    if(legacy&&typeof legacy.value==='boolean'){
      effective.push({pageId:page.id,elementId:element.id,value:legacy.value,updatedAt:typeof legacy.updatedAt==='string'?legacy.updatedAt:page.modifiedAt});
    }
  }
  r.json(effective);
});
app.patch('/api/overview-control-states/:pageId/:elementId',(q,r)=>{
  if(!overviewIdSchema.safeParse(q.params.pageId).success)return r.status(400).json({error:'Invalid Overview page ID'});
  const elementId=String(q.params.elementId??'');
  if(!elementId)return r.status(400).json({error:'Invalid Overview element ID'});
  const parsed=overviewControlValueSchema.safeParse(q.body);
  if(!parsed.success)return r.status(400).json({error:'Valid control-state value is required'});
  const page=overviewPageManager.get(q.params.pageId);
  if(!page)return r.status(404).json({error:'Overview page not found'});
  const element=page.elements.find(item=>item.id===elementId);
  if(!element)return r.status(404).json({error:'Overview element not found'});
  const category=String((element as{category?:unknown}).category??'');
  if(category!=='CONTROL')return r.status(400).json({error:'Control state is only valid on CONTROL elements'});
  if(element.type!=='SWITCH')return r.status(400).json({error:`Unsupported control type: ${element.type}`});
  // Independent store only — never mutates Page JSON or page.revision.
  try { r.json(overviewControlStore.set(page.id,element.id,parsed.data.value)); }
  catch { r.status(500).json({error:'Unable to persist control state'}); }
});
}
