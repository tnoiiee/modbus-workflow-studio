import { randomUUID } from 'node:crypto';
import type { DeviceConnection } from './modbus.js';
import { WORKFLOW_WRITE_EXPIRY_MS } from './modbus.js';
import type { DeviceConfig, RuntimeValue } from './types.js';
import type { WorkflowDefinition, WorkflowManager } from './workflowManager.js';
import { parseRead } from './modbus.js';
import { decodeRegisters } from './codec.js';
import { evaluateNode, validateWorkflow } from './engine.js';
import { encodeWorkflowWrite, validateWriteConfiguration, validateWriteValue } from './writeValidation.js';
import type { TagSample, TagUpdate } from './tagRuntime.js';

export interface RuntimeSessionSummary {
  workflowId: string; running: boolean; startedAt?: string; stoppedAt?: string; lastEvaluationTime?: string;
  evaluationCount: number; nodeRuntimeCount: number; pollerCount: number; timerCount: number; pendingWriteCount: number; lastError?: string;
}
interface PendingCommand { commandId: string; deviceId: string; runtimeGeneration: number; connectionGeneration: number; createdAt: string; createdAtMonotonic: number; expiresAtMonotonic: number; status: 'QUEUED' | 'WRITING'; resourceKey: string }
interface RuntimeSession {
  workflowId: string; running: boolean; generation: number; startedAt?: string; stoppedAt?: string; lastEvaluationTime?: string;
  evaluationCount: number; lastError?: string; nodeRuntime: Record<string, RuntimeValue>; engineMemory: Map<string, unknown>;
  pollers: Map<string, NodeJS.Timeout>; timers: Map<string, NodeJS.Timeout>; manualTriggerTimers: Map<string, NodeJS.Timeout>;
  pendingCommands: Map<string, PendingCommand>; ownedOutputs: Map<string, { deviceId: string; resourceKeys: string[] }>; outputInitialized: Set<string>; blockedCommands: Map<string, unknown>; lastWrittenCommand: Map<string, unknown>;
  lastWriteAt: Map<string, number>; readBackUnsubscribe?: () => void;
}
export interface ReadBackState { availability: string; sample: TagSample | null }
interface RuntimeDependencies {
  workflows: WorkflowManager; getDevices: () => DeviceConfig[]; getConnection: (deviceId: string) => DeviceConnection | undefined;
  allowWrites: boolean; broadcast: (type: string, data: unknown, workflowId?: string) => void;
  audit: (entry: Record<string, unknown>) => void; monotonicNow?: () => number; wallNow?: () => number;
  readBack?: (sourceId: string) => ReadBackState; subscribeTags?: (listener: (update: TagUpdate) => void) => () => void;
}
const tagUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class WorkflowRuntimeManager {
  private readonly sessions = new Map<string, RuntimeSession>();
  private readonly outputOwners = new Map<string, string>();
  private readonly mono = () => this.dependencies.monotonicNow?.() ?? performance.now();
  private readonly wall = () => this.dependencies.wallNow?.() ?? Date.now();
  constructor(private readonly dependencies: RuntimeDependencies) {}

  list(): RuntimeSessionSummary[] { return [...this.sessions.values()].map(session => this.summaryOf(session)); }
  summary(workflowId: string): RuntimeSessionSummary | undefined { const s = this.sessions.get(workflowId); return s ? this.summaryOf(s) : undefined; }
  runtime(workflowId: string): Record<string, RuntimeValue> | undefined { const s = this.sessions.get(workflowId); return s ? structuredClone(s.nodeRuntime) : undefined; }
  nodeRuntime(workflowId: string, nodeId: string): RuntimeValue | undefined { const value = this.sessions.get(workflowId)?.nodeRuntime[nodeId]; return value ? structuredClone(value) : undefined; }
  isRunning(workflowId: string): boolean { return this.sessions.get(workflowId)?.running === true; }

  start(workflowId: string): RuntimeSessionSummary {
    const workflow = this.requireWorkflow(workflowId);
    if (!workflow.enabled) throw this.error('Workflow is disabled', 'DISABLED');
    if (workflow.mode === 'DESIGN') throw this.error('DESIGN workflow cannot run', 'DESIGN_MODE');
    if (workflow.mode === 'LIVE_ARMED') {
      if (!this.dependencies.allowWrites) throw this.error('LIVE ARMED is blocked because ALLOW_WRITES=false', 'WRITE_BLOCKED');
      const critical = validateWorkflow(workflow, new Set(this.dependencies.getDevices().map(device => device.id))).filter(x => x.severity === 'critical');
      if (critical.length) throw this.error(`LIVE ARMED is blocked by ${critical.length} critical validation error(s)`, 'VALIDATION');
      for (const node of workflow.nodes.filter(n => n.type === 'MODBUS_OUTPUT')) {
        const device = this.dependencies.getDevices().find(d => d.id === node.params.deviceId);
        if (!device?.enabled) throw this.error(`Output Device is missing or disabled for node ${node.id}`, 'DEVICE_DISABLED');
      }
      this.assertOutputConflicts(workflow);
    }
    const existing = this.sessions.get(workflowId);
    if (existing?.running) return this.summaryOf(existing);
    const session = existing ?? this.createSession(workflowId);
    session.generation += 1; session.running = true; session.startedAt = this.timestamp(); session.stoppedAt = undefined; session.lastError = undefined;
    session.nodeRuntime = {}; session.engineMemory.clear(); session.pendingCommands.clear(); session.outputInitialized.clear(); session.blockedCommands.clear(); session.lastWrittenCommand.clear(); session.lastWriteAt.clear();
    this.sessions.set(workflowId, session);
    this.claimOutputs(workflow, session);
    this.initializeSources(workflow, session);
    this.syncReadBack(workflow, session);
    this.subscribeReadBack(workflow, session);
    this.evaluate(workflow, session);
    this.syncPollers(workflow, session);
    this.broadcastRuntime(session);
    this.dependencies.audit({ timestamp: this.timestamp(), action: 'RUN_WORKFLOW', workflowId, workflowName: workflow.name, runtimeGeneration: session.generation });
    return this.summaryOf(session);
  }

  stop(workflowId: string): RuntimeSessionSummary {
    const workflow = this.requireWorkflow(workflowId); const session = this.sessions.get(workflowId) ?? this.createSession(workflowId);
    this.stopSession(workflow, session); this.dependencies.audit({ timestamp: this.timestamp(), action: 'STOP_WORKFLOW', workflowId, workflowName: workflow.name }); return this.summaryOf(session);
  }
  stopAll(): number {
    let stopped = 0;
    for (const [id, session] of this.sessions) { if (!session.running) continue; const w = this.dependencies.workflows.get(id); if (!w) continue; this.stopSession(w, session); stopped++; }
    this.dependencies.audit({ timestamp: this.timestamp(), action: 'STOP_ALL_WORKFLOWS', stopped }); return stopped;
  }
  delete(workflowId: string): void {
    const session = this.sessions.get(workflowId), workflow = this.dependencies.workflows.get(workflowId);
    if (session && workflow) this.stopSession(workflow, session); this.sessions.delete(workflowId);
  }

  onDeviceDisconnected(deviceId: string): void {
    for (const [workflowId, session] of this.sessions) {
      if (!session.running) continue; const workflow = this.dependencies.workflows.get(workflowId); if (!workflow) continue;
      const connection = this.dependencies.getConnection(deviceId); connection?.cancelWorkflowWrites(workflowId, session.generation);
      for (const [key, timer] of session.pollers) {
        const node = workflow.nodes.find(item => item.id === key.split(':')[0]); if (node?.params.deviceId !== deviceId) continue;
        clearInterval(timer); session.pollers.delete(key);
        const baseId = key.split(':')[0]!, index = key.includes(':') ? key.split(':')[1] : undefined, previous = session.nodeRuntime[baseId];
        if (index !== undefined) {
          const prev = previous?.outputs?.[index], outputs = { ...(previous?.outputs ?? {}), [index]: { value: prev?.lastKnownValue, lastKnownValue: prev?.lastKnownValue, status: 'disconnected', quality: 'DISCONNECTED' as const, error: 'Device is not connected', consecutiveErrors: (prev?.consecutiveErrors ?? 0) + 1 } };
          session.nodeRuntime[baseId] = { value: Object.keys(outputs).sort().map(k => outputs[k]?.value), outputs, lastKnownValue: previous?.lastKnownValue, status: 'disconnected', quality: 'DISCONNECTED', consecutiveErrors: Object.values(outputs).reduce((n, x) => n + x.consecutiveErrors, 0) };
        } else session.nodeRuntime[baseId] = { ...previous, value: previous?.lastKnownValue, lastKnownValue: previous?.lastKnownValue, status: 'disconnected', quality: 'DISCONNECTED', error: 'Device is not connected', consecutiveErrors: (previous?.consecutiveErrors ?? 0) + 1 };
      }
      for (const node of workflow.nodes.filter(n => n.type === 'MODBUS_OUTPUT' && n.params.deviceId === deviceId)) {
        const prior = session.nodeRuntime[node.id]; if (!prior) continue;
        const pending = session.pendingCommands.get(node.id), onWire = Boolean(pending && connection?.activeRequest?.commandId === pending.commandId);
        if (Object.prototype.hasOwnProperty.call(prior, 'commandedValue')) session.blockedCommands.set(node.id, prior.commandedValue);
        session.nodeRuntime[node.id] = { ...prior, status: onWire ? 'failed' : 'blocked', writeStatus: onWire ? 'FAILED' : 'REJECTED', queueState: onWire ? 'ON_WIRE' : 'CANCELLED', admissionResult: onWire ? prior.admissionResult : 'REJECTED', rejectionReason: 'MANUAL_DISCONNECT', error: onWire ? 'Connection lost while write was on wire; outcome unconfirmed' : 'Manual Disconnect blocks writes' };
        session.pendingCommands.delete(node.id);
      }
      this.evaluate(workflow, session); this.broadcastRuntime(session);
    }
  }
  onDeviceConnected(deviceId: string): void {
    for (const [id, session] of this.sessions) { if (!session.running) continue; const w = this.dependencies.workflows.get(id); if (w?.nodes.some(n => n.params.deviceId === deviceId)) this.syncPollers(w, session); }
  }
  refresh(workflowId: string): void {
    const session = this.sessions.get(workflowId), workflow = this.dependencies.workflows.get(workflowId); if (!session?.running || !workflow) return;
    const wasRunning = session.running; this.invalidateGeneration(workflow, session, 'WORKFLOW_REVISION_CHANGED'); this.releaseOutputs(workflow, session);
    if (workflow.mode === 'LIVE_ARMED') { this.assertOutputConflicts(workflow); this.claimOutputs(workflow, session); }
    session.running = wasRunning; this.initializeSources(workflow, session); this.syncReadBack(workflow, session); this.subscribeReadBack(workflow, session);
    this.syncPollers(workflow, session); this.evaluate(workflow, session); this.broadcastRuntime(session);
  }

  manualTrigger(workflowId: string, nodeId: string, action: string): RuntimeValue {
    const workflow = this.requireWorkflow(workflowId), session = this.sessions.get(workflowId);
    if (!session?.running) throw this.error('Manual Trigger requires this workflow to be running', 'NOT_RUNNING');
    if (workflow.mode === 'DESIGN') throw this.error('Manual Trigger is blocked in DESIGN mode', 'DESIGN_MODE');
    const node = workflow.nodes.find(item => item.id === nodeId); if (!node || node.type !== 'MANUAL_TRIGGER') throw this.error('Manual Trigger node not found in this workflow', 'NOT_FOUND');
    const mode = String(node.params.triggerMode ?? 'MOMENTARY'), previous = Boolean(session.nodeRuntime[nodeId]?.value ?? false); let value = previous;
    if (mode === 'TOGGLE') value = !previous;
    else if (mode === 'MOMENTARY') { if (!['press', 'release'].includes(action)) throw this.error('Momentary action must be press or release', 'INVALID_ACTION'); value = action === 'press'; }
    else if (mode === 'ONE_SHOT') value = true; else throw this.error('Unsupported trigger mode', 'INVALID_MODE');
    const at = this.timestamp();
    session.nodeRuntime[nodeId] = { value, lastKnownValue: value, status: 'manual', quality: 'GOOD', lastValueChange: Object.is(previous, value) ? session.nodeRuntime[nodeId]?.lastValueChange : at, consecutiveErrors: 0 };
    this.evaluate(workflow, session); this.broadcastRuntime(session);
    if (mode === 'ONE_SHOT') {
      const old = session.manualTriggerTimers.get(nodeId); if (old) clearTimeout(old);
      const generation = session.generation, duration = Math.max(10, Math.min(60000, Number(node.params.pulseDuration ?? 250)));
      session.manualTriggerTimers.set(nodeId, setTimeout(() => {
        session.manualTriggerTimers.delete(nodeId); if (!session.running || session.generation !== generation) return;
        session.nodeRuntime[nodeId] = { value: false, lastKnownValue: false, status: 'manual', quality: 'GOOD', lastValueChange: this.timestamp(), consecutiveErrors: 0 };
        this.evaluate(workflow, session); this.broadcastRuntime(session);
      }, duration));
    }
    this.dependencies.audit({ timestamp: at, action: 'MANUAL_TRIGGER', workflowId, workflowName: workflow.name, nodeId, triggerMode: mode, runtimeAction: action, value, workflowMode: workflow.mode });
    return structuredClone(session.nodeRuntime[nodeId]!);
  }

  private async readNode(workflow: WorkflowDefinition, session: RuntimeSession, nodeId: string, inputIndex?: number): Promise<void> {
    if (!session.running) return;
    const node = workflow.nodes.find(item => item.id === nodeId); if (!node || !['MODBUS_INPUT', 'MODBUS_MULTI_INPUT'].includes(node.type)) return;
    const multi = node.type === 'MODBUS_MULTI_INPUT', configs = multi ? Array.isArray(node.params.inputs) ? node.params.inputs as Array<Record<string, unknown>> : [] : [node.params];
    const index = inputIndex ?? 0, config = configs[index]; if (!config) return;
    const device = this.dependencies.getDevices().find(item => item.id === node.params.deviceId), connection = device ? this.dependencies.getConnection(device.id) : undefined;
    const generation = session.generation, connectionGeneration = connection?.generation ?? -1;
    const previous = session.nodeRuntime[node.id], previousOutput = multi ? previous?.outputs?.[String(index)] : previous;
    const commit = (next: RuntimeValue) => {
      if (!session.running || session.generation !== generation) return;
      if (multi) {
        const outputs = { ...(session.nodeRuntime[node.id]?.outputs ?? {}), [String(index)]: next }, values = configs.map((_x, i) => outputs[String(i)]?.value);
        const qualities = Object.values(outputs).map(x => x.quality);
        const quality = qualities.includes('DISCONNECTED') ? 'DISCONNECTED' : qualities.includes('BAD') ? 'BAD' : qualities.includes('STALE') ? 'STALE' : qualities.includes('UNCERTAIN') ? 'UNCERTAIN' : 'GOOD';
        session.nodeRuntime[node.id] = { value: values, outputs, lastKnownValue: values, status: quality === 'GOOD' ? 'online' : 'partial', quality, error: Object.values(outputs).find(x => x.error)?.error, lastPollTime: next.lastPollTime, lastSuccessfulRead: next.lastSuccessfulRead, consecutiveErrors: Object.values(outputs).reduce((sum, x) => sum + x.consecutiveErrors, 0) };
      } else session.nodeRuntime[node.id] = next;
      this.evaluate(workflow, session); this.broadcastRuntime(session);
    };
    if (!device || !device.enabled || !connection || connection.runtime.actualState !== 'connected' || connection.manual) {
      commit({ value: previousOutput?.lastKnownValue, lastKnownValue: previousOutput?.lastKnownValue, status: 'disconnected', quality: 'DISCONNECTED', error: 'Device is not connected or enabled', consecutiveErrors: (previousOutput?.consecutiveErrors ?? 0) + 1 }); return;
    }
    try {
      const fc = Number(config.functionCode ?? 1), type = String(config.dataType ?? (fc <= 2 ? 'Boolean' : 'UInt16'));
      const quantity = fc <= 2 ? 1 : type === 'Float64' ? 4 : ['Int32', 'UInt32', 'Float32'].includes(type) ? 2 : 1;
      const started = this.wall(), response = await connection.request({ unitId: Number(node.params.unitId ?? device.defaultUnitId), fc, address: Number(config.address ?? 0), quantity, workflowId: workflow.id, nodeId: inputIndex === undefined ? node.id : `${node.id}:${inputIndex}` });
      if (!session.running || session.generation !== generation || connection.generation !== connectionGeneration) return;
      const raw = parseRead(response, fc), rawValue = fc <= 2 ? raw[0] : decodeRegisters(raw as number[], type, String(config.order ?? 'ABCD') as never);
      const value = typeof rawValue === 'number' ? rawValue * Number(config.scale ?? 1) + Number(config.offset ?? 0) : rawValue, timestamp = this.timestamp();
      commit({ value, lastKnownValue: value, status: 'online', quality: 'GOOD', lastPollTime: timestamp, lastSuccessfulRead: timestamp, lastValueChange: previousOutput && Object.is(previousOutput.value, value) ? previousOutput.lastValueChange : timestamp, responseTime: this.wall() - started, consecutiveErrors: 0 });
    } catch (error) {
      if (!session.running || session.generation !== generation || connection.generation !== connectionGeneration) return;
      session.lastError = (error as Error).message; commit({ value: previousOutput?.lastKnownValue, lastKnownValue: previousOutput?.lastKnownValue, status: 'error', quality: 'BAD', error: session.lastError, consecutiveErrors: (previousOutput?.consecutiveErrors ?? 0) + 1 });
      this.dependencies.audit({ timestamp: this.timestamp(), action: 'MULTI_INPUT_POLL_ERROR', workflowId: workflow.id, workflowName: workflow.name, nodeId: node.id, inputIndex: index, deviceId: node.params.deviceId, error: session.lastError });
    }
  }

  private evaluate(workflow: WorkflowDefinition, session: RuntimeSession): void {
    if (!session.running) return;
    const sources = new Set(['MODBUS_INPUT', 'MODBUS_MULTI_INPUT', 'MANUAL_TRIGGER', 'BOOLEAN_CONSTANT', 'NUMERIC_CONSTANT']);
    for (const node of workflow.nodes) {
      if (node.type === 'BOOLEAN_CONSTANT' || node.type === 'NUMERIC_CONSTANT') {
        const value = node.params.value ?? (node.type === 'BOOLEAN_CONSTANT' ? false : 0), previous = session.nodeRuntime[node.id];
        session.nodeRuntime[node.id] = { ...previous, value, lastKnownValue: value, status: 'calculated', quality: 'GOOD', lastValueChange: previous && Object.is(previous.value, value) ? previous.lastValueChange : this.timestamp(), consecutiveErrors: 0 };
      }
      if (node.type === 'MANUAL_TRIGGER' && !session.nodeRuntime[node.id]) session.nodeRuntime[node.id] = { value: false, lastKnownValue: false, status: 'manual', quality: 'GOOD', lastValueChange: this.timestamp(), consecutiveErrors: 0 };
    }
    const calculated = new Set(workflow.nodes.filter(node => sources.has(node.type)).map(node => node.id)), edges = workflow.edges.filter(edge => edge.enabled);
    const maxPasses = Math.max(1, Number(workflow.settings.maxPasses ?? 100)); let progressed = true, pass = 0;
    while (progressed && pass < maxPasses) {
      progressed = false; pass++;
      for (const node of workflow.nodes) {
        if (calculated.has(node.id) || sources.has(node.type)) continue;
        const incoming = edges.filter(edge => edge.target === node.id);
        if (node.type === 'MODBUS_OUTPUT') {
          const source = incoming.find(edge => edge.targetPort === 0); if (!source || !calculated.has(source.source)) continue;
          const base = session.nodeRuntime[source.source], sourceRuntime = base?.outputs?.[String(source.sourcePort)] ?? base; if (!sourceRuntime) continue;
          const command = sourceRuntime.value, quality = sourceRuntime.quality, previous = session.nodeRuntime[node.id];
          session.nodeRuntime[node.id] = { ...previous, value: command, lastKnownValue: quality === 'GOOD' ? command : previous?.lastKnownValue, commandedValue: command,
            status: quality === 'GOOD' ? previous?.status ?? 'calculated' : 'blocked', quality: quality === 'GOOD' ? 'GOOD' : 'UNCERTAIN',
            error: quality === 'GOOD' ? previous?.error : 'Source quality is not GOOD', lastValueChange: previous && Object.is(previous.commandedValue, command) ? previous.lastValueChange : this.timestamp(),
            consecutiveErrors: quality === 'GOOD' ? 0 : (previous?.consecutiveErrors ?? 0) + 1 };
          calculated.add(node.id); progressed = true; continue;
        }
        const inputs: RuntimeValue[] = []; let ready = true;
        for (let port = 0; port < node.inputCount; port++) {
          const edge = incoming.find(item => item.targetPort === port);
          if (!edge || !calculated.has(edge.source) || !session.nodeRuntime[edge.source]) { ready = false; break; }
          const base = session.nodeRuntime[edge.source]!; inputs.push(base.outputs?.[String(edge.sourcePort)] ?? base);
        }
        if (!ready) continue;
        const previous = session.nodeRuntime[node.id], next = evaluateNode(node, inputs, session.engineMemory);
        next.lastKnownValue = next.quality === 'GOOD' ? next.value : previous?.lastKnownValue;
        next.lastValueChange = previous && Object.is(previous.value, next.value) ? previous.lastValueChange : this.timestamp();
        session.nodeRuntime[node.id] = next; calculated.add(node.id); progressed = true;
      }
    }
    for (const node of workflow.nodes) if (!sources.has(node.type) && !calculated.has(node.id)) {
      session.nodeRuntime[node.id] = { ...session.nodeRuntime[node.id], value: session.nodeRuntime[node.id]?.lastKnownValue, lastKnownValue: session.nodeRuntime[node.id]?.lastKnownValue,
        status: 'blocked', quality: 'UNCERTAIN', error: pass >= maxPasses ? 'Maximum workflow passes reached' : 'Required input is not ready', consecutiveErrors: (session.nodeRuntime[node.id]?.consecutiveErrors ?? 0) + 1 };
    }
    session.evaluationCount++; session.lastEvaluationTime = this.timestamp(); this.scheduleOutputs(workflow, session);
  }

  private scheduleOutputs(workflow: WorkflowDefinition, session: RuntimeSession): void {
    if (!session.running || workflow.mode !== 'LIVE_ARMED' || !this.dependencies.allowWrites) return;
    for (const node of workflow.nodes.filter(item => item.type === 'MODBUS_OUTPUT')) {
      const state = session.nodeRuntime[node.id]; if (state?.quality === 'GOOD') void this.writeOutput(workflow, session, node, state.commandedValue);
    }
  }

  private async writeOutput(workflow: WorkflowDefinition, session: RuntimeSession, node: WorkflowDefinition['nodes'][number], command: unknown): Promise<void> {
    if (!session.running || workflow.mode !== 'LIVE_ARMED' || !this.dependencies.allowWrites) return;
    if (session.blockedCommands.has(node.id)) {
      if (Object.is(session.blockedCommands.get(node.id), command)) return;
      session.blockedCommands.delete(node.id);
    }
    const device = this.dependencies.getDevices().find(item => item.id === node.params.deviceId), connection = device ? this.dependencies.getConnection(device.id) : undefined;
    const reason = !device ? 'DEVICE_MISSING' : !device.enabled ? 'DEVICE_DISABLED' : !connection || connection.runtime.actualState !== 'connected' || connection.manual ? 'DEVICE_NOT_CONNECTED' : undefined;
    const validated = validateWriteConfiguration(node, device);
    const invalidValue = validated.config ? validateWriteValue(validated.config, command) : undefined;
    const resourceKey = this.resourceKeys(node, device)[0] ?? '';
    const owner = this.outputOwners.get(resourceKey);
    const conflict = !owner || owner !== `${workflow.id}:${node.id}`;
    const existing = session.pendingCommands.get(node.id);
    const writeMode = String(node.params.writeMode ?? 'AUTOMATIC');
    if (existing && Object.is(session.nodeRuntime[node.id]?.commandedValue, command)) return;
    if (node.params.writeOnChange !== false && session.outputInitialized.has(node.id) && Object.is(session.lastWrittenCommand.get(node.id), command)) return;
    const minInterval = node.params.minimumWriteInterval === undefined ? 0 : node.params.minimumWriteInterval;
    const badInterval = typeof minInterval !== 'number' || !Number.isFinite(minInterval) || minInterval < 0 || minInterval > 3600000;
    const rateLimited = !badInterval && this.mono() - (session.lastWriteAt.get(node.id) ?? -Infinity) < minInterval;
    const rejection = reason ?? validated.reason ?? invalidValue ?? (conflict ? 'OUTPUT_OWNERSHIP_REJECTED' : undefined) ?? (writeMode === 'MANUAL_ONLY' ? 'WRITE_MODE_MANUAL_ONLY' : undefined) ?? (badInterval ? 'INVALID_MINIMUM_WRITE_INTERVAL' : undefined) ?? (rateLimited ? 'MINIMUM_WRITE_INTERVAL' : undefined);
    const commandId = randomUUID(), createdAt = this.timestamp(), createdAtMonotonic = this.mono(), runtimeGeneration = session.generation;
    const expiry = createdAtMonotonic + WORKFLOW_WRITE_EXPIRY_MS, expiresAt = new Date(this.wall() + WORKFLOW_WRITE_EXPIRY_MS).toISOString();
    const base = session.nodeRuntime[node.id] ?? { value: command, commandedValue: command, status: 'blocked', quality: 'UNCERTAIN' as const, consecutiveErrors: 0 };
    if (rejection && Object.is(base.commandedValue, command) && base.admissionResult === 'REJECTED' && base.rejectionReason === rejection) return;
    if (rejection) {
      session.nodeRuntime[node.id] = { ...base, commandId, workflowId: workflow.id, deviceId: device?.id, resourceKey, runtimeGeneration,
        connectionGeneration: connection?.generation, createdAt, createdAtMonotonic, admissionResult: 'REJECTED', rejectionReason: rejection,
        writeStatus: 'REJECTED', queueState: 'NOT_QUEUED', expiresAt, expiresAtMonotonic: expiry, status: 'blocked', error: rejection };
      this.dependencies.audit({ timestamp: createdAt, action: 'WORKFLOW_WRITE_REJECTED', workflowId: workflow.id, workflowName: workflow.name, nodeId: node.id,
        deviceId: device?.id, commandId, resourceKey, runtimeGeneration, connectionGeneration: connection?.generation, createdAtMonotonic,
        expiresAt, expiresAtMonotonic: expiry, decision: 'REJECTED', reason: rejection, commandedValue: command });
      this.broadcastRuntime(session); return;
    }
    if (!session.outputInitialized.has(node.id) && node.params.initialWritePolicy === 'DO_NOT_WRITE_UNTIL_CHANGE') {
      session.outputInitialized.add(node.id); session.lastWrittenCommand.set(node.id, command);
      session.nodeRuntime[node.id] = { ...base, commandedValue: command, writeStatus: 'IDLE', admissionResult: 'NOT_SUBMITTED', rejectionReason: undefined, queueState: 'IDLE', status: 'calculated', error: undefined };
      return;
    }
    const config = validated.config!, encoded = encodeWorkflowWrite(config, command);
    session.pendingCommands.set(node.id, { commandId, deviceId: device!.id, runtimeGeneration, connectionGeneration: connection!.generation,
      createdAt, createdAtMonotonic, expiresAtMonotonic: expiry, status: 'QUEUED', resourceKey });
    session.nodeRuntime[node.id] = { ...base, value: command, commandedValue: command, commandId, workflowId: workflow.id, deviceId: device!.id, resourceKey,
      runtimeGeneration, connectionGeneration: connection!.generation, createdAt, createdAtMonotonic, admissionResult: 'ACCEPTED', rejectionReason: undefined,
      writeStatus: 'ADMITTING', queueState: 'ADMITTING', expiresAt, expiresAtMonotonic: expiry, status: 'admitting', error: undefined,
      effectiveValue: base.effectiveValue, encodedPayload: encoded.values.map(v => `0x${v.toString(16).padStart(4, '0').toUpperCase()}`).join(' ') };
    try {
      const promise = connection!.request({ unitId: config.unitId, fc: config.functionCode, address: config.address, quantity: config.quantity, values: encoded.values, priority: true,
        requestClass: 'write', workflowId: workflow.id, nodeId: node.id, commandId, resourceKey, runtimeGeneration, createdAtMonotonic, expiresAtMonotonic: expiry,
        supersedeQueued: node.params.writeOnChange !== false,
        isCurrent: () => session.running && session.generation === runtimeGeneration && session.pendingCommands.get(node.id)?.commandId === commandId &&
          connection!.generation === session.pendingCommands.get(node.id)?.connectionGeneration && this.dependencies.getConnection(device!.id) === connection && !connection!.manual });
      const pending = session.pendingCommands.get(node.id);
      if (promise.admitted && pending?.commandId === commandId) {
        pending.status = connection!.activeRequest?.commandId === commandId ? 'WRITING' : 'QUEUED';
        const live = session.nodeRuntime[node.id]; if (live?.commandId === commandId) { live.writeStatus = pending.status; live.queueState = pending.status === 'WRITING' ? 'ON_WIRE' : 'QUEUED'; live.status = pending.status === 'WRITING' ? 'writing' : 'queued'; }
        this.dependencies.audit({ timestamp: createdAt, action: 'WORKFLOW_WRITE_QUEUED', workflowId: workflow.id, workflowName: workflow.name, nodeId: node.id, deviceId: device!.id,
          commandId, resourceKey, runtimeGeneration, connectionGeneration: connection!.generation, createdAtMonotonic, expiresAt, expiresAtMonotonic: expiry, commandedValue: command, decision: 'QUEUED' });
        this.broadcastRuntime(session);
      }
      await promise;
      if (!session.running || session.generation !== runtimeGeneration || session.pendingCommands.get(node.id)?.commandId !== commandId) return;
      session.pendingCommands.delete(node.id); session.outputInitialized.add(node.id); session.lastWrittenCommand.set(node.id, command); session.lastWriteAt.set(node.id, this.mono());
      const current = session.nodeRuntime[node.id]!;
      session.nodeRuntime[node.id] = { ...current, effectiveValue: encoded.effectiveValue, writeStatus: 'WRITTEN', queueState: 'COMPLETE', status: 'written', lastWriteTime: this.timestamp(), responseTime: undefined, error: undefined, consecutiveErrors: 0 };
      this.dependencies.audit({ timestamp: this.timestamp(), action: 'WORKFLOW_WRITE_RESULT', workflowId: workflow.id, workflowName: workflow.name, nodeId: node.id, deviceId: device!.id, commandId,
        decision: 'WRITTEN', result: 'WRITTEN', commandedValue: command, effectiveValue: encoded.effectiveValue });
      this.refreshReadBack(workflow, session);
    } catch (error) {
      const code = String((error as { code?: string }).code ?? 'WRITE_FAILED');
      const status = code === 'COMMAND_EXPIRED' ? 'EXPIRED' : code === 'WRITE_SUPERSEDED' ? 'SUPERSEDED' : code === 'WRITE_QUEUE_FULL' ? 'REJECTED' : code === 'WRITE_CANCELLED' ? 'CANCELLED' : 'FAILED';
      const active = session.running && session.generation === runtimeGeneration && session.pendingCommands.get(node.id)?.commandId === commandId;
      if (active) {
        session.pendingCommands.delete(node.id);
        const current = session.nodeRuntime[node.id]!;
        session.nodeRuntime[node.id] = { ...current, writeStatus: status, queueState: code === 'WRITE_QUEUE_FULL' ? 'NOT_QUEUED' : 'TERMINAL', admissionResult: code === 'WRITE_QUEUE_FULL' ? 'REJECTED' : current.admissionResult,
          rejectionReason: code, status: status.toLowerCase(), error: code, consecutiveErrors: current.consecutiveErrors + 1 };
        if (status === 'EXPIRED' || status === 'FAILED') session.blockedCommands.set(node.id, command);
      }
      this.dependencies.audit({ timestamp: this.timestamp(), action: code === 'WRITE_QUEUE_FULL' ? 'WORKFLOW_WRITE_REJECTED' : 'WORKFLOW_WRITE_RESULT', workflowId: workflow.id, workflowName: workflow.name, nodeId: node.id,
        deviceId: device?.id, commandId, resourceKey, runtimeGeneration, connectionGeneration: connection?.generation, createdAtMonotonic,
        expiresAt, expiresAtMonotonic: expiry, decision: status, result: status, reason: code, commandedValue: command });
    } finally { if (session.running && session.generation === runtimeGeneration) this.broadcastRuntime(session); }
  }

  private syncPollers(workflow: WorkflowDefinition, session: RuntimeSession): void {
    for (const timer of session.pollers.values()) clearInterval(timer); session.pollers.clear();
    if (!session.running || !['LIVE_LOCKED', 'LIVE_ARMED'].includes(workflow.mode)) return;
    for (const node of workflow.nodes.filter(item => item.type === 'MODBUS_INPUT' || item.type === 'MODBUS_MULTI_INPUT')) {
      const device = this.dependencies.getDevices().find(item => item.id === node.params.deviceId), connection = device ? this.dependencies.getConnection(device.id) : undefined;
      if (!device?.enabled || connection?.runtime.actualState !== 'connected' || connection.manual) continue;
      if (node.type === 'MODBUS_MULTI_INPUT') {
        const inputs = Array.isArray(node.params.inputs) ? node.params.inputs as Array<Record<string, unknown>> : [];
        inputs.slice(0, 8).forEach((config, index) => { const key = `${node.id}:${index}`; void this.readNode(workflow, session, node.id, index); session.pollers.set(key, setInterval(() => void this.readNode(workflow, session, node.id, index), Math.max(100, Number(config.scanInterval ?? 1000)))); });
      } else { void this.readNode(workflow, session, node.id); session.pollers.set(node.id, setInterval(() => void this.readNode(workflow, session, node.id), Math.max(100, Number(node.params.scanInterval ?? 1000)))); }
    }
  }

  private stopSession(workflow: WorkflowDefinition, session: RuntimeSession): void {
    this.invalidateGeneration(workflow, session, 'WORKFLOW_STOPPED');
    session.running = false; session.stoppedAt = this.timestamp();
this.releaseOutputs(workflow, session);
    for (const node of workflow.nodes.filter(n => n.type === 'MANUAL_TRIGGER')) session.nodeRuntime[node.id] = { value: false, lastKnownValue: false, status: 'manual', quality: 'GOOD', lastValueChange: this.timestamp(), consecutiveErrors: 0 };
    this.dependencies.broadcast('workflow-state', { running: false, mode: workflow.mode }, workflow.id); this.broadcastRuntime(session);
  }
  private invalidateGeneration(workflow: WorkflowDefinition, session: RuntimeSession, reason: string): void {
    const oldGeneration = session.generation; session.generation++;
    for (const timer of session.pollers.values()) clearInterval(timer); for (const timer of session.timers.values()) clearTimeout(timer); for (const timer of session.manualTriggerTimers.values()) clearTimeout(timer);
    session.pollers.clear(); session.timers.clear(); session.manualTriggerTimers.clear(); session.readBackUnsubscribe?.(); session.readBackUnsubscribe = undefined;
    for (const [nodeId, item] of session.pendingCommands) {
      const connection = this.dependencies.getConnection(item.deviceId); connection?.cancelWorkflowWrites(workflow.id, oldGeneration);
      const current = session.nodeRuntime[nodeId], onWire = connection?.activeRequest?.commandId === item.commandId;
      if (current && !onWire) session.nodeRuntime[nodeId] = { ...current, writeStatus: 'REJECTED', admissionResult: 'REJECTED', rejectionReason: reason, queueState: 'CANCELLED', status: 'blocked', error: reason };
      else if (current && onWire) session.nodeRuntime[nodeId] = { ...current, writeStatus: 'FAILED', queueState: 'ON_WIRE', status: 'stopped', rejectionReason: 'COMPLETION_FENCED_AFTER_LIFECYCLE_CHANGE', error: 'Write was already on wire; completion is fenced and physical outcome is unconfirmed' };
    }
    session.pendingCommands.clear(); session.engineMemory.clear(); session.outputInitialized.clear(); session.blockedCommands.clear(); session.lastWrittenCommand.clear(); session.lastWriteAt.clear();
  }
  private initializeSources(workflow: WorkflowDefinition, session: RuntimeSession): void {
    for (const node of workflow.nodes) if (node.type === 'MANUAL_TRIGGER') session.nodeRuntime[node.id] = { value: false, lastKnownValue: false, status: 'manual', quality: 'GOOD', lastValueChange: this.timestamp(), consecutiveErrors: 0 };
  }
  private claimOutputs(workflow: WorkflowDefinition, session: RuntimeSession): void {
    session.ownedOutputs.clear();
    if (workflow.mode !== 'LIVE_ARMED') return;
    for (const node of workflow.nodes.filter(item => item.type === 'MODBUS_OUTPUT')) {
      const device = this.dependencies.getDevices().find(item => item.id === node.params.deviceId), keys = this.resourceKeys(node, device);
      session.ownedOutputs.set(node.id, { deviceId: String(node.params.deviceId ?? ''), resourceKeys: keys });
      for (const key of keys) this.outputOwners.set(key, `${workflow.id}:${node.id}`);
    }
  }
  private releaseOutputs(workflow: WorkflowDefinition, session: RuntimeSession): void {
    for (const [nodeId, output] of session.ownedOutputs) for (const key of output.resourceKeys) {
      if (this.outputOwners.get(key) === `${workflow.id}:${nodeId}`) this.outputOwners.delete(key);
    }
    session.ownedOutputs.clear();
  }
  private assertOutputConflicts(workflow: WorkflowDefinition): void {
    const planned = new Map<string, string>();
    for (const node of workflow.nodes.filter(item => item.type === 'MODBUS_OUTPUT')) {
      const owner = `${workflow.id}:${node.id}`;
      const device = this.dependencies.getDevices().find(item => item.id === node.params.deviceId);
      for (const key of this.resourceKeys(node, device)) {
        const current = this.outputOwners.get(key) ?? planned.get(key);
        if (current && current !== owner) throw this.error(`Output resource conflict with ${current}`, 'OUTPUT_CONFLICT');
        planned.set(key, owner);
      }
    }
  }
  private resourceKeys(node: WorkflowDefinition['nodes'][number], device?: DeviceConfig): string[] {
    const config = validateWriteConfiguration(node, device).config;
    const fc = Number(node.params.functionCode ?? 5), address = Number(node.params.address ?? 0), unit = Number(node.params.unitId ?? device?.defaultUnitId ?? 1);
    const type = config?.dataType ?? String(node.params.dataType ?? 'Boolean');
    const width = config?.quantity ?? (type === 'Float64' ? 4 : ['UInt32', 'Int32', 'Float32'].includes(type) ? 2 : 1);
    const table = fc === 5 ? 'COIL' : 'HOLDING';
    return Array.from({ length: Math.max(1, width) }, (_x, i) => `${node.params.deviceId}:${unit}:${table}:${address + i}`);
  }
  private subscribeReadBack(workflow: WorkflowDefinition, session: RuntimeSession): void {
    const sources = new Set(workflow.nodes.filter(n => n.type === 'MODBUS_OUTPUT' && typeof n.params.readBackSourceId === 'string').map(n => String(n.params.readBackSourceId)));
    if (!sources.size || !this.dependencies.subscribeTags || !this.dependencies.readBack) return;
    const generation = session.generation;
    session.readBackUnsubscribe = this.dependencies.subscribeTags((_update) => {
      if (!session.running || session.generation !== generation) return;
      this.refreshReadBack(workflow, session); this.broadcastRuntime(session);
    });
  }
  private syncReadBack(workflow: WorkflowDefinition, session: RuntimeSession): void { this.refreshReadBack(workflow, session); }
  private refreshReadBack(workflow: WorkflowDefinition, session: RuntimeSession): void {
    if (!this.dependencies.readBack) return;
    for (const node of workflow.nodes.filter(n => n.type === 'MODBUS_OUTPUT' && typeof n.params.readBackSourceId === 'string')) {
      const sourceId = String(node.params.readBackSourceId); if (!tagUuid.test(sourceId)) continue;
      const result = this.dependencies.readBack(sourceId), sample = result.sample, previous = session.nodeRuntime[node.id];
      const value = sample?.hasValue ? sample.value : undefined;
      const matched = Boolean(sample?.hasValue && sample.quality === 'GOOD' && previous?.effectiveValue !== undefined && Object.is(value, previous.effectiveValue));
      const mismatch = Boolean(sample?.hasValue && sample.quality === 'GOOD' && previous?.effectiveValue !== undefined && !Object.is(value, previous.effectiveValue));
      if (mismatch && previous && Object.prototype.hasOwnProperty.call(previous, 'commandedValue')) session.blockedCommands.set(node.id, previous.commandedValue);
      session.nodeRuntime[node.id] = { ...(previous ?? { value: undefined, status: 'idle', quality: 'UNCERTAIN' as const, consecutiveErrors: 0 }), readBackSourceId: sourceId,
        readBackValue: value, readBackHasValue: sample?.hasValue ?? false, readBackQuality: sample?.quality, readBackAvailability: result.availability,
        readBackTimestamp: sample?.receiveTimestamp ?? null, readBackMismatch: mismatch, writeStatus: mismatch ? 'MISMATCH' : matched ? 'VERIFIED' : previous?.writeStatus };
    }
  }
  private broadcastRuntime(session: RuntimeSession): void { this.dependencies.broadcast('runtime', session.nodeRuntime, session.workflowId); }
  private createSession(workflowId: string): RuntimeSession {
    return { workflowId, running: false, generation: 0, evaluationCount: 0, nodeRuntime: {}, engineMemory: new Map(), pollers: new Map(), timers: new Map(), manualTriggerTimers: new Map(), pendingCommands: new Map(), ownedOutputs: new Map(), outputInitialized: new Set(), blockedCommands: new Map(), lastWrittenCommand: new Map(), lastWriteAt: new Map() };
  }
  private summaryOf(session: RuntimeSession): RuntimeSessionSummary {
    return { workflowId: session.workflowId, running: session.running, startedAt: session.startedAt, stoppedAt: session.stoppedAt,
      lastEvaluationTime: session.lastEvaluationTime, evaluationCount: session.evaluationCount, nodeRuntimeCount: Object.keys(session.nodeRuntime).length,
      pollerCount: session.pollers.size, timerCount: session.timers.size + session.manualTriggerTimers.size, pendingWriteCount: session.pendingCommands.size, lastError: session.lastError };
  }
  private requireWorkflow(workflowId: string): WorkflowDefinition { const value = this.dependencies.workflows.get(workflowId); if (!value) throw this.error('Workflow not found', 'NOT_FOUND'); return value; }
  private timestamp(): string { return new Date(this.wall()).toISOString(); }
  private error(message: string, code: string): Error & { code: string } { return Object.assign(new Error(message), { code }); }
}
