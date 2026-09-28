import { TagRuntimeStore } from '../src/tagRuntime.js';
import { TagDeliveryBroker, availabilityReader, TagJournal } from '../src/tagDeliveryBroker.js';
import { fixture } from './acquisitionFixtures.js';
export function deliveryFixture(journal?: TagJournal, now?: () => number) {
  const f = fixture(), definition = f.definition(), mapping = f.map(definition.sourceId); f.config.put(mapping);
  let devices = [{ id: 'plc', enabled: true }];
  const store = new TagRuntimeStore();
  const broker = new TagDeliveryBroker(store, availabilityReader(f.catalog, f.config, () => devices as any, store), now, journal);
  const source = { sourceType: 'SHARED_TAG' as const, sourceId: definition.sourceId };
  return { ...f, definitionRecord: definition, mapping, store, broker, source, devices, cleanup: () => { broker.dispose(); f.cleanup(); } };
}
