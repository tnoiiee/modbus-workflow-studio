import { definitionReferences } from './definitionReferences.js';
import { DefinitionCatalog } from './definitionCatalog.js';
import { registerDefinitionRoutes } from './definitionRoutes.js';
import'dotenv/config';import express from'express';import cors from'cors';import http from'node:http';import path from'node:path';import{WebSocketServer}from'ws';import{z}from'zod';import{JsonStore}from'./store.js';import{DeviceConnection,parseRead}from'./modbus.js';import{coilPayload,decodeRegisters,encodeValue}from'./codec.js';import{evaluateNode,validateWorkflow}from'./engine.js';import type{DeviceConfig,RuntimeValue,Workflow}from'./types.js';import{WorkflowManager,type WorkflowDefinition}from'./workflowManager.js';import{WorkflowRuntimeManager}from'./runtimeSessions.js';import{ModbusMonitorManager}from'./monitor.js';import{readReliabilityConfig}from'./reliability.js';import{BoundedLiveQueue,type LiveQueueEvent}from'./liveTransport.js';import{OverviewPageManager,overviewCreateSchema,overviewRenameSchema,overviewUpdateSchema}from'./overviewPages.js';import{OverviewControlStateStore}from'./overviewControlStates.js';import{registerOverviewControlRoutes}from'./overviewControlRoutes.js';
const PORT=Number(process.env.PORT??8080),HOST=process.env.HOST??'0.0.0.0',ALLOW_WRITES=process.env.ALLOW_WRITES==='true',DATA=process.env.DATA_DIR??'./data',RELIABILITY=readReliabilityConfig();
const modeSchema=z.enum(['DESIGN','SIMULATION','LIVE_LOCKED','LIVE_ARMED']);
const deviceSchema=z.object({id:z.string().regex(/^[A-Za-z0-9_-]+$/),name:z.string().min(1),host:z.string().min(1),port:z.number().int().min(1).max(65535),defaultUnitId:z.number().int().min(0).max(255),timeout:z.number().int().min(100).max(60000),retryCount:z.number().int().min(0).max(10),interRequestDelay:z.number().int().min(0).max(10000),reconnectDelay:z.number().int().min(100).max(60000),enabled:z.boolean()});
const defaultW:Workflow={version:1,mode:'DESIGN',running:false,nodes:[],edges:[],settings:{projectName:'MODBUS WORKFLOW STUDIO',autoSaveDelay:500,maxPasses:100}};
const ds=new JsonStore<DeviceConfig[]>(path.join(DATA,'devices.json'),[]),wsStore=new JsonStore<Workflow>(path.join(DATA,'workflow.json'),defaultW),audit=new JsonStore<unknown[]>(path.join(DATA,'audit.json'),[]);let devices=ds.load(),workflow=wsStore.load();if(workflow.mode==='LIVE_ARMED')workflow.mode='LIVE_LOCKED';workflow.running=false;const workflowManager=new WorkflowManager(DATA,workflow);workflowManager.downgradeArmed();const overviewPageManager=new OverviewPageManager(DATA);const overviewControlStore=new OverviewControlStateStore(DATA);let activeWorkflowId=workflowManager.first().id;workflow=workflowManager.first();let runningWorkflowId:string|undefined;const runtime:Record<string,RuntimeValue>={},engineMemory=new Map<string,unknown>(),outputPending=new Set<string>(),lastWrittenCommand=new Map<string,unknown>(),outputInitialized=new Set<string>(),lastWriteAt=new Map<string,number>(),manualTriggerTimers=new Map<string,NodeJS.Timeout>(),connections=new Map<string,DeviceConnection>(),traffic:unknown[]=[];let pollers=new Map<string,NodeJS.Timeout>();
const app=express();app.use(cors());app.use(express.json({limit:'256kb'}));const server=http.createServer(app),wss=new WebSocketServer({server,path:'/ws/live'});
type LiveClient={queue:BoundedLiveQueue;flushing:boolean;retryTimer?:NodeJS.Timeout};const liveClients=new WeakMap<import('ws').WebSocket,LiveClient>();let liveRevision=0;const CONTROL_EVENTS=new Set(['hello','devices','workflow','workflow-state','workflow-list','runtime','audit','resync-required']);const clientState=(client:import('ws').WebSocket)=>{let state=liveClients.get(client);if(!state){state={queue:new BoundedLiveQueue({maxMessages:RELIABILITY.wsMaxMessages,maxBytes:RELIABILITY.wsMaxBytes,coalesceWindowMs:RELIABILITY.wsTelemetryCoalesceMs}),flushing:false};liveClients.set(client,state)}return state};
const scheduleFlush=(client:import('ws').WebSocket)=>{const state=clientState(client);if(state.flushing||state.retryTimer)return;state.retryTimer=setTimeout(()=>{state.retryTimer=undefined;flushClient(client)},10)};const flushClient=(client:import('ws').WebSocket)=>{const state=clientState(client);if(state.flushing||client.readyState!==1)return;if(client.bufferedAmount>RELIABILITY.wsMaxBytes){scheduleFlush(client);return}const next=state.queue.shift();if(!next)return;state.flushing=true;client.send(next.payload,error=>{state.flushing=false;if(error){client.close(1011,'WebSocket send failed');return}flushClient(client)})};
const queueLiveEvent=(client:import('ws').WebSocket,type:string,data:unknown,workflowId?:string,revision=liveRevision)=>{const state=clientState(client);const critical=CONTROL_EVENTS.has(type);const payload=JSON.stringify({type,workflowId,data,revision});const resyncPayload=JSON.stringify({type:'resync-required',data:{reason:'live_queue_overflow',droppedTelemetry:state.queue.droppedTelemetry,revision},revision});const event:LiveQueueEvent={payload,bytes:Buffer.byteLength(payload),critical,coalesceKey:critical?undefined:`${type}:${type==='monitor'&&typeof data==='object'&&data&&'listId'in data?String((data as{listId:unknown}).listId):''}`,createdAt:Date.now(),resync:type==='resync-required'};const resyncEvent:LiveQueueEvent={payload:resyncPayload,bytes:Buffer.byteLength(resyncPayload),critical:true,resync:true};state.queue.enqueue(event,resyncEvent);scheduleFlush(client)};
const broadcast=(type:string,data:unknown,workflowId?:string)=>{const revision=++liveRevision;for(const c of wss.clients)if(c.readyState===1)queueLiveEvent(c,type,data,workflowId,revision)};
const conn=(d:DeviceConfig)=>{let c=connections.get(d.id);if(!c){c=new DeviceConnection(d,{monitorQueueLimit:RELIABILITY.monitorQueueLimit});c.on('state',()=>{broadcast('devices',listDevices());if(c!.runtime.actualState==='disconnected')monitorManager.stopByDevice(d.id)});c.on('traffic',x=>{traffic.unshift(x);traffic.length=Math.min(traffic.length,5000);broadcast('traffic',x)});connections.set(d.id,c)}return c};const listDevices=()=>devices.map(d=>({...d,runtime:connections.get(d.id)?.runtime??{desiredState:'disconnected',actualState:'disconnected',queueLength:0,activePollers:0,averageResponseTime:0,timeoutCount:0}}));
const workflowIdSchema=z.string().uuid();
const workflowNameSchema=z.object({name:z.string().trim().min(1).max(100),description:z.string().max(500).optional()});
const workflowAudit=(action:string,target:WorkflowDefinition,details:Record<string,unknown>={})=>appendAudit({timestamp:new Date().toISOString(),action,workflowId:target.id,workflowName:target.name,...details});
const workflowList=()=>workflowManager.list().map(item=>({...item,running:runtimeManager?.isRunning(item.id)??false}));
const activateWorkflow=(id:string):WorkflowDefinition=>{const selected=workflowManager.get(id);if(!selected)throw Object.assign(new Error('Workflow not found'),{code:'NOT_FOUND'});activeWorkflowId=id;workflow={...selected,running:runningWorkflowId===id};return selected};
const saveActiveWorkflow=():WorkflowDefinition=>{const saved=workflowManager.update(activeWorkflowId,{...workflow,running:false});workflow={...saved,running:runtimeManager.isRunning(activeWorkflowId)};return saved};
const broadcastWorkflowList=()=>broadcast('workflow-list',workflowList());
const normalizeAudit=(entry:Record<string,unknown>,index=0)=>({id:String(entry.id??`${String(entry.timestamp??'unknown')}-${index}`),timestamp:String(entry.timestamp??new Date().toISOString()),severity:String(entry.severity??(String(entry.result??'').match(/error|mismatch|blocked/i)?'error':'info')),action:String(entry.action??'UNKNOWN'),result:entry.result,workflowId:entry.workflowId,workflowName:entry.workflowName,nodeId:entry.nodeId,nodeName:entry.nodeName,deviceId:entry.deviceId,message:entry.message??entry.error,details:entry});const appendAudit=(entry:Record<string,unknown>)=>{const normalized=normalizeAudit({...entry,id:entry.id??crypto.randomUUID()});const entries=[...audit.load(),normalized];audit.save(entries.slice(-10000));broadcast('audit',normalized,String(normalized.workflowId??''));return normalized};const runtimeManager=new WorkflowRuntimeManager({workflows:workflowManager,getDevices:()=>devices,getConnection:id=>connections.get(id),allowWrites:ALLOW_WRITES,broadcast,audit:appendAudit});const monitorManager=new ModbusMonitorManager({dataDir:DATA,getDevices:()=>devices,getConnection:id=>connections.get(id),broadcast:(type,data)=>broadcast(type,data),audit:appendAudit,monitorPendingPerList:RELIABILITY.monitorPendingPerList});

