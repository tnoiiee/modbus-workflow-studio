import type { DeviceConnection } from './modbus.js';
import type { DeviceConfig, RuntimeValue } from './types.js';
import type { WorkflowDefinition, WorkflowManager } from './workflowManager.js';
import { parseRead } from './modbus.js';
import { coilPayload, decodeRegisters, encodeValue } from './codec.js';
import { evaluateNode, validateWorkflow } from './engine.js';

export interface RuntimeSessionSummary {
  workflowId: string;
  running: boolean;
  startedAt?: string;
  stoppedAt?: string;
  lastEvaluationTime?: string;
  evaluationCount: number;
  nodeRuntimeCount: number;
  pollerCount: number;
  timerCount: number;
  pendingWriteCount: number;
  lastError?: string;
}

interface RuntimeSession {
  workflowId: string;
  running: boolean;
  startedAt?: string;
  stoppedAt?: string;
  lastEvaluationTime?: string;
  evaluationCount: number;
  lastError?: string;
  nodeRuntime: Record<string, RuntimeValue>;
  engineMemory: Map<string, unknown>;
  pollers: Map<string, NodeJS.Timeout>;
  timers: Map<string, NodeJS.Timeout>;
  manualTriggerTimers: Map<string, NodeJS.Timeout>;
  outputPending: Set<string>;
  outputInitialized: Set<string>;
  lastWrittenCommand: Map<string, unknown>;
  lastWriteAt: Map<string, number>;
}

interface RuntimeDependencies {
  workflows: WorkflowManager;
  getDevices: () => DeviceConfig[];
  getConnection: (deviceId: string) => DeviceConnection | undefined;
  allowWrites: boolean;
  broadcast: (type: string, data: unknown, workflowId?: string) => void;
  audit: (entry: Record<string, unknown>) => void;
}

export class WorkflowRuntimeManager {
  private readonly sessions = new Map<string, RuntimeSession>();
  private readonly outputOwners = new Map<string, string>();

  constructor(private readonly dependencies: RuntimeDependencies) {}

  list(): RuntimeSessionSummary[] {
    return [...this.sessions.values()].map(session => this.summaryOf(session));
  }

  summary(workflowId: string): RuntimeSessionSummary | undefined {
    const session = this.sessions.get(workflowId);
    return session ? this.summaryOf(session) : undefined;
  }

  runtime(workflowId: string): Record<string, RuntimeValue> | undefined {
    const session = this.sessions.get(workflowId);
    return session ? structuredClone(session.nodeRuntime) : undefined;
  }

  nodeRuntime(workflowId: string, nodeId: string): RuntimeValue | undefined {
    return this.sessions.get(workflowId)?.nodeRuntime[nodeId];
  }

  isRunning(workflowId: string): boolean {
    return this.sessions.get(workflowId)?.running === true;
  }

  start(workflowId: string): RuntimeSessionSummary {
    const workflow = this.requireWorkflow(workflowId);
    if (!workflow.enabled) throw this.error('Workflow is disabled', 'DISABLED');
    if (workflow.mode === 'DESIGN') throw this.error('DESIGN workflow cannot run', 'DESIGN_MODE');
    if (workflow.mode === 'LIVE_ARMED') {
      if (!this.dependencies.allowWrites) throw this.error('LIVE ARMED is blocked because ALLOW_WRITES=false', 'WRITE_BLOCKED');
      const critical = validateWorkflow(workflow, new Set(this.dependencies.getDevices().map(device => device.id))).filter(item => item.severity === 'critical');
      if (critical.length) throw this.error(`LIVE ARMED is blocked by ${critical.length} critical validation error(s)`, 'VALIDATION');
      this.assertOutputConflicts(workflow);
    }
    const existing = this.sessions.get(workflowId);
    if (existing?.running) return this.summaryOf(existing);
    const session = existing ?? this.createSession(workflowId);
    session.running = true;
    session.startedAt = new Date().toISOString();
    session.stoppedAt = undefined;
    session.lastError = undefined;
    this.sessions.set(workflowId, session);
    this.claimOutputs(workflow);
    this.initializeSources(workflow, session);
    this.evaluate(workflow, session);
    this.syncPollers(workflow, session);
    this.broadcastRuntime(session);
    this.dependencies.audit({ timestamp: new Date().toISOString(), action: 'RUN_WORKFLOW', workflowId, workflowName: workflow.name });
    return this.summaryOf(session);
  }

