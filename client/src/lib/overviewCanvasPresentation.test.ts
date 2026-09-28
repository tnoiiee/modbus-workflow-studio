import { describe, expect, it } from 'vitest';
import { canvasMonitoringLayout, canvasRuntimeStatus } from './overviewCanvasPresentation.js';
import { configuration, sampleItem } from './overviewRuntimeFixtures.js';
import { runtimePresentation } from './overviewRuntimePresentation.js';
import type { ClientTagItem } from './tagDeliveryProtocol.js';

describe('dev.15 Canvas-only wording preserves canonical Runtime projection', () => {
  it.each([0, -0, -12.25, 1e20, 1e-9, 8888.88])('GOOD %s is unchanged with no extra GOOD status', value => {
    const f = configuration(), item = sampleItem(1, value), before = JSON.stringify(item);
    const p = runtimePresentation(f.element, f.resolution, item, 'Connected');
    expect(canvasRuntimeStatus(p, '', false)).toBe(''); expect(p.value).toBe(value); expect(JSON.stringify(item)).toBe(before);
  });
  it.each([true, false])('valid Boolean %s remains valid; missing is not false', value => {
    const f = configuration(1, 'STATUS_LIGHT');
    const p = runtimePresentation(f.element, f.resolution, sampleItem(1, value), 'Connected');
    expect(p.text).toBe(value ? 'TRUE' : 'FALSE'); expect(canvasRuntimeStatus(p, '', false)).toBe('');
    const missing = runtimePresentation(f.element, f.resolution, undefined, 'Connected');
    expect(missing.value).toBeNull(); expect(missing.lamp).toBe('unavailable'); expect(canvasRuntimeStatus(missing, '', false)).toBe('No data');
  });
  it.each(['UNCERTAIN','STALE','BAD','DISCONNECTED'] as const)('%s has one concise status, no raw reason and no mutation', quality => {
    const f = configuration(), item = sampleItem(1, 999, quality); item.reason = 'SYNTHETIC_READ_FAILURE'; item.sample!.lastGoodValue = 0;
    const p = runtimePresentation(f.element, f.resolution, item, 'Connected'), before = JSON.stringify(p);
    expect(canvasRuntimeStatus(p, '12s since receive', false)).toBe({ UNCERTAIN:'Uncertain', STALE:'Stale', BAD:'Historical · BAD', DISCONNECTED:'Historical · Disconnected' }[quality]);
    if (quality === 'BAD' || quality === 'DISCONNECTED') { expect(p.value).toBe(0); expect(p.historical).toBe(true); }
    expect(JSON.stringify(p)).toBe(before);
  });
  it.each(['BAD','DISCONNECTED'] as const)('%s without history never displays failed data as current', quality => {
    const f=configuration(), item=sampleItem(1,999,quality); item.sample!.lastGoodValue=null; item.sample!.lastGoodReceiveTimestamp=null;
    const p=runtimePresentation(f.element,f.resolution,item,'Connected'); expect(p.text).toBe('—'); expect(canvasRuntimeStatus(p,'',false)).toBe(quality==='BAD'?'BAD':'Disconnected');
  });
  it.each(['Reconnecting','Resynchronizing','Offline','Error'] as const)('%s preserves GOOD Device quality and marks cached data once', transport => {
    const f=configuration(),p=runtimePresentation(f.element,f.resolution,sampleItem(1,0),transport), before=JSON.stringify(p);
    expect(canvasRuntimeStatus(p,'',false)).toBe('Cached · latest received'); expect(p.quality).toBe('GOOD'); expect(JSON.stringify(p)).toBe(before);
  });
  it('age appears only in roomy presentation and remains explicit about clock limitations',()=>{
    const f=configuration(),p=runtimePresentation(f.element,f.resolution,sampleItem(1,1,'STALE'),'Connected');
    expect(canvasRuntimeStatus(p,'12s since receive',true)).toBe('Stale · 12s since receive'); expect(canvasRuntimeStatus(p,'12s since receive',false)).toBe('Stale');
    expect(canvasRuntimeStatus(p,'Age unavailable: clock skew',true)).toContain('clock skew');
  });
  it.each(['UNCONFIGURED','MAPPING_DISABLED','DEVICE_MISSING','DEVICE_DISABLED','DEFINITION_MISSING','DEFINITION_DISABLED','INCOMPATIBLE','UNSUPPORTED','NO_SAMPLE','DISCONNECTED','AVAILABLE'] as ClientTagItem['availability'][])('availability %s stays in its existing semantic category', availability=>{
    const f=configuration(),item=sampleItem(); item.availability=availability; item.reason='SYNTHETIC_DIAGNOSTIC';
    const p=runtimePresentation(f.element,f.resolution,item,'Connected'), before=JSON.stringify(p), status=canvasRuntimeStatus(p,'',false);
    expect(status).not.toContain(item.reason); expect(JSON.stringify(p)).toBe(before); if(availability==='UNSUPPORTED')expect(status).toBe('Unsupported');
  });
  it.each(['NOT_BOUND','DRAFT','MISSING','INCOMPATIBLE'] as const)('binding %s is not changed by operator wording',status=>{
    const f=configuration(),p=runtimePresentation(f.element,{...f.resolution,status},undefined,'Disposed');
    expect(canvasRuntimeStatus(p,'',false)).toMatch(/configured|Configuration|Source unavailable/);expect(p.binding).toBe(status);
  });
  it('String remains unsupported, not caption-as-value or MISSING; Edit status uses no Runtime',()=>{
    const f=configuration(1,'TEXT_LABEL');f.element.style.text='Configured caption';const p=runtimePresentation(f.element,f.resolution,undefined,'Connected');
    expect(canvasRuntimeStatus(p,'',false)).toBe('Unsupported');expect(p.text).toBe('—');expect(p.binding).toBe('BOUND');expect(canvasRuntimeStatus(p,'',false,true)).toBe('Unsupported');
  });
});
describe('dev.15 geometry-only priority policy, no persisted small-mode',()=>{
  it.each(['NUMERIC_LABEL','VALUE_BADGE','STATUS_LIGHT','TEXT_LABEL'] as const)('%s layout is pure, shared, and independent of quality/value',type=>{
    const f=configuration(1,type),before=JSON.stringify(f.element),layout=canvasMonitoringLayout(f.element);
    for(const value of [0,1,8888.88,1e20]){runtimePresentation(f.element,f.resolution,sampleItem(1,value,'BAD'),'Connected');expect(canvasMonitoringLayout(f.element)).toEqual(layout);}
    expect(JSON.stringify(f.element)).toBe(before);
  });
  it.each([[8,8],[24,24],[48,48]] as const)('small %s×%s delegates Details and never expands geometry', (width,height)=>{
    const f=configuration();f.element.width=width;f.element.height=height;const before=JSON.stringify(f.element),layout=canvasMonitoringLayout(f.element);
    expect(layout.inlineAction).toBe(false);expect(JSON.stringify(f.element)).toBe(before);if(width<48){expect(layout.caption).toBe(false);expect(layout.unit).toBe(false);}
  });
  it('huge text cannot take space from the primary Light or force a Details target',()=>{
    const f=configuration(1,'STATUS_LIGHT');f.element.style.showText=true;f.element.style.valueFontSize=96;
    const layout=canvasMonitoringLayout(f.element);expect(layout.lightText).toBe(false);expect(layout.inlineAction).toBe(false);
  });
  it('roomy Elements retain caption, value, unit and independent action/status slots',()=>{
    const f=configuration();f.element.width=320;f.element.height=120;expect(canvasMonitoringLayout(f.element)).toMatchObject({caption:true,unit:true,statusRow:true,inlineAction:true,roomy:true});
  });
  it('legacy inherited fonts are read without materializing new fields',()=>{
    const f=configuration();delete f.element.style.captionFontSize;delete f.element.style.valueFontSize;const before=JSON.stringify(f.element);canvasMonitoringLayout(f.element);expect(JSON.stringify(f.element)).toBe(before);
  });
});