const definitionCatalog = new DefinitionCatalog(DATA, id => Boolean(workflowManager.get(id)));
registerDefinitionRoutes(app, definitionCatalog, identity => definitionReferences(overviewPageManager, identity));

const sendLiveSnapshot=(client:import('ws').WebSocket)=>{queueLiveEvent(client,'hello',{version:'1.4.0-dev.4',revision:liveRevision,reliability:{wsMaxMessages:RELIABILITY.wsMaxMessages,wsMaxBytes:RELIABILITY.wsMaxBytes,reconnectBaseMs:RELIABILITY.wsReconnectBaseMs,reconnectMaxMs:RELIABILITY.wsReconnectMaxMs,reconnectJitter:RELIABILITY.wsReconnectJitter}});queueLiveEvent(client,'devices',listDevices());queueLiveEvent(client,'workflow-list',workflowList());const selected=workflowManager.get(activeWorkflowId);if(selected)queueLiveEvent(client,'workflow',{...selected,running:runtimeManager.isRunning(selected.id)},selected.id)};
wss.on('connection',client=>{clientState(client);sendLiveSnapshot(client);client.on('message',raw=>{try{const message=JSON.parse(String(raw)) as {type?:string};if(message.type==='resync'||message.type==='resync-request')sendLiveSnapshot(client)}catch{queueLiveEvent(client,'resync-required',{reason:'invalid_client_message',revision:liveRevision})}});client.on('close',()=>{const state=clientState(client);if(state.retryTimer)clearTimeout(state.retryTimer);state.queue.clear()});client.on('error',()=>client.close())});

