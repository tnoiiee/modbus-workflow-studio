export interface ReconnectPolicy {
  baseMs: number;
  maxMs: number;
  jitter: number;
}

export const DEFAULT_RECONNECT_POLICY: ReconnectPolicy = {
  baseMs: 250,
  maxMs: 30_000,
  jitter: 0.2,
};

export function reconnectDelay(
  attempt: number,
  policy: ReconnectPolicy = DEFAULT_RECONNECT_POLICY,
  random: () => number = Math.random,
) {
  const boundedAttempt = Math.max(0, Math.min(8, Math.trunc(attempt)));
  const baseMs = Math.max(250, policy.baseMs);
  const maxMs = Math.max(baseMs, policy.maxMs);
  const jitter = Math.max(0, Math.min(0.5, policy.jitter));
  const ceiling = Math.min(maxMs, baseMs * 2 ** boundedAttempt);
  const delay = Math.max(0, Math.round(ceiling + ceiling * jitter * (random() * 2 - 1)));
  return { delay, nextAttempt: Math.min(boundedAttempt + 1, 8), ceiling };
}