  stop(workflowId: string): RuntimeSessionSummary {
    const workflow = this.requireWorkflow(workflowId);
    const session = this.sessions.get(workflowId) ?? this.createSession(workflowId);
    this.stopSession(workflow, session);
    this.dependencies.audit({ timestamp: new Date().toISOString(), action: 'STOP_WORKFLOW', workflowId, workflowName: workflow.name });
    return this.summaryOf(session);
  }

  stopAll(): number {
    let stopped = 0;
    for (const [workflowId, session] of this.sessions) {
      if (!session.running) continue;
      const workflow = this.dependencies.workflows.get(workflowId);
      if (!workflow) continue;
      this.stopSession(workflow, session);
      stopped += 1;
    }
    this.dependencies.audit({ timestamp: new Date().toISOString(), action: 'STOP_ALL_WORKFLOWS', stopped });
    return stopped;
  }

  delete(workflowId: string): void {
    const session = this.sessions.get(workflowId);
    const workflow = this.dependencies.workflows.get(workflowId);
    if (session && workflow) this.stopSession(workflow, session);
    this.sessions.delete(workflowId);
  }

  onDeviceDisconnected(deviceId: string): void {
    for (const [workflowId, session] of this.sessions) {
      if (!session.running) continue;
      const workflow = this.dependencies.workflows.get(workflowId);
      if (!workflow) continue;
      for (const [nodeId, timer] of session.pollers) {
        const node = workflow.nodes.find(item => item.id === nodeId.split(':')[0]);
        if (node?.params.deviceId !== deviceId) continue;
        clearInterval(timer);
        session.pollers.delete(nodeId);
        const baseId=nodeId.split(':')[0]!;const subIndex=nodeId.includes(':')?nodeId.split(':')[1]:undefined;const previous=session.nodeRuntime[baseId];if(subIndex!==undefined){const previousOutput=previous?.outputs?.[subIndex],outputs:Record<string,RuntimeValue>={...(previous?.outputs??{}),[subIndex]:{value:previousOutput?.lastKnownValue,lastKnownValue:previousOutput?.lastKnownValue,status:'disconnected',quality:'DISCONNECTED',error:'Device is not connected',consecutiveErrors:(previousOutput?.consecutiveErrors??0)+1}};session.nodeRuntime[baseId]={value:Object.keys(outputs).sort().map(key=>outputs[key]?.value),outputs,lastKnownValue:previous?.lastKnownValue,status:'disconnected',quality:'DISCONNECTED',consecutiveErrors:Object.values(outputs).reduce((sum,item)=>sum+item.consecutiveErrors,0)}}else session.nodeRuntime[baseId]={value:previous?.lastKnownValue,lastKnownValue:previous?.lastKnownValue,status:'disconnected',quality:'DISCONNECTED',consecutiveErrors:(previous?.consecutiveErrors??0)+1};
      }
      this.evaluate(workflow, session);
      this.broadcastRuntime(session);
    }
  }

  onDeviceConnected(deviceId: string): void {
    for (const [workflowId, session] of this.sessions) {
      if (!session.running) continue;
      const workflow = this.dependencies.workflows.get(workflowId);
      if (workflow?.nodes.some(node => node.params.deviceId === deviceId)) this.syncPollers(workflow, session);
    }
  }

  refresh(workflowId: string): void {
    const session = this.sessions.get(workflowId);
    const workflow = this.dependencies.workflows.get(workflowId);
    if (!session?.running || !workflow) return;
    this.syncPollers(workflow, session);
    this.evaluate(workflow, session);
    this.broadcastRuntime(session);
  }