app.get('/api/workflows',(_q,r)=>r.json(workflowList()));
app.post('/api/workflows',(q,r)=>{const parsed=workflowNameSchema.safeParse(q.body);if(!parsed.success)return r.status(400).json({error:'Valid workflow name is required'});try{const created=workflowManager.create(parsed.data.name,parsed.data.description??'');workflowAudit('CREATE_WORKFLOW',created);broadcastWorkflowList();r.status(201).json(created)}catch(error){r.status(400).json({error:(error as Error).message})}});
app.get('/api/workflows/:id',(q,r)=>{if(!workflowIdSchema.safeParse(q.params.id).success)return r.status(400).json({error:'Invalid workflow ID'});const selected=workflowManager.get(q.params.id);if(!selected)return r.status(404).json({error:'Workflow not found'});r.json({...selected,running:runtimeManager.isRunning(selected.id)})});
app.put('/api/workflows/:id',(q,r)=>{if(!workflowIdSchema.safeParse(q.params.id).success)return r.status(400).json({error:'Invalid workflow ID'});try{const expected=typeof q.body?.revision==='number'?q.body.revision:undefined;const updated=workflowManager.update(q.params.id,q.body as Partial<WorkflowDefinition>,expected);if(activeWorkflowId===updated.id)workflow={...updated,running:runtimeManager.isRunning(updated.id)};broadcast('workflow',{...updated,running:runtimeManager.isRunning(updated.id)},updated.id);runtimeManager.refresh(updated.id);broadcastWorkflowList();r.json(updated)}catch(error){const code=(error as{code?:string}).code;r.status(code==='REVISION_CONFLICT'?409:code==='NOT_FOUND'?404:400).json({error:(error as Error).message,currentRevision:code==='REVISION_CONFLICT'?workflowManager.get(q.params.id)?.revision:undefined})}});
app.post('/api/workflows/:id/rename',(q,r)=>{const parsed=workflowNameSchema.pick({name:true}).safeParse(q.body);if(!parsed.success)return r.status(400).json({error:'Valid workflow name is required'});try{const updated=workflowManager.rename(q.params.id,parsed.data.name);if(activeWorkflowId===updated.id)workflow={...updated,running:runtimeManager.isRunning(updated.id)};workflowAudit('RENAME_WORKFLOW',updated);broadcastWorkflowList();r.json(updated)}catch(error){r.status(404).json({error:(error as Error).message})}});
app.post('/api/workflows/:id/duplicate',(q,r)=>{try{const duplicate=workflowManager.duplicate(q.params.id,typeof q.body?.name==='string'?q.body.name:undefined);workflowAudit('DUPLICATE_WORKFLOW',duplicate,{sourceWorkflowId:q.params.id});broadcastWorkflowList();r.status(201).json(duplicate)}catch(error){r.status(404).json({error:(error as Error).message})}});
app.delete('/api/workflows/:id',(q,r)=>{try{const target=workflowManager.get(q.params.id);if(!target)return r.status(404).json({error:'Workflow not found'});if(runningWorkflowId===q.params.id){workflow.running=false;for(const timer of pollers.values())clearInterval(timer);pollers.clear();for(const[key,timer]of manualTriggerTimers)if(key.startsWith(`${q.params.id}:`)){clearTimeout(timer);manualTriggerTimers.delete(key)}runningWorkflowId=undefined}runtimeManager.delete(q.params.id);workflowManager.delete(q.params.id);workflowAudit('DELETE_WORKFLOW',target,{nodeCount:target.nodes.length,edgeCount:target.edges.length});if(activeWorkflowId===q.params.id){const first=workflowManager.first();activeWorkflowId=first.id;workflow={...first,running:false}}broadcastWorkflowList();r.json({ok:true,activeWorkflowId})}catch(error){const code=(error as{code?:string}).code;r.status(code==='LAST_WORKFLOW'?409:400).json({error:(error as Error).message})}});
app.post('/api/workflows/:id/activate',(q,r)=>{try{const selected=activateWorkflow(q.params.id);broadcast('workflow',{...selected,running:runtimeManager.isRunning(selected.id)},selected.id);r.json({...selected,running:runtimeManager.isRunning(selected.id)})}catch(error){r.status(404).json({error:(error as Error).message})}});
app.post('/api/workflows/:id/run',(q,r)=>{try{const summary=runtimeManager.start(q.params.id);broadcastWorkflowList();r.json(summary)}catch(error){const code=(error as{code?:string}).code;r.status(code==='NOT_FOUND'?404:code==='WRITE_BLOCKED'?403:409).json({error:(error as Error).message})}});
app.post('/api/workflows/:id/stop',(q,r)=>{try{const summary=runtimeManager.stop(q.params.id);broadcastWorkflowList();r.json(summary)}catch(error){r.status(404).json({error:(error as Error).message})}});
app.post('/api/workflows/:id/mode',(q,r)=>{const parsed=modeSchema.safeParse(q.body?.mode);if(!parsed.success)return r.status(400).json({error:'Invalid workflow mode'});const selected=workflowManager.get(q.params.id);if(!selected)return r.status(404).json({error:'Workflow not found'});if(parsed.data==='LIVE_ARMED'&&!ALLOW_WRITES)return r.status(403).json({error:'LIVE ARMED is blocked because ALLOW_WRITES=false'});const updated=workflowManager.update(q.params.id,{mode:parsed.data});if(activeWorkflowId===updated.id)workflow={...updated,running:runtimeManager.isRunning(updated.id)};workflowAudit('CHANGE_WORKFLOW_MODE',updated,{mode:parsed.data});runtimeManager.refresh(updated.id);broadcast('workflow-state',{running:runtimeManager.isRunning(updated.id),mode:updated.mode},updated.id);broadcastWorkflowList();r.json({...updated,running:runtimeManager.isRunning(updated.id)})});

