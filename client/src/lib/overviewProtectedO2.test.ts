import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Source-integrity anchors from approved base eed5884. NOT browser interaction evidence.
// O2-A is authorized to add an App callback, not alter these protected implementations.
const anchors = [
  ["Workflow selector", "const selectWorkflow=", "\n", "19cb64f9576d6d0d7e93cfb05b5015e2bb7e22813e7ff90ae48a4e01bcec16dd"],
  ["Devices", "function Devices(", "function Runtime()", "f3e945f59e4c706171c0a38b5d1050e146dfca6655eae4780d2df2191ef38490"],
  ["Workflow Canvas", "{page==='Workflow'&&<section", "{page==='Devices'&&", "0dc0e8777fe5e488ee4eb6a81b7e4381b2a66195f155ed8c4fcc736b5334c9c3"],
] as const;
describe('O2-A protected App implementation integrity', () => {
  it.each(anchors)('%s remains byte-for-byte at the approved baseline', (_name, start, end, hash) => {
    const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
    const from = app.indexOf(start), to = app.indexOf(end, from);
    expect(from).toBeGreaterThan(-1); expect(to).toBeGreaterThan(from);
    expect(createHash('sha256').update(app.slice(from, to)).digest('hex')).toBe(hash);
  });
});