  manualTrigger(workflowId: string, nodeId: string, action: string): RuntimeValue {
    const workflow = this.requireWorkflow(workflowId);
    const session = this.sessions.get(workflowId);
    if (!session?.running) throw this.error('Manual Trigger requires this workflow to be running', 'NOT_RUNNING');
    if (workflow.mode === 'DESIGN') throw this.error('Manual Trigger is blocked in DESIGN mode', 'DESIGN_MODE');
    const node = workflow.nodes.find(item => item.id === nodeId);
    if (!node || node.type !== 'MANUAL_TRIGGER') throw this.error('Manual Trigger node not found in this workflow', 'NOT_FOUND');
    const mode = String(node.params.triggerMode ?? 'MOMENTARY');
    const previous = Boolean(session.nodeRuntime[nodeId]?.value ?? false);
    let value = previous;
    if (mode === 'TOGGLE') value = !previous;
    else if (mode === 'MOMENTARY') {
      if (!['press', 'release'].includes(action)) throw this.error('Momentary action must be press or release', 'INVALID_ACTION');
      value = action === 'press';
    } else if (mode === 'ONE_SHOT') value = true;
    else throw this.error('Unsupported trigger mode', 'INVALID_MODE');
    const timestamp = new Date().toISOString();
    session.nodeRuntime[nodeId] = { value, lastKnownValue: value, status: 'manual', quality: 'GOOD', lastValueChange: Object.is(previous, value) ? session.nodeRuntime[nodeId]?.lastValueChange : timestamp, consecutiveErrors: 0 };
    this.evaluate(workflow, session);
    this.broadcastRuntime(session);
    if (mode === 'ONE_SHOT') {
      const current = session.manualTriggerTimers.get(nodeId);
      if (current) clearTimeout(current);
      const duration = Math.max(10, Math.min(60000, Number(node.params.pulseDuration ?? 250)));
      session.manualTriggerTimers.set(nodeId, setTimeout(() => {
        session.manualTriggerTimers.delete(nodeId);
        if (!session.running) return;
        session.nodeRuntime[nodeId] = { value: false, lastKnownValue: false, status: 'manual', quality: 'GOOD', lastValueChange: new Date().toISOString(), consecutiveErrors: 0 };
        this.evaluate(workflow, session);
        this.broadcastRuntime(session);
      }, duration));
    }
    this.dependencies.audit({ timestamp, action: 'MANUAL_TRIGGER', workflowId, workflowName: workflow.name, nodeId, triggerMode: mode, runtimeAction: action, value, workflowMode: workflow.mode });
    return session.nodeRuntime[nodeId]!;
  }