app.post('/api/workflows/:id/runtime/nodes/:nodeId/manual-trigger',(q,r)=>{try{r.json(runtimeManager.manualTrigger(q.params.id,q.params.nodeId,String(q.body?.action??'toggle')))}catch(error){const code=(error as{code?:string}).code;r.status(code==='NOT_FOUND'?404:code==='INVALID_ACTION'||code==='INVALID_MODE'?400:409).json({error:(error as Error).message})}});

app.get('/api/health',(_q,r)=>r.json({ok:true,allowWrites:ALLOW_WRITES,version:'1.4.0-dev.4'}));app.get('/api/devices',(_q,r)=>r.json(listDevices()));app.post('/api/devices',(q,r)=>{const x=deviceSchema.parse(q.body);if(devices.some(d=>d.id===x.id))return r.status(409).json({error:'Duplicate device ID'});devices.push(x);ds.save(devices);r.status(201).json(x)});app.put('/api/devices/:id',(q,r)=>{const x=deviceSchema.parse(q.body),i=devices.findIndex(d=>d.id===q.params.id);if(i<0)return r.status(404).json({error:'Not found'});if(connections.get(q.params.id)?.runtime.actualState==='connected'&&(devices[i]!.host!==x.host||devices[i]!.port!==x.port))return r.status(409).json({error:'Disconnect before changing endpoint'});devices[i]=x;connections.delete(q.params.id);ds.save(devices);r.json(x)});app.delete('/api/devices/:id',(q,r)=>{const id=q.params.id,device=devices.find(d=>d.id===id);if(!device)return r.status(404).json({error:'Device not found'});connections.get(id)?.disconnect();connections.delete(id);for(const[nodeId,timer]of pollers){if(workflow.nodes.find(n=>n.id===nodeId)?.params.deviceId===id){clearInterval(timer);pollers.delete(nodeId)}}let clearedReferences=0;workflow={...workflow,nodes:workflow.nodes.map(n=>{if(n.params.deviceId!==id)return n;clearedReferences++;return{...n,params:{...n.params,deviceId:''}}})};devices=devices.filter(d=>d.id!==id);ds.save(devices);wsStore.save(workflow);const log=[...audit.load(),{timestamp:new Date().toISOString(),action:'REMOVE_DEVICE',deviceId:id,deviceName:device.name,endpoint:`${device.host}:${device.port}`,clearedReferences}];audit.save(log.slice(-5000));broadcast('devices',listDevices());broadcast('workflow',workflow);r.json({ok:true,removedDeviceId:id,clearedReferences})});
app.get('/api/runtime/summary',(_q,r)=>r.json(runtimeManager.list()));app.post('/api/runtime/stop-all',(_q,r)=>{const stopped=runtimeManager.stopAll();broadcastWorkflowList();r.json({ok:true,stopped})});app.get('/api/workflows/:id/runtime',(q,r)=>{const data=runtimeManager.runtime(q.params.id);if(!workflowManager.get(q.params.id))return r.status(404).json({error:'Workflow not found'});r.json(data??{})});app.get('/api/workflows/:id/runtime/nodes/:nodeId',(q,r)=>{const definition=workflowManager.get(q.params.id);if(!definition)return r.status(404).json({error:'Workflow not found'});if(!definition.nodes.some(node=>node.id===q.params.nodeId))return r.status(404).json({error:'Node not found in workflow'});r.json(runtimeManager.nodeRuntime(q.params.id,q.params.nodeId)??null)});
app.post('/api/devices/test',async(q,r)=>{const x=deviceSchema.parse(q.body),c=new DeviceConnection(x),t=Date.now();try{await c.connect();c.disconnect();r.json({ok:true,latency:Date.now()-t})}catch(e){r.status(502).json({ok:false,error:(e as Error).message})}});app.post('/api/devices/:id/connect',async(q,r)=>{const d=devices.find(x=>x.id===q.params.id);if(!d)return r.status(404).json({error:'Not found'});try{await conn(d).connect();runtimeManager.onDeviceConnected(d.id);r.json(conn(d).runtime)}catch(e){r.status(502).json({error:(e as Error).message})}});app.post('/api/devices/:id/disconnect',(q,r)=>{conn(devices.find(x=>x.id===q.params.id)!).disconnect();runtimeManager.onDeviceDisconnected(q.params.id);monitorManager.stopByDevice(q.params.id);for(const node of workflow.nodes.filter(item=>item.params.deviceId===q.params.id)){outputPending.delete(node.id);outputInitialized.delete(node.id);lastWrittenCommand.delete(node.id);lastWriteAt.delete(node.id)}for(const[n,t]of pollers)if(workflow.nodes.find(x=>x.id===n)?.params.deviceId===q.params.id){clearInterval(t);pollers.delete(n)}r.json({ok:true})});
app.get('/api/monitor-lists',(_q,r)=>r.json(monitorManager.all()));app.post('/api/monitor-lists',(q,r)=>{try{r.status(201).json(monitorManager.create(String(q.body?.name??'Commissioning')))}catch(error){r.status(400).json({error:(error as Error).message})}});app.put('/api/monitor-lists/:id',(q,r)=>{try{r.json(monitorManager.update(q.params.id,q.body))}catch(error){r.status(404).json({error:(error as Error).message})}});app.delete('/api/monitor-lists/:id',(q,r)=>{monitorManager.delete(q.params.id);r.json({ok:true})});app.post('/api/monitor-lists/:id/read',async(q,r)=>{try{r.json(await monitorManager.read(q.params.id))}catch(error){r.status(409).json({error:(error as Error).message})}});app.post('/api/monitor-lists/:id/start',(q,r)=>{try{monitorManager.start(q.params.id);r.json({ok:true})}catch(error){r.status(409).json({error:(error as Error).message})}});app.post('/api/monitor-lists/:id/stop',(q,r)=>{monitorManager.stop(q.params.id);r.json({ok:true})});

