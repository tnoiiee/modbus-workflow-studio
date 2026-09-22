export interface ReliabilityConfig {
  monitorQueueLimit: number;
  monitorPendingPerList: number;
  wsMaxMessages: number;
  wsMaxBytes: number;
  wsTelemetryCoalesceMs: number;
  wsReconnectBaseMs: number;
  wsReconnectMaxMs: number;
  wsReconnectJitter: number;
}

export const DEFAULT_RELIABILITY_CONFIG: ReliabilityConfig = {
  monitorQueueLimit: 32,
  monitorPendingPerList: 1,
  wsMaxMessages: 256,
  wsMaxBytes: 1024 * 1024,
  wsTelemetryCoalesceMs: 100,
  wsReconnectBaseMs: 250,
  wsReconnectMaxMs: 30_000,
  wsReconnectJitter: 0.2,
};

function integer(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.trunc(parsed)));
}

function number(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

export function readReliabilityConfig(env: NodeJS.ProcessEnv = process.env): ReliabilityConfig {
  const wsReconnectBaseMs = integer(env.WS_RECONNECT_BASE_MS, DEFAULT_RELIABILITY_CONFIG.wsReconnectBaseMs, 250, 60_000);
  const wsReconnectMaxMs = Math.max(
    wsReconnectBaseMs,
    integer(env.WS_RECONNECT_MAX_MS, DEFAULT_RELIABILITY_CONFIG.wsReconnectMaxMs, 250, 300_000),
  );
  return {
    monitorQueueLimit: integer(env.MONITOR_QUEUE_LIMIT, DEFAULT_RELIABILITY_CONFIG.monitorQueueLimit, 1, 10_000),
    monitorPendingPerList: 1,
    wsMaxMessages: integer(env.WS_CLIENT_MAX_MESSAGES, DEFAULT_RELIABILITY_CONFIG.wsMaxMessages, 1, 10_000),
    wsMaxBytes: integer(env.WS_CLIENT_MAX_BYTES, DEFAULT_RELIABILITY_CONFIG.wsMaxBytes, 4_096, 64 * 1024 * 1024),
    wsTelemetryCoalesceMs: integer(
      env.WS_TELEMETRY_COALESCE_MS,
      DEFAULT_RELIABILITY_CONFIG.wsTelemetryCoalesceMs,
      0,
      60_000,
    ),
    wsReconnectBaseMs,
    wsReconnectMaxMs,
    wsReconnectJitter: number(env.WS_RECONNECT_JITTER, DEFAULT_RELIABILITY_CONFIG.wsReconnectJitter, 0, 0.5),
  };
}