  private async readNode(workflow: WorkflowDefinition, session: RuntimeSession, nodeId: string, inputIndex?: number): Promise<void> {
    if (!session.running) return;
    const node = workflow.nodes.find(item => item.id === nodeId);
    if (!node || !['MODBUS_INPUT','MODBUS_MULTI_INPUT'].includes(node.type)) return;
    const multi = node.type === 'MODBUS_MULTI_INPUT';
    const configs = multi ? (Array.isArray(node.params.inputs) ? node.params.inputs as Array<Record<string, unknown>> : []) : [node.params];
    const index = multi ? Math.max(0, Number(inputIndex ?? 0)) : 0;
    const config = configs[index];
    if (!config) return;
    const device = this.dependencies.getDevices().find(item => item.id === node.params.deviceId);
    const connection = device ? this.dependencies.getConnection(device.id) : undefined;
    const previousNode = session.nodeRuntime[node.id];
    const previousOutput = multi ? previousNode?.outputs?.[String(index)] : previousNode;
    const commit = (next: RuntimeValue) => {
      if (multi) {
        const outputs = { ...(session.nodeRuntime[node.id]?.outputs ?? {}), [String(index)]: next };
        const values = configs.map((_item, i) => outputs[String(i)]?.value);
        const qualities = Object.values(outputs).map(item => item.quality);
        const quality = qualities.includes('DISCONNECTED') ? 'DISCONNECTED' : qualities.includes('BAD') ? 'BAD' : qualities.includes('STALE') ? 'STALE' : qualities.includes('UNCERTAIN') ? 'UNCERTAIN' : 'GOOD';
        session.nodeRuntime[node.id] = { value: values, outputs, lastKnownValue: values, status: quality === 'GOOD' ? 'online' : 'partial', quality, error: Object.values(outputs).find(item => item.error)?.error, lastPollTime: next.lastPollTime, lastSuccessfulRead: next.lastSuccessfulRead, consecutiveErrors: Object.values(outputs).reduce((sum, item) => sum + item.consecutiveErrors, 0) };
      } else session.nodeRuntime[node.id] = next;
      this.evaluate(workflow, session);
      this.broadcastRuntime(session);
    };
    if (!device || !connection || connection.runtime.actualState !== 'connected') {
      commit({ value: previousOutput?.lastKnownValue, lastKnownValue: previousOutput?.lastKnownValue, status: 'disconnected', quality: 'DISCONNECTED', error: 'Device is not connected', consecutiveErrors: (previousOutput?.consecutiveErrors ?? 0) + 1 });
      return;
    }
    try {
      const functionCode = Number(config.functionCode ?? 1);
      const dataType = String(config.dataType ?? (functionCode <= 2 ? 'Boolean' : 'UInt16'));
      const quantity = functionCode <= 2 ? 1 : dataType === 'Float64' ? 4 : ['Int32','UInt32','Float32'].includes(dataType) ? 2 : 1;
      const started = Date.now();
      const response = await connection.request({ unitId: Number(node.params.unitId ?? device.defaultUnitId), fc: functionCode, address: Number(config.address ?? 0), quantity, workflowId: workflow.id, nodeId: `${node.id}:${index}` });
      if (!session.running) return;
      const values = parseRead(response, functionCode);
      const rawValue = functionCode <= 2 ? values[0] : decodeRegisters(values as number[], dataType, String(config.order ?? 'ABCD') as never);
      const value = typeof rawValue === 'number' ? rawValue * Number(config.scale ?? 1) + Number(config.offset ?? 0) : rawValue;
      const timestamp = new Date().toISOString();
      commit({ value, lastKnownValue: value, status: 'online', quality: 'GOOD', lastPollTime: timestamp, lastSuccessfulRead: timestamp, lastValueChange: previousOutput && Object.is(previousOutput.value, value) ? previousOutput.lastValueChange : timestamp, responseTime: Date.now() - started, consecutiveErrors: 0 });
    } catch (error) {
      session.lastError = (error as Error).message;
      commit({ value: previousOutput?.lastKnownValue, lastKnownValue: previousOutput?.lastKnownValue, status: 'error', quality: 'BAD', error: session.lastError, consecutiveErrors: (previousOutput?.consecutiveErrors ?? 0) + 1 });
      this.dependencies.audit({ timestamp: new Date().toISOString(), action: 'MULTI_INPUT_POLL_ERROR', workflowId: workflow.id, workflowName: workflow.name, nodeId: node.id, inputIndex: index, deviceId: node.params.deviceId, error: session.lastError });
    }
  }
  private evaluate(workflow: WorkflowDefinition, session: RuntimeSession): void {
    if (!session.running) return;
    const sources = new Set(['MODBUS_INPUT', 'MODBUS_MULTI_INPUT', 'MANUAL_TRIGGER', 'BOOLEAN_CONSTANT', 'NUMERIC_CONSTANT']);
    for (const node of workflow.nodes) {
      if (node.type === 'BOOLEAN_CONSTANT' || node.type === 'NUMERIC_CONSTANT') {
        const value = node.params.value ?? (node.type === 'BOOLEAN_CONSTANT' ? false : 0);
        const previous = session.nodeRuntime[node.id];
        session.nodeRuntime[node.id] = { value, lastKnownValue: value, status: 'calculated', quality: 'GOOD', lastValueChange: previous && Object.is(previous.value, value) ? previous.lastValueChange : new Date().toISOString(), consecutiveErrors: 0 };
      }
      if (node.type === 'MANUAL_TRIGGER' && !session.nodeRuntime[node.id]) session.nodeRuntime[node.id] = { value: false, lastKnownValue: false, status: 'manual', quality: 'GOOD', lastValueChange: new Date().toISOString(), consecutiveErrors: 0 };
    }
    const calculated = new Set(workflow.nodes.filter(node => sources.has(node.type)).map(node => node.id));
    const edges = workflow.edges.filter(edge => edge.enabled);
    const maxPasses = Math.max(1, Number(workflow.settings.maxPasses ?? 100));
    let progressed = true;
    let pass = 0;
    while (progressed && pass < maxPasses) {
      progressed = false;
      pass += 1;
      for (const node of workflow.nodes) {
        if (calculated.has(node.id) || sources.has(node.type)) continue;
        const incoming = edges.filter(edge => edge.target === node.id);
        if (node.type === 'MODBUS_OUTPUT') {
          const source = incoming.find(edge => edge.targetPort === 0);
          if (!source || !calculated.has(source.source)) continue;
          const sourceBase=session.nodeRuntime[source.source];const sourceRuntime=sourceBase?.outputs?.[String(source.sourcePort)]??sourceBase;
          if (!sourceRuntime) continue;
          const command = sourceRuntime.value;
          const quality = sourceRuntime.quality;
          const effective = typeof command === 'boolean' && String(node.params.polarity ?? 'NORMAL') === 'ACTIVE_LOW' ? !command : command;
          const previous = session.nodeRuntime[node.id];
          session.nodeRuntime[node.id] = { value: command, lastKnownValue: quality === 'GOOD' ? command : previous?.lastKnownValue, commandedValue: command, effectiveValue: effective, status: quality === 'GOOD' ? 'calculated' : 'blocked', quality: quality === 'GOOD' ? 'GOOD' : 'UNCERTAIN', error: quality === 'GOOD' ? undefined : 'Source quality is not GOOD', lastValueChange: previous && Object.is(previous.commandedValue, command) ? previous.lastValueChange : new Date().toISOString(), consecutiveErrors: quality === 'GOOD' ? 0 : (previous?.consecutiveErrors ?? 0) + 1 };
          calculated.add(node.id);
          progressed = true;
          continue;
        }
        const inputs: RuntimeValue[] = [];
        let ready = true;
        for (let port = 0; port < node.inputCount; port += 1) {
          const edge = incoming.find(item => item.targetPort === port);
          if (!edge || !calculated.has(edge.source) || !session.nodeRuntime[edge.source]) { ready = false; break; }
          const sourceBase=session.nodeRuntime[edge.source]!;inputs.push(sourceBase.outputs?.[String(edge.sourcePort)]??sourceBase);
        }
        if (!ready) continue;
        const previous = session.nodeRuntime[node.id];
        const next = evaluateNode(node, inputs, session.engineMemory);
        next.lastKnownValue = next.quality === 'GOOD' ? next.value : previous?.lastKnownValue;
        next.lastValueChange = previous && Object.is(previous.value, next.value) ? previous.lastValueChange : new Date().toISOString();
        session.nodeRuntime[node.id] = next;
        calculated.add(node.id);
        progressed = true;
      }
    }
    session.evaluationCount += 1;
    session.lastEvaluationTime = new Date().toISOString();
    this.scheduleOutputs(workflow, session);
  }