const overviewIdSchema=z.string().uuid();
const overviewStatus=(error:unknown)=>{const code=(error as{code?:string}).code;return code==='REVISION_CONFLICT'?409:code==='LAST_PAGE'?409:code==='DUPLICATE_NAME'||code==='INVALID_NAME'||code==='INVALID_ID'?400:code==='NOT_FOUND'?404:code==='ELEMENT_NOT_FOUND'?404:code==='NOT_CONTROL'||code==='UNSUPPORTED_CONTROL'?400:400};
app.get('/api/overview-pages',(_q,r)=>r.json(overviewPageManager.list()));
app.get('/api/overview-pages/:id',(q,r)=>{if(!overviewIdSchema.safeParse(q.params.id).success)return r.status(400).json({error:'Invalid Overview page ID'});const page=overviewPageManager.get(q.params.id);if(!page)return r.status(404).json({error:'Overview page not found'});r.json(page)});
app.post('/api/overview-pages',(q,r)=>{const parsed=overviewCreateSchema.safeParse(q.body);if(!parsed.success)return r.status(400).json({error:'Valid Overview page payload is required'});try{r.status(201).json(overviewPageManager.create(parsed.data))}catch(error){r.status(overviewStatus(error)).json({error:(error as Error).message})}});
app.put('/api/overview-pages/:id',(q,r)=>{if(!overviewIdSchema.safeParse(q.params.id).success)return r.status(400).json({error:'Invalid Overview page ID'});const parsed=overviewUpdateSchema.safeParse(q.body);if(!parsed.success)return r.status(400).json({error:'Valid Overview page payload is required'});try{r.json(overviewPageManager.update(q.params.id,parsed.data))}catch(error){const status=overviewStatus(error);r.status(status).json({error:(error as Error).message,currentRevision:status===409?overviewPageManager.get(q.params.id)?.revision:undefined})}});
app.post('/api/overview-pages/:id/rename',(q,r)=>{if(!overviewIdSchema.safeParse(q.params.id).success)return r.status(400).json({error:'Invalid Overview page ID'});const parsed=overviewRenameSchema.safeParse(q.body);if(!parsed.success)return r.status(400).json({error:'Valid Overview page payload is required'});try{r.json(overviewPageManager.rename(q.params.id,parsed.data))}catch(error){r.status(overviewStatus(error)).json({error:(error as Error).message})}});
app.post('/api/overview-pages/:id/duplicate',(q,r)=>{if(!overviewIdSchema.safeParse(q.params.id).success)return r.status(400).json({error:'Invalid Overview page ID'});const name=typeof q.body?.name==='string'?q.body.name:undefined;if(name!==undefined&&(!name.trim()||name.trim().length>100))return r.status(400).json({error:'Valid Overview page name is required'});try{r.status(201).json(overviewPageManager.duplicate(q.params.id,name))}catch(error){r.status(overviewStatus(error)).json({error:(error as Error).message})}});
app.delete('/api/overview-pages/:id',(q,r)=>{if(!overviewIdSchema.safeParse(q.params.id).success)return r.status(400).json({error:'Invalid Overview page ID'});try{overviewPageManager.delete(q.params.id);overviewControlStore.clearPage(q.params.id);r.json({ok:true})}catch(error){r.status(overviewStatus(error)).json({error:(error as Error).message})}});
registerOverviewControlRoutes(app,overviewPageManager,overviewControlStore);
app.get('/api/workflow',(_q,r)=>r.json({...workflow,id:activeWorkflowId,running:runtimeManager.isRunning(activeWorkflowId)}));app.put('/api/workflow',(q,r)=>{const incoming=q.body as Partial<Workflow>;const candidate:Workflow={...workflow,version:typeof incoming.version==='number'?incoming.version:workflow.version,nodes:Array.isArray(incoming.nodes)?incoming.nodes:workflow.nodes,edges:Array.isArray(incoming.edges)?incoming.edges:workflow.edges,settings:incoming.settings&&typeof incoming.settings==='object'?incoming.settings:workflow.settings,mode:workflow.mode,running:workflow.running};workflow=candidate;const saved=saveActiveWorkflow();wsStore.save(workflow);runtimeManager.refresh(activeWorkflowId);broadcast('workflow',{...saved,running:runtimeManager.isRunning(activeWorkflowId)},activeWorkflowId);broadcastWorkflowList();r.json(saved)});app.post('/api/workflow/mode',(_q,r)=>r.status(410).json({error:'Use /api/workflows/:workflowId/mode'}));app.post('/api/workflow/run',(_q,r)=>r.status(410).json({error:'Use /api/workflows/:workflowId/run'}));app.post('/api/workflow/stop',(_q,r)=>r.status(410).json({error:'Use /api/workflows/:workflowId/stop'}));app.get('/api/runtime',(_q,r)=>r.json(runtimeManager.runtime(activeWorkflowId)??{}));app.get('/api/runtime/nodes/:id',(q,r)=>r.json(runtimeManager.nodeRuntime(activeWorkflowId,q.params.id)??null));app.get('/api/validation',(_q,r)=>r.json(validateWorkflow(workflow,new Set(devices.map(d=>d.id)))));app.get('/api/traffic',(_q,r)=>r.json(traffic));app.delete('/api/traffic',(_q,r)=>{traffic.length=0;r.status(204).end()});app.get('/api/audit',(q,r)=>{const all=(audit.load() as Record<string,unknown>[]).map(normalizeAudit);const workflowId=String(q.query.workflowId??'');const action=String(q.query.action??'');const severity=String(q.query.severity??'');const result=String(q.query.result??'');const search=String(q.query.search??'').toLowerCase();const from=q.query.from?Date.parse(String(q.query.from)):undefined;const to=q.query.to?Date.parse(String(q.query.to)):undefined;const filtered=all.filter(item=>(!workflowId||item.workflowId===workflowId)&&(!action||item.action===action)&&(!severity||item.severity===severity)&&(!result||String(item.result??'')===result)&&(!from||Date.parse(item.timestamp)>=from)&&(!to||Date.parse(item.timestamp)<=to)&&(!search||JSON.stringify(item).toLowerCase().includes(search))).sort((a,b)=>b.timestamp.localeCompare(a.timestamp));const limit=Math.max(1,Math.min(500,Number(q.query.limit??100)));const offset=Math.max(0,Number(q.query.offset??0));r.json({items:filtered.slice(offset,offset+limit),total:filtered.length,limit,offset})});app.delete('/api/audit',(_q,r)=>{const cleared=(audit.load() as unknown[]).length;audit.save([]);const entry=appendAudit({timestamp:new Date().toISOString(),action:'AUDIT_CLEARED',severity:'warning',result:'success',message:`Cleared ${cleared} audit entries`});r.json({ok:true,cleared,audit:entry})});


