import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { OverviewPageManager, overviewUpdateSchema } from '../src/overviewPages.js';
import { createOverviewElement } from '../../client/src/lib/overviewElements.js';
const dirs:string[]=[];
afterEach(()=>dirs.splice(0).forEach(dir=>fs.rmSync(dir,{recursive:true,force:true})));
describe('dev.14 unchanged Server passthrough compatibility',()=>{
 it.each([undefined,{captionFontSize:11,valueFontSize:32,backgroundOpacity:0,showBorder:false},{captionFontSize:24,valueFontSize:48,backgroundOpacity:.5,showBorder:true},{captionFontSize:96,valueFontSize:96,backgroundOpacity:1,showBorder:false}])('Save/load/duplicate preserves presentation %j, viewport and unknown supported fields', fields=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mws-dev14-'));dirs.push(dir);const manager=new OverviewPageManager(dir),page=manager.first();
  const element=createOverviewElement('NUMERIC_LABEL',{id:'e',x:16,y:32});delete element.style.captionFontSize;delete element.style.valueFontSize;delete element.style.backgroundOpacity;delete element.style.showBorder;
  element.style={...element.style,...fields};(element.style as any).futurePresentation={retained:true};
  const input=overviewUpdateSchema.parse({expectedRevision:page.revision,elements:[element],layerOrder:['e'],savedViewport:{x:64,y:80,zoom:1.25}});
  const saved=manager.update(page.id,input);expect(saved.revision).toBe(page.revision+1);
  const file=path.join(dir,'overview-pages',page.id+'.json'),bytes=fs.readFileSync(file,'utf8');const reloaded=new OverviewPageManager(dir).get(page.id)!;
  expect(reloaded.elements).toEqual([element]);expect(reloaded.savedViewport).toEqual({x:64,y:80,zoom:1.25});expect(fs.readFileSync(file,'utf8')).toBe(bytes);
  const copy=manager.duplicate(page.id);expect(copy.elements[0]).toEqual({...element,id:expect.any(String)});expect(copy.savedViewport).toEqual(reloaded.savedViewport);
  expect(reloaded.elements[0]).not.toHaveProperty('sample');expect(reloaded.elements[0]).not.toHaveProperty('controlState');
  if(!fields) expect((reloaded.elements[0] as any).style).not.toHaveProperty('backgroundOpacity');
 });
 it('existing strict Binding/Source identity validation is not broadened by style passthrough',()=>{
  const element=createOverviewElement('NUMERIC_LABEL',{id:'e',x:0,y:0});element.binding={tagId:'',tagName:'',dataType:'Number',direction:'MONITOR',source:{sourceType:'SHARED_TAG',sourceId:'11111111-1111-4111-8111-111111111111'}};
  const input={expectedRevision:1,elements:[element]};expect(overviewUpdateSchema.safeParse(input).success).toBe(true);
  (element.binding as any).value=123;expect(overviewUpdateSchema.safeParse(input).success).toBe(false);
 });
});
