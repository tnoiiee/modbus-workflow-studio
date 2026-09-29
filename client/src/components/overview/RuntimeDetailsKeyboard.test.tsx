import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactNode } from 'react';
import { Modal } from '../ui/Modal.js';
import { readFileSync } from 'node:fs';

// Execute the existing Modal's real keyboard callbacks with deterministic focus targets.
// This is not a browser, screen-reader, or visual focus certification.
const hooks = vi.hoisted(() => ({ effects: [] as Array<() => void | (() => void)>, refs: [] as Array<{ current: any }> }));
vi.mock('react', async original => ({ ...await original<typeof import('react')>(),
  useRef: (value: any) => { const ref = { current: value }; hooks.refs.push(ref); return ref; },
  useEffect: (effect: () => void | (() => void)) => { hooks.effects.push(effect); },
  useId: () => 'runtime-dialog-test',
}));
const cleanups: Array<() => void> = [];
beforeEach(() => { hooks.effects = []; hooks.refs = []; });
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); vi.unstubAllGlobals(); });
function setup() {
  // Node EventTarget does not remove boolean-capture listeners like a Browser.
  // Normalize options in this DOM stand-in; keep the real Modal cleanup/assertions.
  class FocusDocument extends EventTarget {
    activeElement: Target | null = null;
    override removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) {
      super.removeEventListener(type, callback, typeof options === 'boolean' ? { capture: options } : options);
    }
  }
  const document = new FocusDocument();
  class Target {
    focus = vi.fn(() => { document.activeElement = this; });
  }
  const opener = new Target(), first = new Target(), last = new Target(); document.activeElement = opener;
  vi.stubGlobal('document', document); vi.stubGlobal('HTMLElement', Target);
  const close = vi.fn(); const tree = Modal({ open: true, title: 'Runtime details', onClose: close });
  hooks.refs[0].current = { querySelectorAll: () => [first, last], contains: (target: unknown) => target === first || target === last, focus: first.focus };
  hooks.effects.forEach(effect => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); });
  const key = (value: string, shiftKey = false) => { const event = Object.assign(new Event('keydown', { cancelable: true }), { key: value, shiftKey }); document.dispatchEvent(event); return event; };
  return { document, opener, first, last, close, tree, key };
}
function nodes(node: ReactNode): any[] { if (Array.isArray(node)) return node.flatMap(nodes); if (!isValidElement(node)) return []; return [node, ...nodes((node.props as any).children)]; }
describe('dev.12 Details accessible exit and focus preservation', () => {
  it('focus enters the dialog; Escape invokes close; cleanup returns focus to opener', () => {
    const f = setup(); expect(f.document.activeElement).toBe(f.first);
    const event = f.key('Escape'); expect(event.defaultPrevented).toBe(true); expect(f.close).toHaveBeenCalledTimes(1);
    cleanups.splice(0).forEach(fn => fn()); expect(f.document.activeElement).toBe(f.opener);
    f.key('Escape'); expect(f.close).toHaveBeenCalledTimes(1);
  });
  it('Tab/Shift-Tab wrap safely with Escape exit, rather than trapping the user permanently', () => {
    const f = setup(); f.last.focus(); expect(f.key('Tab').defaultPrevented).toBe(true); expect(f.document.activeElement).toBe(f.first);
    expect(f.key('Tab', true).defaultPrevented).toBe(true); expect(f.document.activeElement).toBe(f.last);
    f.key('Escape'); expect(f.close).toHaveBeenCalledTimes(1);
  });
  it('close button is native, keyboard operable, and calls the same close handler', () => {
    const f = setup(); const button = nodes(f.tree).find(node => node.type === 'button' && node.props.onClick === f.close);
    expect(button).toBeDefined(); expect(button.props.type).toBe('button'); button.props.onClick(); expect(f.close).toHaveBeenCalledTimes(1);
  });
  it('Runtime Details still uses this Modal and sample updates cannot rerun its focus-entry effect', () => {
    const details = readFileSync(new URL('./RuntimeDetails.tsx', import.meta.url), 'utf8'), modal = readFileSync(new URL('../ui/Modal.tsx', import.meta.url), 'utf8');
    expect(details).toContain('<Modal open'); expect(details).toContain('onClose={onClose}'); expect(details).toContain('createPortal(content, document.body)');
    expect(modal).toContain('[open, initialFocusRef]'); expect(modal).toContain('onCloseRef.current = onClose');
  });
});