function outputWriteAllowed():boolean{
  if(!ALLOW_WRITES||workflow.mode!=='LIVE_ARMED'||!workflow.running)return false;
  return !validateWorkflow(workflow,new Set(devices.map(device=>device.id))).some(item=>item.severity==='critical');
}

function decodeReadBack(response:Buffer,functionCode:number,dataType:string,order:string):unknown{
  const values=parseRead(response,functionCode);
  if(functionCode===1||functionCode===2)return values[0]??false;
  return decodeRegisters(values as number[],dataType,order as 'ABCD'|'BADC'|'CDAB'|'DCBA');
}

async function readBackOutput(node:Workflow['nodes'][number],device:DeviceConfig,connection:DeviceConnection):Promise<unknown>{
  const dataType=String(node.params.dataType??'Boolean');
  const functionCode=Number(node.params.readBackFunctionCode??(dataType==='Boolean'?1:3));
  const address=Number(node.params.readBackAddress??node.params.address??0);
  const quantity=Number(node.params.quantity??(dataType==='Float64'?4:['Int32','UInt32','Float32'].includes(dataType)?2:1));
  const response=await connection.request({unitId:Number(node.params.unitId??device.defaultUnitId),fc:functionCode,address,quantity,priority:true});
  return decodeReadBack(response,functionCode,dataType,String(node.params.order??'ABCD'));
}

async function executeAutomaticWrite(node:Workflow['nodes'][number],command:unknown):Promise<void>{
  if(outputPending.has(node.id)||!outputWriteAllowed())return;
  const current=runtime[node.id];
  if(!current||current.quality!=='GOOD')return;
  const device=devices.find(item=>item.id===node.params.deviceId);
  const connection=device?connections.get(device.id):undefined;
  if(!device||!connection||connection.runtime.actualState!=='connected'){
    runtime[node.id]={...current,status:'blocked',writeStatus:'BLOCKED',error:'Device is not connected'};
    return;
  }
  const writeMode=String(node.params.writeMode??'AUTOMATIC');
  if(writeMode==='MANUAL_ONLY')return;
  const minimumInterval=Math.max(0,Number(node.params.minimumWriteInterval??0));
  if(Date.now()-(lastWriteAt.get(node.id)??0)<minimumInterval)return;
  const writeOnChange=node.params.writeOnChange!==false;
  const initialized=outputInitialized.has(node.id);
  const initialPolicy=String(node.params.initialWritePolicy??'READ_FIRST');
  if(initialized&&writeOnChange&&Object.is(lastWrittenCommand.get(node.id),command))return;
  if(!initialized&&initialPolicy==='DO_NOT_WRITE_UNTIL_CHANGE'){
    outputInitialized.add(node.id);
    lastWrittenCommand.set(node.id,command);
    runtime[node.id]={...current,status:'calculated',writeStatus:'WAITING_FOR_CHANGE'};
    return;
  }

  outputPending.add(node.id);
  try{
    if(!initialized&&initialPolicy==='READ_FIRST'){
      const existing=await readBackOutput(node,device,connection);
      runtime[node.id]={...runtime[node.id]!,readBackValue:existing,readBackQuality:'GOOD'};
      const expected=runtime[node.id]!.effectiveValue;
      if(Object.is(existing,expected)){
        outputInitialized.add(node.id);
        lastWrittenCommand.set(node.id,command);
        runtime[node.id]={...runtime[node.id]!,status:'written',writeStatus:'VERIFIED',error:undefined};
        return;
      }
    }

    if(!outputWriteAllowed())return;
    const polarity=String(node.params.polarity??'NORMAL') as 'NORMAL'|'ACTIVE_LOW';
    const functionCode=Number(node.params.functionCode??5);
    const dataType=String(node.params.dataType??'Boolean');
    const effective=typeof command==='boolean'&&polarity==='ACTIVE_LOW'?!command:command;
    const scale=Number(node.params.scale??1);
    const offset=Number(node.params.offset??0);
    const rawNumeric=typeof effective==='number'?(effective-offset)/(scale===0?1:scale):Number(effective);
    const values=functionCode===5?[coilPayload(Boolean(command),polarity)]:encodeValue(rawNumeric,dataType,String(node.params.order??'ABCD') as 'ABCD'|'BADC'|'CDAB'|'DCBA');
    const encodedPayload=values.map(value=>`0x${value.toString(16).padStart(4,'0').toUpperCase()}`).join(' ');
    runtime[node.id]={...runtime[node.id]!,status:'writing',writeStatus:'WRITING',effectiveValue:effective,encodedPayload,error:undefined};
    broadcast('runtime',runtime);
    const started=Date.now();
    await connection.request({unitId:Number(node.params.unitId??device.defaultUnitId),fc:functionCode,address:Number(node.params.address??0),values,priority:true});
    const timestamp=new Date().toISOString();
    lastWriteAt.set(node.id,Date.now());
    lastWrittenCommand.set(node.id,command);
    outputInitialized.add(node.id);
    runtime[node.id]={...runtime[node.id]!,status:'written',writeStatus:'WRITTEN',lastWriteTime:timestamp,responseTime:Date.now()-started,error:undefined,consecutiveErrors:0};
    const log=[...audit.load(),{timestamp,action:'AUTOMATIC_WRITE',nodeId:node.id,deviceId:device.id,functionCode,address:Number(node.params.address??0),command,effective,encodedPayload,result:'WRITTEN'}];
    audit.save(log.slice(-5000));

    if(node.params.readBackEnabled===true){
      const delay=Math.max(0,Number(node.params.readBackDelay??0));
      if(delay>0)await new Promise<void>(resolve=>setTimeout(resolve,delay));
      const readBack=await readBackOutput(node,device,connection);
      const match=Object.is(readBack,effective);
      runtime[node.id]={...runtime[node.id]!,readBackValue:readBack,readBackQuality:match?'GOOD':'BAD',status:match?'written':'read-back mismatch',writeStatus:match?'VERIFIED':'MISMATCH',error:match?undefined:'Read-back value does not match effective write value'};
      const verifyLog=[...audit.load(),{timestamp:new Date().toISOString(),action:'READ_BACK_VERIFY',nodeId:node.id,deviceId:device.id,expected:effective,actual:readBack,result:match?'VERIFIED':'MISMATCH'}];
      audit.save(verifyLog.slice(-5000));
    }
  }catch(error){
    const previous=runtime[node.id];
    if(previous)runtime[node.id]={...previous,status:'error',writeStatus:'ERROR',quality:'BAD',error:(error as Error).message,consecutiveErrors:previous.consecutiveErrors+1};
  }finally{
    outputPending.delete(node.id);
    broadcast('runtime',runtime);
  }
}

