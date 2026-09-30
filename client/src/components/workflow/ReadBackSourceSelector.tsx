import type { SourceDefinition } from '../../lib/sourceDefinitions.js';
import type { AcquisitionMapping, MappingResult } from '../../lib/acquisitionApi.js';

export interface ReadBackDevice { id: string; name: string }
interface Props {
  definitions: readonly SourceDefinition[];
  mappings: readonly MappingResult[];
  devices: readonly ReadBackDevice[];
  value: string;
  onChange: (sourceId: string) => void;
}
const mappingFor = (mappings: readonly MappingResult[], sourceId: string): MappingResult | undefined =>
  mappings.find(item => item.mapping?.sourceId === sourceId);
function mappingSummary(mapping: AcquisitionMapping | null | undefined, availability?: string, devices: readonly ReadBackDevice[] = []): string {
  if (!mapping) return 'Acquisition mapping missing';
  const device = devices.find(item => item.id === mapping.deviceId)?.name ?? mapping.deviceId;
  return `FC${String(mapping.functionCode).padStart(2, '0')} Unit ${mapping.unitId} Address ${mapping.address} · ${device} · ${availability ?? 'Configured'}${mapping.enabled ? '' : ' (mapping disabled)'}`;
}
export function ReadBackSourceSelector({ definitions, mappings, devices, value, onChange }: Props) {
  const shared = definitions.filter((item): item is Extract<SourceDefinition, { sourceType: 'SHARED_TAG' }> => item.sourceType === 'SHARED_TAG');
  const selected = shared.find(item => item.sourceId === value);
  const selectedMapping = value ? mappingFor(mappings, value) : undefined;
  const unresolved = Boolean(value && !selected);
  const warnings = unresolved ? ['Saved SHARED_TAG definition is currently missing. Its UUID is preserved.'] : [
    ...(selected && !selected.enabled ? ['Selected SHARED_TAG definition is disabled.'] : []),
    ...(selected && (!selectedMapping?.mapping || selectedMapping.availability !== 'READY')
      ? [`Read-back acquisition is unavailable: ${mappingSummary(selectedMapping?.mapping, selectedMapping?.availability, devices)}.`] : []),
  ];
  return <div className="readback-source-selector">
    <label>Read-back SHARED_TAG
      <select value={value} onChange={event => onChange(event.target.value)}>
        <option value="">No read-back source</option>
        {unresolved && <option value={value}>Saved ID · definition missing</option>}
        {shared.map(definition => {
          const result = mappingFor(mappings, definition.sourceId);
          const status = `${definition.enabled ? 'Enabled' : 'Disabled'} · ${mappingSummary(result?.mapping, result?.availability, devices)}`;
          return <option key={definition.sourceId} value={definition.sourceId}>{definition.name} · {definition.sourceId} · {definition.dataType}{definition.unit ? ` · ${definition.unit}` : ''} · {status}</option>;
        })}
      </select>
      <small>Selects an existing SHARED_TAG acquisition only; this does not create a Poller or connect a Device.</small>
    </label>
    {value && <label>Saved Stable SHARED_TAG UUID<input readOnly value={value}/></label>}
    {selected && <div className="readback-source-meta" aria-label="Selected read-back source details">
      <p><b>{selected.name}</b> · {selected.dataType}{selected.unit ? ` · ${selected.unit}` : ''} · {selected.enabled ? 'Definition enabled' : 'Definition disabled'}</p>
      <p>{mappingSummary(selectedMapping?.mapping, selectedMapping?.availability, devices)}</p>
    </div>}
    {warnings.map(warning => <p key={warning} className="issue warning" role="status">{warning}</p>)}
  </div>;
}
