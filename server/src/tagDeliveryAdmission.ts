import type { IncomingMessage } from 'node:http';
/** Fixed-state token bucket: no per-IP map that can grow under hostile input. */
export class DeliveryRate {
  private balance: number; private last: number;
  constructor(private rate: number, private burst: number, private now = () => performance.now()) { this.balance = burst; this.last = now(); }
  take() { const at = this.now(); this.balance = Math.min(this.burst, this.balance + Math.max(0, at - this.last) * this.rate / 1000); this.last = at; if (this.balance < 1) return false; this.balance--; return true; }
}
export function tagOriginPolicy(env: NodeJS.ProcessEnv = process.env) {
  const allowed = new Set((env.TAG_ALLOWED_ORIGINS ?? '').split(',').map(v => v.trim()).filter(Boolean).map(value => {
    const url = new URL(value); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('Invalid TAG_ALLOWED_ORIGINS'); return url.origin;
  }));
  const allowMissing = env.TAG_ALLOW_MISSING_ORIGIN !== 'false';
  return (request: IncomingMessage): boolean => {
    const origin = request.headers.origin; if (origin === undefined) return allowMissing;
    try { const url = new URL(origin); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash && (allowed.has(url.origin) || url.host === request.headers.host); } catch { return false; }
  };
}