  private scheduleOutputs(workflow: WorkflowDefinition, session: RuntimeSession): void {
    if (!session.running || workflow.mode !== 'LIVE_ARMED' || !this.dependencies.allowWrites) return;
    for (const node of workflow.nodes.filter(item => item.type === 'MODBUS_OUTPUT')) {
      const state = session.nodeRuntime[node.id];
      if (state?.quality === 'GOOD') void this.writeOutput(workflow, session, node.id, state.commandedValue);
    }
  }

  private async writeOutput(workflow: WorkflowDefinition, session: RuntimeSession, nodeId: string, command: unknown): Promise<void> {
    if (!session.running || session.outputPending.has(nodeId)) return;
    const node = workflow.nodes.find(item => item.id === nodeId);
    if (!node) return;
    const resource = this.resourceKey(node);
    const owner = this.outputOwners.get(resource);
    if (owner && owner !== workflow.id) {
      session.nodeRuntime[nodeId] = { ...session.nodeRuntime[nodeId]!, status: 'blocked', quality: 'BAD', error: `Output resource is owned by workflow ${owner}`, consecutiveErrors: 1 };
      session.lastError = `Output conflict with ${owner}`;
      this.broadcastRuntime(session);
      return;
    }
    if (node.params.writeOnChange !== false && session.outputInitialized.has(nodeId) && Object.is(session.lastWrittenCommand.get(nodeId), command)) return;
    const minimum = Math.max(0, Number(node.params.minimumWriteInterval ?? 0));
    if (Date.now() - (session.lastWriteAt.get(nodeId) ?? 0) < minimum) return;
    const device = this.dependencies.getDevices().find(item => item.id === node.params.deviceId);
    const connection = device ? this.dependencies.getConnection(device.id) : undefined;
    if (!device || !connection || connection.runtime.actualState !== 'connected') return;
    const initialPolicy = String(node.params.initialWritePolicy ?? 'READ_FIRST');
    if (!session.outputInitialized.has(nodeId) && initialPolicy === 'DO_NOT_WRITE_UNTIL_CHANGE') {
      session.outputInitialized.add(nodeId);
      session.lastWrittenCommand.set(nodeId, command);
      return;
    }
    session.outputPending.add(nodeId);
    try {
      const polarity = String(node.params.polarity ?? 'NORMAL') as 'NORMAL' | 'ACTIVE_LOW';
      const functionCode = Number(node.params.functionCode ?? 5);
      const effective = typeof command === 'boolean' && polarity === 'ACTIVE_LOW' ? !command : command;
      const values = functionCode === 5 ? [coilPayload(Boolean(command), polarity)] : encodeValue(Number(effective), String(node.params.dataType ?? 'UInt16'), String(node.params.order ?? 'ABCD') as never);
      await connection.request({ unitId: Number(node.params.unitId ?? device.defaultUnitId), fc: functionCode, address: Number(node.params.address ?? 0), values, priority: true, workflowId: workflow.id, nodeId });
      if (!session.running) return;
      session.outputInitialized.add(nodeId);
      session.lastWrittenCommand.set(nodeId, command);
      session.lastWriteAt.set(nodeId, Date.now());
      session.nodeRuntime[nodeId] = { ...session.nodeRuntime[nodeId]!, status: 'written', writeStatus: 'WRITTEN', lastWriteTime: new Date().toISOString(), error: undefined, consecutiveErrors: 0 };
      this.dependencies.audit({ timestamp: new Date().toISOString(), action: 'AUTOMATIC_WRITE', workflowId: workflow.id, workflowName: workflow.name, nodeId, deviceId: device.id, functionCode, address: Number(node.params.address ?? 0), command, effective });
    } catch (error) {
      session.lastError = (error as Error).message;
      session.nodeRuntime[nodeId] = { ...session.nodeRuntime[nodeId]!, status: 'error', writeStatus: 'ERROR', quality: 'BAD', error: session.lastError, consecutiveErrors: (session.nodeRuntime[nodeId]?.consecutiveErrors ?? 0) + 1 };
    } finally {
      session.outputPending.delete(nodeId);
      this.broadcastRuntime(session);
    }
  }

