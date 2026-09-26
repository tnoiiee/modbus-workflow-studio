import { useEffect, useId, useRef, useState } from 'react';
import { Modal } from '../ui/Modal.js';
import type { SourceDefinition } from '../../lib/sourceDefinitions.js';
import { ACQUISITION_CODECS, acquisitionPath, acquisitionRequest, defaultAcquisition, type AcquisitionMapping, type MappingResult } from '../../lib/acquisitionApi.js';
type SharedDefinition = Extract<SourceDefinition, { sourceType: 'SHARED_TAG' }>;
/** Dedicated persisted mapping form, never a Definition/Overview/Runtime-value editor. */
export function AcquisitionMappingEditor({ definition, onClose }: { definition: SharedDefinition; onClose: () => void }) {
  const [mapping, setMapping] = useState(() => defaultAcquisition(definition.sourceId, definition.dataType === 'Boolean'));
  const [devices, setDevices] = useState<{ id: string; name: string; enabled: boolean }[]>([]);
  const [loading, setLoading] = useState(true), [pending, setPending] = useState(false);
  const [error, setError] = useState(''), [availability, setAvailability] = useState('UNCONFIGURED');
  const [loaded, setLoaded] = useState(false), [retry, setRetry] = useState(0), [confirmRemove, setConfirmRemove] = useState(false);
  const [saved, setSaved] = useState(false), [notice, setNotice] = useState('');
  const input = useRef<HTMLSelectElement>(null), alive = useRef(true), inFlight = useRef(false);
  const formId = useId();
  const path = acquisitionPath(definition.sourceId);
  const supported = definition.dataType !== 'String' && definition.capability !== 'COMMAND_ONLY';
  useEffect(() => {
    const controller = new AbortController(); alive.current = true; setLoading(true); setError('');
    Promise.all([acquisitionRequest<MappingResult>(path, { signal: controller.signal }),
      acquisitionRequest<typeof devices>('/api/devices', { signal: controller.signal })]).then(([result, list]) => {
      if (!alive.current || controller.signal.aborted) return;
      setLoaded(true);
      if (result.mapping) setMapping(result.mapping);
      setSaved(Boolean(result.mapping)); setAvailability(result.availability); setDevices(list); setLoading(false);
    }).catch(cause => { if (!controller.signal.aborted && alive.current) { setError((cause as Error).message); setLoading(false); } });
    return () => { alive.current = false; controller.abort(); };
  }, [path, retry]);
  useEffect(() => { if (loaded) input.current?.focus(); }, [loaded]);
  const change = <K extends keyof AcquisitionMapping>(key: K, value: AcquisitionMapping[K]) => { setMapping(old => ({ ...old, [key]: value })); setNotice(''); };
  const persist = async (remove = false) => {
    if (inFlight.current || loading || !loaded) return;
    inFlight.current = true; setPending(true); setError(''); setNotice('');
    try {
      const result = await acquisitionRequest<MappingResult>(path, remove ? { method: 'DELETE' } : {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mapping),
      });
      if (!alive.current) return;
      if (remove) { setMapping(defaultAcquisition(definition.sourceId, definition.dataType === 'Boolean')); setSaved(false); setAvailability('UNCONFIGURED'); setConfirmRemove(false); }
      else { setMapping(result.mapping!); setSaved(true); setAvailability(result.availability); }
      setNotice(remove ? 'Mapping removed. Definition and bindings are unchanged.' : 'Acquisition configuration saved. No Device was connected by this action.');
    } catch (cause) { if (alive.current) setError((cause as Error).message); }
    finally { inFlight.current = false; if (alive.current) setPending(false); }
  };
  return <Modal open title={`Shared Tag acquisition · ${definition.name}`} size="md" initialFocusRef={input}
    onClose={() => { if (!inFlight.current) onClose(); }}
    description="Configuration only. Enabled mappings acquire on the server only while the existing Device connection is connected. No auto-connect, writes or Overview live values."
    footer={<><button className="btn" type="button" disabled={pending} onClick={onClose}>Close</button>
      <button className="btn" type="button" disabled={loading || pending || !saved} onClick={() => setConfirmRemove(true)}>Remove mapping</button>
      <button className="btn btn--primary" type="submit" form={formId} disabled={loading || !loaded || pending || !supported || !mapping.deviceId}>{pending ? 'Saving…' : 'Save mapping'}</button></>}>
    <form id={formId} className="source-catalog source-catalog--focused" onSubmit={event => { event.preventDefault(); if (supported) void persist(); }}>
      <p>Stable sourceId: <code>{definition.sourceId}</code></p>
      <p role="status">Configuration availability: {availability}. This is not Definition resolution or live quality.</p>
      {loading && <p role="status">Loading configuration…</p>}
      {!supported && <p role="alert">This Definition cannot acquire: String decoding and COMMAND_ONLY mappings are not supported. The Definition remains valid.</p>}
      {error && <p className="source-catalog-error" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {error && !loaded && <button type="button" disabled={loading} onClick={() => setRetry(n => n + 1)}>Retry configuration</button>}
      {confirmRemove && <div role="alert"><p>Remove only this acquisition mapping? Definition and saved bindings remain unchanged.</p>
        <button type="button" disabled={pending} onClick={() => setConfirmRemove(false)}>Keep mapping</button>
        <button type="button" disabled={pending} onClick={() => void persist(true)}>Confirm remove mapping</button></div>}
      <fieldset disabled={loading || !loaded || pending || !supported}>
        <legend>Read-only Modbus mapping</legend>
        <label>Device<select ref={input} required value={mapping.deviceId} onChange={e => change('deviceId', e.target.value)}><option value="">Select Device</option>
          {mapping.deviceId && !devices.some(d => d.id === mapping.deviceId) && <option value={mapping.deviceId}>Missing Device · {mapping.deviceId}</option>}
          {devices.map(d => <option key={d.id} value={d.id}>{d.name}{d.enabled ? '' : ' (disabled)'}</option>)}</select></label>
        <label>Unit ID<input type="number" required min={0} max={255} step={1} value={mapping.unitId} onChange={e => change('unitId', e.target.valueAsNumber)} /></label>
        <label>Function code<select value={mapping.functionCode} onChange={e => {
          const fc = Number(e.target.value) as AcquisitionMapping['functionCode'];
          const dataType = fc <= 2 ? 'Boolean' : mapping.dataType === 'Boolean' ? 'UInt16' : mapping.dataType;
          setMapping(m => ({ ...m, functionCode: fc, dataType, width: ACQUISITION_CODECS[dataType], ...(fc <= 2 ? { scale: 1, offset: 0 } : {}) }));
        }}>{[1, 2, 3, 4].map(fc => <option key={fc} value={fc}>FC0{fc}</option>)}</select></label>
        <label>Zero-based address<input type="number" required min={0} max={65535} step={1} value={mapping.address} onChange={e => change('address', e.target.valueAsNumber)} /></label>
        <label>Wire data type<select value={mapping.dataType} onChange={e => {
          const dataType = e.target.value as AcquisitionMapping['dataType'];
          setMapping(m => ({ ...m, dataType, width: ACQUISITION_CODECS[dataType], functionCode: dataType === 'Boolean' ? 1 : m.functionCode <= 2 ? 3 : m.functionCode, ...(dataType === 'Boolean' ? { scale: 1, offset: 0 } : {}) }));
        }}>{Object.keys(ACQUISITION_CODECS).map(t => <option key={t}>{t}</option>)}</select></label>
        <label>Width (bits for FC01/02; registers for FC03/04)<input readOnly value={mapping.width} /></label>
        <label>Byte order<select value={mapping.byteOrder} onChange={e => change('byteOrder', e.target.value as AcquisitionMapping['byteOrder'])}><option>BIG_ENDIAN</option><option>LITTLE_ENDIAN</option></select></label>
        <label>Word order<select value={mapping.wordOrder} onChange={e => change('wordOrder', e.target.value as AcquisitionMapping['wordOrder'])}><option>HIGH_FIRST</option><option>LOW_FIRST</option></select></label>
        <label>Scale<input type="number" required step="any" disabled={mapping.dataType === 'Boolean'} value={mapping.scale} onChange={e => change('scale', e.target.valueAsNumber)} /></label>
        <label>Offset<input type="number" required step="any" disabled={mapping.dataType === 'Boolean'} value={mapping.offset} onChange={e => change('offset', e.target.valueAsNumber)} /></label>
        <label>Poll interval (ms)<input type="number" required min={100} max={3600000} step={1} value={mapping.pollIntervalMs} onChange={e => change('pollIntervalMs', e.target.valueAsNumber)} /></label>
        <label>Stale threshold (ms)<input type="number" required min={Math.max(100, mapping.pollIntervalMs)} max={86400000} step={1} value={mapping.staleAfterMs} onChange={e => change('staleAfterMs', e.target.valueAsNumber)} /></label>
        <label className="source-catalog-enabled source-catalog-wide"><input type="checkbox" checked={mapping.enabled} onChange={e => change('enabled', e.target.checked)} /> Enable server acquisition (does not connect Device)</label>
      </fieldset>
      <p>Number codecs and FC01/02 Boolean only. Shared Tags deduplicate identical compatible ranges only; Workflow and Monitor reads remain independent.</p>
    </form>
  </Modal>;
}