function scheduleAutomaticOutputs():void{
  if(!outputWriteAllowed())return;
  for(const node of workflow.nodes.filter(item=>item.type==='MODBUS_OUTPUT')){
    const state=runtime[node.id];
    if(state?.quality==='GOOD')void executeAutomaticWrite(node,state.commandedValue);
  }
}

function evaluateWorkflow():void{
  if(!workflow.running||workflow.mode==='DESIGN')return;
  const enabledEdges=workflow.edges.filter(edge=>edge.enabled);
  const sourceTypes=new Set(['MODBUS_INPUT','MANUAL_TRIGGER','BOOLEAN_CONSTANT','NUMERIC_CONSTANT']);for(const node of workflow.nodes){if(node.type==='BOOLEAN_CONSTANT'||node.type==='NUMERIC_CONSTANT'){const value=node.params.value??(node.type==='BOOLEAN_CONSTANT'?false:0);runtime[node.id]={value,lastKnownValue:value,status:'calculated',quality:'GOOD',lastValueChange:runtime[node.id]&&Object.is(runtime[node.id]!.value,value)?runtime[node.id]!.lastValueChange:new Date().toISOString(),consecutiveErrors:0}}if(node.type==='MANUAL_TRIGGER'&&!runtime[node.id])runtime[node.id]={value:false,lastKnownValue:false,status:'manual',quality:'GOOD',lastValueChange:new Date().toISOString(),consecutiveErrors:0}}const calculated=new Set(workflow.nodes.filter(node=>sourceTypes.has(node.type)).map(node=>node.id));
  const maxPasses=Math.max(1,Number(workflow.settings.maxPasses??100));
  let pass=0;
  let progressed=true;
  while(progressed&&pass<maxPasses){
    progressed=false;
    pass++;
    for(const node of workflow.nodes){
      if(calculated.has(node.id)||sourceTypes.has(node.type))continue;
      const incoming=enabledEdges.filter(edge=>edge.target===node.id);
      if(node.type==='MODBUS_OUTPUT'){
        const sourceEdge=incoming.find(edge=>edge.targetPort===0);
        if(!sourceEdge||!calculated.has(sourceEdge.source))continue;
        const sourceRuntime=runtime[sourceEdge.source];
        if(!sourceRuntime)continue;
        const command=sourceRuntime.value;
        const quality=sourceRuntime.quality;
        const effective=typeof command==='boolean'&&String(node.params.polarity??'NORMAL')==='ACTIVE_LOW'?!command:command;
        runtime[node.id]={
          value:command,
          lastKnownValue:quality==='GOOD'?command:runtime[node.id]?.lastKnownValue,
          commandedValue:command,
          effectiveValue:effective,
          status:quality==='GOOD'?'calculated':'blocked',
          quality:quality==='GOOD'?'GOOD':'UNCERTAIN',
          error:quality==='GOOD'?undefined:'Source quality is not GOOD',
          lastValueChange:Object.is(runtime[node.id]?.commandedValue,command)?runtime[node.id]?.lastValueChange:new Date().toISOString(),
          consecutiveErrors:quality==='GOOD'?0:(runtime[node.id]?.consecutiveErrors??0)+1
        };
        calculated.add(node.id);
        progressed=true;
        continue;
      }
      const inputs:RuntimeValue[]=[];
      let ready=true;
      for(let port=0;port<node.inputCount;port++){
        const edge=incoming.find(item=>item.targetPort===port);
        if(!edge||!calculated.has(edge.source)||!runtime[edge.source]){
          ready=false;
          break;
        }
        inputs.push(runtime[edge.source]!);
      }
      if(!ready)continue;
      const previous=runtime[node.id];
      const next=evaluateNode(node,inputs,engineMemory);
      next.lastKnownValue=next.quality==='GOOD'?next.value:previous?.lastKnownValue;
      next.lastValueChange=previous&&Object.is(previous.value,next.value)?previous.lastValueChange:new Date().toISOString();
      runtime[node.id]=next;
      calculated.add(node.id);
      progressed=true;
    }
  }
  for(const node of workflow.nodes){
    if(sourceTypes.has(node.type)||calculated.has(node.id))continue;
    runtime[node.id]={
      value:runtime[node.id]?.lastKnownValue,
      lastKnownValue:runtime[node.id]?.lastKnownValue,
      status:'blocked',
      quality:'UNCERTAIN',
      error:pass>=maxPasses?'Maximum workflow passes reached':'Required input is not ready',
      consecutiveErrors:(runtime[node.id]?.consecutiveErrors??0)+1
    };
  }
  scheduleAutomaticOutputs();
}
async function readNode(n:Workflow['nodes'][number]){const d=devices.find(x=>x.id===n.params.deviceId),c=d?connections.get(d.id):undefined;if(!c||c.runtime.actualState!=='connected'){runtime[n.id]={...runtime[n.id],value:runtime[n.id]?.lastKnownValue,status:'disconnected',quality:'DISCONNECTED',consecutiveErrors:(runtime[n.id]?.consecutiveErrors??0)+1};evaluateWorkflow();return broadcast('runtime',runtime)}try{const fc=Number(n.params.functionCode??1),raw=await c.request({unitId:Number(n.params.unitId??d!.defaultUnitId),fc,address:Number(n.params.address??0),quantity:Number(n.params.quantity??1)}),vals=parseRead(raw,fc),base=fc<3?vals[0]:decodeRegisters(vals as number[],String(n.params.dataType??'UInt16'),String(n.params.order??'ABCD') as never),value=typeof base==='number'?base*Number(n.params.scale??1)+Number(n.params.offset??0):base;const timestamp=new Date().toISOString(),previous=runtime[n.id];runtime[n.id]={value,lastKnownValue:value,status:'online',quality:'GOOD',lastPollTime:timestamp,lastSuccessfulRead:timestamp,lastValueChange:previous&&Object.is(previous.value,value)?previous.lastValueChange:timestamp,consecutiveErrors:0};evaluateWorkflow();broadcast('runtime',runtime)}catch(e){runtime[n.id]={...runtime[n.id],value:runtime[n.id]?.lastKnownValue,status:'error',quality:'BAD',error:(e as Error).message,consecutiveErrors:(runtime[n.id]?.consecutiveErrors??0)+1};evaluateWorkflow();broadcast('runtime',runtime)}}
function syncPollers(){for(const t of pollers.values())clearInterval(t);pollers.clear();if(!workflow.running||!['LIVE_LOCKED','LIVE_ARMED'].includes(workflow.mode))return;for(const n of workflow.nodes.filter(n=>n.type==='MODBUS_INPUT')){const d=devices.find(x=>x.id===n.params.deviceId),c=d?connections.get(d.id):undefined;if(c?.runtime.actualState!=='connected')continue;void readNode(n);pollers.set(n.id,setInterval(()=>void readNode(n),Math.max(100,Number(n.params.scanInterval??1000))))}}
app.post('/api/nodes/:id/write',async(q,r)=>{const n=workflow.nodes.find(x=>x.id===q.params.id);if(!n||n.type!=='MODBUS_OUTPUT')return r.status(404).json({error:'Output node not found'});if(workflow.mode!=='LIVE_ARMED'||!workflow.running||!ALLOW_WRITES)return r.status(403).json({error:'Write guard blocked'});const d=devices.find(x=>x.id===n.params.deviceId),c=d?connections.get(d.id):undefined;if(!c||c.runtime.actualState!=='connected')return r.status(409).json({error:'Device not connected'});const command=Boolean(q.body.value),polarity=String(n.params.polarity??'NORMAL')as'NORMAL'|'ACTIVE_LOW',fc=Number(n.params.functionCode??5),values=fc===5?[coilPayload(command,polarity)]:encodeValue(Number(q.body.value),String(n.params.dataType??'UInt16'),String(n.params.order??'ABCD')as never);try{const raw=await c.request({unitId:Number(n.params.unitId??d!.defaultUnitId),fc,address:Number(n.params.address??0),values,priority:true});const outputRuntime:RuntimeValue={value:command,commandedValue:command,effectiveValue:polarity==='ACTIVE_LOW'?!command:command,status:'written',quality:'GOOD',lastWriteTime:new Date().toISOString(),consecutiveErrors:0};runtime[n.id]=outputRuntime;const log=[...audit.load(),{timestamp:new Date().toISOString(),action:'WRITE',nodeId:n.id,deviceId:d!.id,fc,address:n.params.address,command,effective:outputRuntime.effectiveValue,payload:raw.toString('hex')}];audit.save(log.slice(-5000));broadcast('runtime',runtime);r.json(runtime[n.id])}catch(e){r.status(502).json({error:(e as Error).message})}});
app.use('/api',(_q,r)=>r.status(404).json({error:'API endpoint not found'}));const dist=path.resolve('../client/dist');app.use(express.static(dist));app.get('*',(_q,r)=>r.sendFile(path.join(dist,'index.html')));server.listen(PORT,HOST,()=>console.log(`MODBUS WORKFLOW STUDIO v1.4.0-dev.4 on http://${HOST}:${PORT}`));
