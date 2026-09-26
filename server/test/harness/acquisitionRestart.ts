/** TEST-ONLY child process. Private IPC, not an API, WS or console observer in the app. */
import { DefinitionCatalog } from '../../src/definitionCatalog.js';
import { AcquisitionConfig } from '../../src/acquisitionConfig.js';
import { TagRuntimeStore } from '../../src/tagRuntime.js';
import { SharedTagAcquisition } from '../../src/sharedTagAcquisition.js';
import type { DeviceConnection } from '../../src/modbus.js';
import { device, readResponse } from '../acquisitionFixtures.js';
const [directory, sourceId, phase] = process.argv.slice(2);
if (!directory || !sourceId || !process.send) throw Error('Test IPC arguments required');
const catalog = new DefinitionCatalog(directory, () => true);
const config = new AcquisitionConfig(directory, catalog, () => [device]);
const store = new TagRuntimeStore();
let reads = 0, connects = 0;
const connection = { generation: 1, manual: false, runtime: { actualState: phase === 'first' ? 'connected' : 'disconnected' },
  request: async () => { reads++; return readResponse(42); }, connect: () => { connects++; }, cancelAcquisitionRequests: () => {} };
const updates: unknown[] = [];
const unsubscribe = store.subscribe(update => updates.push(update));
const service = new SharedTagAcquisition(config, store, () => connection as unknown as DeviceConnection);
service.start();
setTimeout(() => {
  const evidence = { pid: process.pid, epoch: store.serverEpoch, mapping: config.get(sourceId), sample: store.get(sourceId), updates, reads, connects };
  service.stop(); unsubscribe();
  process.send!(evidence, () => process.disconnect());
}, 250);
