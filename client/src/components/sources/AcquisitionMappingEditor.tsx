import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Modal } from '../ui/Modal.js';
import type { SourceDefinition } from '../../lib/sourceDefinitions.js';
import { acquisitionPath, acquisitionRequest, defaultAcquisition, type MappingResult } from '../../lib/acquisitionApi.js';
import { acquisitionDraft, validateAcquisition, changeAcquisitionField, codecWidth, focusAcquisitionError, FUNCTION_CODES, WIRE_TYPES, BYTE_ORDERS, WORD_ORDERS, type AcquisitionField, type AcquisitionDevice } from '../../lib/acquisitionValidation.js';
import '../../styles/acquisition.css';
type SharedDefinition = Extract<SourceDefinition, { sourceType: 'SHARED_TAG' }>;
/** Configuration form only. Local edit strings never enter the persisted contract until valid. */
export function AcquisitionMappingEditor({ definition, onClose }: { definition: SharedDefinition; onClose: () => void }) {
  const defaults = () => acquisitionDraft(defaultAcquisition(definition.sourceId, definition.dataType === 'Boolean'));
  const [draft, setMappingDraft] = useState(defaults);
  const [devices, setDevices] = useState<AcquisitionDevice[]>([]);
  const [loading, setLoading] = useState(true), [pending, setPending] = useState(false);
  const [error, setError] = useState(''), [availability, setAvailability] = useState('UNCONFIGURED');
  const [loaded, setLoaded] = useState(false), [retry, setRetry] = useState(0), [confirmRemove, setConfirmRemove] = useState(false);
  const [saved, setSaved] = useState(false), [notice, setNotice] = useState(''), [impact, setImpact] = useState('');
  const input = useRef<HTMLSelectElement | null>(null), alive = useRef(true), inFlight = useRef(false);
  const fields = useRef<Partial<Record<AcquisitionField, HTMLElement | null>>>({});
  const summary = useRef<HTMLParagraphElement>(null);
  const formId = useId();
  const path = acquisitionPath(definition.sourceId);
  const supported = definition.dataType !== 'String' && definition.capability !== 'COMMAND_ONLY';
  const validation = validateAcquisition(draft, definition, devices, definition.sourceId);
  const errors = loaded ? validation.errors : {};
  const fieldId = (field: AcquisitionField) => `${formId}-${field}`;
  useEffect(() => {
    const controller = new AbortController(); alive.current = true; setLoading(true); setError('');
    Promise.all([acquisitionRequest<MappingResult>(path, { signal: controller.signal }),
      acquisitionRequest<AcquisitionDevice[]>('/api/devices', { signal: controller.signal })]).then(([result, list]) => {
      if (!alive.current || controller.signal.aborted) return;
      if (result.mapping) setMappingDraft(acquisitionDraft(result.mapping));
      setLoaded(true); setSaved(Boolean(result.mapping)); setAvailability(result.availability); setDevices(list); setLoading(false);
    }).catch(cause => { if (!controller.signal.aborted && alive.current) { setError((cause as Error).message); setLoading(false); } });
    return () => { alive.current = false; controller.abort(); };
  }, [path, retry]);
  useEffect(() => { if (loaded) input.current?.focus(); }, [loaded]);
  const change = (field: AcquisitionField, value: string | boolean) => {
    const next = changeAcquisitionField(draft, field, value);
    setMappingDraft(next.draft); setImpact(next.impact); setNotice('');
    // Server errors remain a separate last-Save summary; local field errors are derived afresh.
  };
  const persist = async (remove = false) => {
    if (inFlight.current || loading || !loaded) return;
    if (!remove && !validation.mapping) {
      focusAcquisitionError(validation.errors, fields.current);
      if (validation.firstInvalid === 'sourceId') summary.current?.focus();
      return;
    }
    inFlight.current = true; setPending(true); setError(''); setNotice('');
    try {
      const result = await acquisitionRequest<MappingResult>(path, remove ? { method: 'DELETE' } : {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(validation.mapping),
      });
      if (!alive.current) return;
      if (remove) { setMappingDraft(defaults()); setSaved(false); setAvailability('UNCONFIGURED'); setConfirmRemove(false); }
      else { setMappingDraft(acquisitionDraft(result.mapping!)); setSaved(true); setAvailability(result.availability); }
      setImpact(''); setNotice(remove ? 'Mapping removed. Definition and bindings are unchanged.' : 'Acquisition configuration saved. No Device was connected by this action.');
    } catch (cause) { if (alive.current) setError((cause as Error).message); }
    finally { inFlight.current = false; if (alive.current) setPending(false); }
  };
  const attributes = (field: AcquisitionField) => ({
    id: fieldId(field), name: field, 'aria-invalid': Boolean(errors[field]),
    'aria-describedby': `${fieldId(field)}-help ${fieldId(field)}-error`,
    ref: (element: HTMLInputElement | HTMLSelectElement | null) => { fields.current[field] = element; if (field === 'deviceId') input.current = element as HTMLSelectElement | null; },
  });
  const field = (key: AcquisitionField, label: string, help: string, control: ReactNode) => <div className="acquisition-field" key={key}>
    <label htmlFor={fieldId(key)}>{label}</label>{control}
    <small id={`${fieldId(key)}-help`}>{help}</small>
    <small id={`${fieldId(key)}-error`} className="source-catalog-error" aria-live="polite">{errors[key] ? `Error: ${errors[key]}` : ''}</small>
  </div>;
  const numeric = (key: Exclude<AcquisitionField, 'enabled'>, label: string, help: string, integer = false) => field(key, label, help,
    <input {...attributes(key)} type="text" inputMode={integer ? 'numeric' : 'decimal'} required autoComplete="off" spellCheck={false} value={draft[key]} onChange={e => change(key, e.target.value)} />);
  const select = (key: Exclude<AcquisitionField, 'enabled'>, label: string, options: readonly string[], help: string, incompatible: (option: string) => boolean = () => false) => field(key, label, help,
    <select {...attributes(key)} value={draft[key]} onChange={e => change(key, e.target.value)}>
      {!options.includes(draft[key]) && <option value={draft[key]} disabled>Unavailable value: {draft[key] || '(empty)'}</option>}
      {options.map(option => <option key={option} value={option} disabled={incompatible(option)}>{key === 'functionCode' ? `FC0${option}` : option}{incompatible(option) ? ' — incompatible with Definition' : ''}</option>)}
    </select>);
  return <Modal open title={`Shared Tag acquisition · ${definition.name}`} size="md" initialFocusRef={input}
    onClose={() => { if (!inFlight.current) onClose(); }}
    description="Configuration only. Enabled mappings acquire on the server only while the existing Device connection is connected. No auto-connect, writes or Overview live values."
    footer={<><button className="btn" type="button" disabled={pending} onClick={onClose}>Close</button>
      <button className="btn" type="button" disabled={loading || pending || !saved} onClick={() => setConfirmRemove(true)}>Remove mapping</button>
      <button className="btn btn--primary" type="submit" form={formId} disabled={loading || !loaded || pending || !supported}
        aria-disabled={!validation.mapping} aria-describedby={`${formId}-validation`}>{pending ? 'Saving…' : 'Save mapping'}</button></>}>
    <form id={formId} noValidate className="source-catalog source-catalog--focused acquisition-form" onSubmit={event => { event.preventDefault(); if (supported) void persist(); }}>
      <p>Stable sourceId: <code>{definition.sourceId}</code></p>
      <p role="status">Configuration availability: {availability}. This is not Definition resolution or live quality.</p>
      <p id={`${formId}-validation`} ref={summary} tabIndex={-1} role="status">{loaded && validation.firstInvalid
        ? `${Object.keys(validation.errors).length} field(s) need attention. Save is blocked; activating Save focuses the first invalid field. ${errors.sourceId ?? ''}`
        : 'Server validation remains authoritative on Save.'}</p>
      {loading && <p role="status">Loading configuration…</p>}
      {!supported && <p role="alert">This Definition cannot acquire: String decoding and COMMAND_ONLY mappings are not supported. The Definition remains valid.</p>}
      {error && <p className="source-catalog-error" role="alert">Server/load error (last response): {error}</p>}
      <p className="acquisition-impact" role="status" aria-live="polite">{impact || notice}</p>
      {error && !loaded && <button type="button" disabled={loading} onClick={() => setRetry(n => n + 1)}>Retry configuration</button>}
      {confirmRemove && <div role="alert"><p>Remove only this acquisition mapping? Definition and saved bindings remain unchanged.</p>
        <button type="button" disabled={pending} onClick={() => setConfirmRemove(false)}>Keep mapping</button>
        <button type="button" disabled={pending} onClick={() => void persist(true)}>Confirm remove mapping</button></div>}
      <fieldset disabled={loading || !loaded || pending || !supported}>
        <legend>Read-only Modbus mapping</legend>
        {field('deviceId', 'Device', devices.find(d => d.id === draft.deviceId)?.enabled === false ? 'Device is disabled; configuration can be saved but acquisition stays disabled.' : 'An existing Device is required. Saving never connects it.',
          <select {...attributes('deviceId')} required value={draft.deviceId} onChange={e => change('deviceId', e.target.value)}><option value="">Select Device</option>
            {draft.deviceId && !devices.some(d => d.id === draft.deviceId) && <option value={draft.deviceId} disabled>Missing Device · {draft.deviceId}</option>}
            {devices.map(d => <option key={d.id} value={d.id}>{d.name}{d.enabled ? '' : ' (disabled)'}</option>)}</select>)}
        {numeric('unitId', 'Unit ID', 'Whole number, 0–255.', true)}
        {select('functionCode', 'Function code', FUNCTION_CODES, 'FC01/02 read Boolean; FC03/04 read numbers. Selecting FC does not reset other fields.', option => definition.dataType === 'Boolean' ? Number(option) > 2 : Number(option) <= 2)}
        {numeric('address', 'Zero-based address', 'Zero is valid. Address + Width must be at most 65536.', true)}
        {select('dataType', 'Wire data type', WIRE_TYPES, 'Changing codec updates only derived Width, with an impact notice. Scale/Offset are retained.', option => (option === 'Boolean') !== (definition.dataType === 'Boolean'))}
        {field('width', 'Width (bits for FC01/02; registers for FC03/04)', 'Derived from the selected wire codec; invalid saved widths are never silently replaced.', <>
          <input {...attributes('width')} readOnly value={draft.width} />
          {errors.width && codecWidth(draft.dataType) !== undefined && <button type="button" onClick={() => { change('width', String(codecWidth(draft.dataType))); setImpact(`Width explicitly corrected to ${codecWidth(draft.dataType)} for ${draft.dataType}.`); }}>Use required codec width ({codecWidth(draft.dataType)})</button>}
        </>)}
        {select('byteOrder', 'Byte order', BYTE_ORDERS, 'Byte ordering for numeric register codecs; no effect on a single Boolean bit.')}
        {select('wordOrder', 'Word order', WORD_ORDERS, 'Word ordering for multi-register codecs; no effect on one register or bit.')}
        {numeric('scale', 'Scale', draft.dataType === 'Boolean' ? 'Boolean requires exactly 1; no automatic reset.' : 'Finite decimal or exponent notation.')}
        {numeric('offset', 'Offset', draft.dataType === 'Boolean' ? 'Boolean requires exactly 0; no automatic reset.' : 'Finite decimal or exponent notation.')}
        {numeric('pollIntervalMs', 'Poll interval (ms)', 'Whole number, 100–3,600,000.', true)}
        {numeric('staleAfterMs', 'Stale threshold (ms)', 'Whole number, 100–86,400,000 and at least the Poll interval.', true)}
        {field('enabled', 'Enable server acquisition', 'Does not connect Device. Disabled Definition/Device prevents acquisition.',
          <input {...attributes('enabled')} type="checkbox" checked={draft.enabled === true} onChange={e => change('enabled', e.target.checked)} />)}
      </fieldset>
      <p>Number codecs and FC01/02 Boolean only. Shared Tags deduplicate identical compatible ranges only; Workflow and Monitor reads remain independent.</p>
    </form>
  </Modal>;
}
