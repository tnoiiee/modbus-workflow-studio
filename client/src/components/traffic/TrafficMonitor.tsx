import { Fragment, useId, useMemo, useRef, useState } from 'react';
import { TRAFFIC_COLUMNS, TRAFFIC_DETAIL_CHARS, TRAFFIC_PAGE_SIZE, TrafficPresentation, trafficText, type TrafficRow } from '../../lib/traffic.js';
import '../../styles/traffic.css';
const optional = (value: string | number | null) => value === null ? '—' : typeof value === 'number' ? String(value) : trafficText(value);
function TrafficDetails({ row }: { row: TrafficRow }) {
  const fields: Array<[string, string | number | null]> = [
    ['Timestamp', row.timestamp], ['Direction', row.direction], ['Device', row.deviceId], ['Origin', row.origin],
    ['Workflow ID', row.workflowId], ['Node ID', row.nodeId], ['Monitor list ID', row.monitorListId],
    ['Transaction ID', row.tx], ['Function code', row.fc], ['Address', row.address], ['Quantity', row.quantity],
    ['Request class', row.requestClass], ['Duration (ms)', row.duration], ['Result', row.result],
    ['Error', row.error], ['Payload (protocol hex)', row.payload], ['Encoded payload', row.encodedPayload],
  ];
  return <div className="traffic-details"><p>One event, not a grouped transaction. RX success is not Tag quality or verified read-back.</p>
    <dl>{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd><pre tabIndex={0}>{typeof value === 'number' ? String(value) : trafficText(value, TRAFFIC_DETAIL_CHARS)}</pre>
      {typeof value === 'string' && value.length > TRAFFIC_DETAIL_CHARS && <small>Display truncated at {TRAFFIC_DETAIL_CHARS} characters; retained records are unchanged.</small>}</dd></div>)}</dl>
  </div>;
}
/** Dedicated presentation. No fetch/socket calls; both existing REST and WS rows take this same path. */
export function TrafficMonitor({ rows }: { rows: unknown[] }) {
  const presenter = useRef(new TrafficPresentation());
  const records = useMemo(() => presenter.current.normalize(rows), [rows]);
  const [page, setPage] = useState(0), [expanded, setExpanded] = useState<string | null>(null);
  const scopeId = useId();
  const pages = Math.max(1, Math.ceil(records.length / TRAFFIC_PAGE_SIZE)), current = Math.min(page, pages - 1);
  const visible = records.slice(current * TRAFFIC_PAGE_SIZE, (current + 1) * TRAFFIC_PAGE_SIZE);
  return <section className="traffic-page panel" aria-label="Traffic Monitor">
    <header className="traffic-toolbar"><div><h3>TRAFFIC</h3><p>Newest received first · {records.length} retained events</p></div>
      <nav aria-label="Traffic pagination"><button type="button" className="btn" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button>
        <span>Page {current + 1} of {pages}</span><button type="button" className="btn" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</button></nav>
    </header>
    <p className="traffic-caveat">Best-effort live traffic, not a complete packet capture. TX, RX and ERROR are separate events; transaction IDs may be reused. No rows are grouped or deduplicated.</p>
    <div className="traffic-table-scroll" tabIndex={0} aria-label="Traffic event table, scroll horizontally for all fields">
      <table className="traffic-table"><caption className="sr-only">Stable traffic fields for Workflow, Modbus Monitor, Shared Tag Acquisition and generic events</caption>
        <thead><tr>{TRAFFIC_COLUMNS.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead>
        <tbody>{visible.map(row => {
          const detailsId = `${scopeId}-${row.key}`, open = expanded === row.key;
          return <Fragment key={row.key}><tr>
            <td><span className="traffic-cell-text">{optional(row.timestamp)}</span></td>
            <td><span className={`traffic-phase traffic-phase--${row.phase.toLowerCase()}`}>{row.phase}</span>{row.malformed && <small className="traffic-partial">Partial / unrecognized fields</small>}</td>
            <td><span className="traffic-cell-text">{optional(row.deviceId)}</span></td>
            <td><span className="traffic-origin">{row.origin}</span><span className="traffic-cell-text">{optional(row.requestClass)}</span>
              {row.workflowId !== null && <span className="traffic-cell-text">Workflow: {trafficText(row.workflowId)}</span>}
              {row.nodeId !== null && <span className="traffic-cell-text">Node: {trafficText(row.nodeId)}</span>}
              {row.monitorListId !== null && <span className="traffic-cell-text">List: {trafficText(row.monitorListId)}</span>}</td>
            <td>{optional(row.tx)}</td><td>{row.fc === null ? '—' : `FC${String(row.fc).padStart(2, '0')}`}</td><td>{optional(row.address)}</td>
            <td>{row.duration === null ? '—' : `${row.duration} ms`}</td><td><span className="traffic-cell-text">{optional(row.result)}</span></td>
            <td><span className="traffic-cell-text">Payload: {trafficText(row.payload)}</span><span className="traffic-cell-text">Error: {trafficText(row.error)}</span>
              <button className="btn" type="button" aria-expanded={open} aria-controls={detailsId} aria-label={`${open ? 'Hide' : 'Show'} details for ${row.phase} event, transaction ${optional(row.tx)}, device ${optional(row.deviceId)}`} onClick={() => setExpanded(open ? null : row.key)}>{open ? 'Hide details' : 'Details'}</button></td>
          </tr>{open && <tr id={detailsId}><td colSpan={TRAFFIC_COLUMNS.length}><TrafficDetails row={row} /></td></tr>}</Fragment>;
        })}</tbody>
      </table>
    </div>
    {!records.length && <p className="traffic-empty" role="status">No traffic received. This view does not start Device reads.</p>}
  </section>;
}
