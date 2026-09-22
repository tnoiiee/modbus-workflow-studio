/**
 * Connection status derivation (v1.2.12 UI).
 *
 * The v1.2.11 reconnect mechanism already writes human-readable connection
 * text into the header notice (`Live updates: LIVE`, `Live updates:
 * RECONNECTING (500 ms)`, `Live updates: OFFLINE · retrying (30000 ms)`,
 * `Live updates: CONNECTING`). This module turns that existing state into a
 * typed status for the connection pill.
 *
 * It is deliberately pure and read-only: it never opens, closes, retries, or
 * resynchronizes a socket, and it does not change reconnect/resync behavior.
 */

export type ConnectionState = 'LIVE' | 'CONNECTING' | 'RECONNECTING' | 'OFFLINE' | 'UNKNOWN';

export interface DerivedConnection {
  state: ConnectionState;
  /** Parenthesized detail from the notice, e.g. `500 ms`. */
  detail?: string;
}

const CONNECTION_NOTICE = /^Live updates:\s*(.+)$/i;
const TRAILING_DETAIL = /^(.*?)\s*\(([^()]*)\)\s*$/;

/**
 * Parses an existing notice string. Returns `undefined` when the notice is not
 * a connection notice (for example a validation or API error message), so the
 * caller can keep the last known connection state instead of guessing.
 */
export function deriveConnectionState(notice: string | undefined): DerivedConnection | undefined {
  if (!notice) return undefined;
  const match = CONNECTION_NOTICE.exec(notice.trim());
  if (!match) return undefined;
  const body = match[1].trim();
  const detailed = TRAILING_DETAIL.exec(body);
  const label = (detailed ? detailed[1] : body).trim().toUpperCase();
  const detail = detailed ? detailed[2].trim() : undefined;

  if (label.startsWith('LIVE')) return { state: 'LIVE', detail };
  if (label.startsWith('RECONNECTING')) return { state: 'RECONNECTING', detail };
  if (label.startsWith('CONNECTING')) return { state: 'CONNECTING', detail };
  if (label.startsWith('OFFLINE')) return { state: 'OFFLINE', detail };
  return { state: 'UNKNOWN', detail };
}

/** True when the notice is only a connection status message. */
export function isConnectionNotice(notice: string | undefined): boolean {
  return deriveConnectionState(notice) !== undefined;
}

/** Last-known-wins resolution used by the status pill. */
export function resolveConnectionState(notice: string | undefined, previous: ConnectionState): ConnectionState {
  return deriveConnectionState(notice)?.state ?? previous;
}

/** Parenthesized detail for the current notice, if any. */
export function connectionNoticeDetail(notice: string | undefined): string | undefined {
  return deriveConnectionState(notice)?.detail;
}