  private syncPollers(workflow: WorkflowDefinition, session: RuntimeSession): void {
    for (const timer of session.pollers.values()) clearInterval(timer);
    session.pollers.clear();
    if (!session.running || !['LIVE_LOCKED', 'LIVE_ARMED'].includes(workflow.mode)) return;
    for (const node of workflow.nodes.filter(item => item.type === 'MODBUS_INPUT' || item.type === 'MODBUS_MULTI_INPUT')) {
      const device = this.dependencies.getDevices().find(item => item.id === node.params.deviceId);
      const connection = device ? this.dependencies.getConnection(device.id) : undefined;
      if (connection?.runtime.actualState !== 'connected') continue;
      if (node.type === 'MODBUS_MULTI_INPUT') {
        const inputs = Array.isArray(node.params.inputs) ? node.params.inputs as Array<Record<string, unknown>> : [];
        inputs.slice(0, 8).forEach((config, index) => {
          const key = `${node.id}:${index}`;
          void this.readNode(workflow, session, node.id, index);
          session.pollers.set(key, setInterval(() => void this.readNode(workflow, session, node.id, index), Math.max(100, Number(config.scanInterval ?? 1000))));
        });
      } else {
        void this.readNode(workflow, session, node.id);
        session.pollers.set(node.id, setInterval(() => void this.readNode(workflow, session, node.id), Math.max(100, Number(node.params.scanInterval ?? 1000))));
      }
    }
  }
  private stopSession(workflow: WorkflowDefinition, session: RuntimeSession): void {
    for (const timer of session.pollers.values()) clearInterval(timer);
    for (const timer of session.timers.values()) clearTimeout(timer);
    for (const timer of session.manualTriggerTimers.values()) clearTimeout(timer);
    session.pollers.clear(); session.timers.clear(); session.manualTriggerTimers.clear();
    session.engineMemory.clear(); session.outputPending.clear(); session.outputInitialized.clear(); session.lastWrittenCommand.clear(); session.lastWriteAt.clear();
    session.running = false;
    session.stoppedAt = new Date().toISOString();
    for (const node of workflow.nodes) if (node.type === 'MODBUS_OUTPUT') this.outputOwners.delete(this.resourceKey(node));
    this.dependencies.broadcast('workflow-state', { running: false, mode: workflow.mode }, workflow.id);
    this.broadcastRuntime(session);
  }

