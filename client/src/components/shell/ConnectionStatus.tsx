import { CircleDot, Radio, RefreshCw, WifiOff } from 'lucide-react';
import type { ConnectionState } from '../../lib/connectionStatus.js';

type IconComponent = typeof Radio;

const ICONS: Record<ConnectionState, IconComponent> = {
  LIVE: Radio,
  CONNECTING: RefreshCw,
  RECONNECTING: RefreshCw,
  OFFLINE: WifiOff,
  UNKNOWN: CircleDot,
};

const DESCRIPTIONS: Record<ConnectionState, string> = {
  LIVE: 'Live updates connected',
  CONNECTING: 'Opening the live update socket',
  RECONNECTING: 'Live updates reconnecting',
  OFFLINE: 'Live updates offline, still retrying',
  UNKNOWN: 'Live update status unknown',
};

export interface ConnectionStatusProps {
  state: ConnectionState;
  /** Optional detail carried by the existing reconnect notice, e.g. `500 ms`. */
  detail?: string;
}

/**
 * Visible `LIVE` / `RECONNECTING` / `OFFLINE` presentation.
 *
 * Read-only: it renders state derived from the existing reconnect notice and
 * never touches socket, reconnect, or resync behavior.
 */
export function ConnectionStatus({ state, detail }: ConnectionStatusProps) {
  const Icon = ICONS[state];
  const label = state === 'UNKNOWN' ? 'STATUS' : state;
  const text = detail ? `${DESCRIPTIONS[state]} (${detail})` : DESCRIPTIONS[state];

  return (
    <span className={`conn-pill conn-pill--${state.toLowerCase()}`} role="status" aria-live="polite" title={text}>
      <span className="conn-pill__icon" aria-hidden="true">
        <Icon size={14} />
      </span>
      <span className="conn-pill__label">{label}</span>
      {detail ? <span className="conn-pill__detail">{detail}</span> : null}
    </span>
  );
}
