import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { JsonStore } from './store.js';
import { parseRead, type DeviceConnection } from './modbus.js';
import { decodeRegisters } from './codec.js';
import type { DeviceConfig, Quality } from './types.js';

export interface MonitorItem {
  id: string; enabled: boolean; tagName: string; functionCode: number; address: number;
  dataType: string; quantity: number; order: string; scale: number; offset: number; engineeringUnit: string;
}
export interface MonitorList { id: string; name: string; deviceId: string; unitId: number; scanInterval: number; items: MonitorItem[]; createdAt: string; updatedAt: string }
export interface MonitorValue { value?: unknown; rawValue?: unknown; quality: Quality; lastUpdate?: string; responseTime?: number; error?: string }

type Dependencies={dataDir:string;getDevices:()=>DeviceConfig[];getConnection:(id:string)=>DeviceConnection|undefined;broadcast:(type:string,data:unknown)=>void;audit:(entry:Record<string,unknown>)=>void};
export class ModbusMonitorManager{
  private store:JsonStore<MonitorList[]>;private lists:MonitorList[];private values=new Map<string,Record<string,MonitorValue>>();private timers=new Map<string,NodeJS.Timeout>();
  constructor(private d:Dependencies){this.store=new JsonStore(path.join(d.dataDir,'monitor-lists.json'),[]);this.lists=this.store.load()}
  all(){return this.lists.map(x=>({...x,running:this.timers.has(x.id),values:this.values.get(x.id)??{}}))}
  create(name='Commissioning'){const now=new Date().toISOString(),x:MonitorList={id:randomUUID(),name,deviceId:'',unitId:1,scanInterval:1000,items:[],createdAt:now,updatedAt:now};this.lists.push(x);this.save();this.audit('MONITOR_LIST_CREATED',x);return x}
  update(id:string,patch:Partial<MonitorList>){const i=this.lists.findIndex(x=>x.id===id);if(i<0)throw Error('Monitor list not found');const current=this.lists[i]!;const items=(patch.items??current.items).slice(0,500).map(x=>({...x,id:x.id||randomUUID(),functionCode:Number(x.functionCode),address:Number(x.address),quantity:Math.max(1,Number(x.quantity??1)),scale:Number(x.scale??1),offset:Number(x.offset??0)}));const next={...current,...patch,id:current.id,items,updatedAt:new Date().toISOString()};this.lists[i]=next;this.save();return next}
  delete(id:string){this.stop(id);this.lists=this.lists.filter(x=>x.id!==id);this.values.delete(id);this.save();this.d.audit({timestamp:new Date().toISOString(),action:'MONITOR_LIST_DELETED',monitorListId:id})}
  async read(id:string){const list=this.require(id),device=this.d.getDevices().find(x=>x.id===list.deviceId),c=device?this.d.getConnection(device.id):undefined;if(!device||!c||c.runtime.actualState!=='connected')throw Error('Device is not connected');const result:Record<string,MonitorValue>={...(this.values.get(id)??{})};for(const item of list.items.filter(x=>x.enabled)){const started=Date.now();try{const regs=this.registerCount(item);const raw=await c.request({unitId:list.unitId||device.defaultUnitId,fc:item.functionCode,address:item.address,quantity:regs,workflowId:`monitor:${id}`,nodeId:item.id});const parsed=parseRead(raw,item.functionCode);const rawValue=item.functionCode<=2?parsed[0]:decodeRegisters(parsed as number[],item.dataType,item.order as never);const value=typeof rawValue==='number'?rawValue*item.scale+item.offset:rawValue;result[item.id]={value,rawValue,quality:'GOOD',lastUpdate:new Date().toISOString(),responseTime:Date.now()-started}}catch(error){result[item.id]={...result[item.id],quality:'BAD',lastUpdate:new Date().toISOString(),responseTime:Date.now()-started,error:(error as Error).message};this.d.audit({timestamp:new Date().toISOString(),action:'MONITOR_READ_FAILED',monitorListId:id,monitorItemId:item.id,error:(error as Error).message})}}this.values.set(id,result);this.d.broadcast('monitor',{listId:id,values:result});return result}
  start(id:string){const list=this.require(id);if(this.timers.has(id))return;void this.read(id);this.timers.set(id,setInterval(()=>void this.read(id).catch(()=>undefined),Math.max(100,list.scanInterval)));this.audit('MONITOR_STARTED',list)}
  stop(id:string){const t=this.timers.get(id);if(t)clearInterval(t);if(this.timers.delete(id)){const list=this.lists.find(x=>x.id===id);if(list)this.audit('MONITOR_STOPPED',list)}}
  stopByDevice(deviceId:string){for(const x of this.lists.filter(x=>x.deviceId===deviceId))this.stop(x.id)}
  private registerCount(x:MonitorItem){if(x.functionCode<=2)return Math.max(1,x.quantity);return ['Int32','UInt32','Float32'].includes(x.dataType)?2:x.dataType==='Float64'?4:1}
  private require(id:string){const x=this.lists.find(x=>x.id===id);if(!x)throw Error('Monitor list not found');return x}
  private save(){this.store.save(this.lists)} private audit(action:string,x:MonitorList){this.d.audit({timestamp:new Date().toISOString(),action,monitorListId:x.id,monitorListName:x.name,deviceId:x.deviceId})}
}