  private initializeSources(workflow: WorkflowDefinition, session: RuntimeSession): void {
    for (const node of workflow.nodes) {
      if (node.type === 'MANUAL_TRIGGER') session.nodeRuntime[node.id] ??= { value: false, lastKnownValue: false, status: 'manual', quality: 'GOOD', lastValueChange: new Date().toISOString(), consecutiveErrors: 0 };
    }
  }

  private claimOutputs(workflow: WorkflowDefinition): void {
    if (workflow.mode !== 'LIVE_ARMED') return;
    for (const node of workflow.nodes.filter(item => item.type === 'MODBUS_OUTPUT')) this.outputOwners.set(this.resourceKey(node), workflow.id);
  }

  private assertOutputConflicts(workflow: WorkflowDefinition): void {
    for (const node of workflow.nodes.filter(item => item.type === 'MODBUS_OUTPUT')) {
      const owner = this.outputOwners.get(this.resourceKey(node));
      if (owner && owner !== workflow.id) throw this.error(`Output resource conflict with workflow ${owner}`, 'OUTPUT_CONFLICT');
    }
  }

  private resourceKey(node: WorkflowDefinition['nodes'][number]): string {
    return [node.params.deviceId, node.params.unitId ?? 1, node.params.functionCode ?? 5, node.params.address ?? 0, node.params.quantity ?? 1].join(':');
  }

  private broadcastRuntime(session: RuntimeSession): void {
    this.dependencies.broadcast('runtime', session.nodeRuntime, session.workflowId);
  }

  private createSession(workflowId: string): RuntimeSession {
    return { workflowId, running: false, evaluationCount: 0, nodeRuntime: {}, engineMemory: new Map(), pollers: new Map(), timers: new Map(), manualTriggerTimers: new Map(), outputPending: new Set(), outputInitialized: new Set(), lastWrittenCommand: new Map(), lastWriteAt: new Map() };
  }

  private summaryOf(session: RuntimeSession): RuntimeSessionSummary {
    return { workflowId: session.workflowId, running: session.running, startedAt: session.startedAt, stoppedAt: session.stoppedAt, lastEvaluationTime: session.lastEvaluationTime, evaluationCount: session.evaluationCount, nodeRuntimeCount: Object.keys(session.nodeRuntime).length, pollerCount: session.pollers.size, timerCount: session.timers.size + session.manualTriggerTimers.size, pendingWriteCount: session.outputPending.size, lastError: session.lastError };
  }

  private requireWorkflow(workflowId: string): WorkflowDefinition {
    const workflow = this.dependencies.workflows.get(workflowId);
    if (!workflow) throw this.error('Workflow not found', 'NOT_FOUND');
    return workflow;
  }

  private error(message: string, code: string): Error & { code: string } {
    return Object.assign(new Error(message), { code });
  }
}
