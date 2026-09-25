import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { InspectorTransition } from './InspectorTransition.js';
const hooks = vi.hoisted(() => ({ slots: [] as any[], index: 0, effects: [] as Array<() => void> }));
vi.mock('react', async original => ({ ...await original<typeof import('react')>(),
  useRef: (initial: any) => { const i = hooks.index++; return hooks.slots[i] ?? (hooks.slots[i] = { current: initial }); },
  useEffect: (effect: () => void) => { hooks.effects.push(effect); },
}));
const draw = (visible: boolean, onReturnFocus = vi.fn(), label = 'Current element') => {
  hooks.index = 0; hooks.effects = [];
  return InspectorTransition({ visible, onReturnFocus, children: <button>{label}</button> });
};
beforeEach(() => { hooks.slots = []; hooks.index = 0; hooks.effects = []; });
afterEach(() => vi.unstubAllGlobals());
describe('dev.5 Inspector transition boundary (component/CSS evidence, not browser layout)', () => {
  it('retains only an empty aria-hidden slot when closed; no hidden interactive controls or stale fields', () => {
    const closed = draw(false, vi.fn(), 'Old element'); const html = renderToStaticMarkup(closed);
    expect(html).toContain('aria-hidden="true"'); expect(html).not.toContain('<button'); expect(html).not.toContain('Old element');
    const opened = renderToStaticMarkup(draw(true, vi.fn(), 'New element')); expect(opened).toContain('New element'); expect(opened).not.toContain('Old element');
  });
  it('returns lost Inspector focus to the Canvas when closing without scrolling', () => {
    const focus = vi.fn(), body = {}; vi.stubGlobal('document', { body, activeElement: body });
    const open = draw(true, focus); open.props.onFocusCapture(); draw(false, focus); hooks.effects[0](); expect(focus).toHaveBeenCalledTimes(1);
    draw(false, focus); hooks.effects[0](); expect(focus).toHaveBeenCalledTimes(1);
    const page = readFileSync(new URL('./OverviewPage.tsx', import.meta.url), 'utf8'); expect(page).toContain("querySelector<HTMLElement>('.overview-canvas')?.focus({ preventScroll: true })");
  });
  it('does not steal deliberate focus from a dialog or another control', () => {
    const focus = vi.fn(); vi.stubGlobal('document', { body: {}, activeElement: { control: true } });
    const open = draw(true, focus); open.props.onFocusCapture(); draw(false, focus); hooks.effects[0](); expect(focus).not.toHaveBeenCalled();
  });
  it('does not move focus while visible, including input/select use', () => {
    const focus = vi.fn(); const open = draw(true, focus); open.props.onFocusCapture(); hooks.effects[0](); expect(focus).not.toHaveBeenCalled();
  });
  it('uses scoped continuous width tracks, releases the final gutter, and disables motion for reduced motion', () => {
    const css = readFileSync(new URL('../../styles/overview.css', import.meta.url), 'utf8');
    expect(css).toContain('transition: grid-template-columns var(--motion-normal) var(--ease-standard)');
    expect(css).toContain('--overview-inspector-track: 0px');
    expect(css).toMatch(/\.overview-inspector-slot\[data-visible='false'\][^{]*\{[^}]*pointer-events:\s*none/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.overview--edit[^}]*\.overview-inspector-slot\s*\{ transition: none;/);
    const component = readFileSync(new URL('./InspectorTransition.tsx', import.meta.url), 'utf8');
    expect(component).not.toMatch(/fitView|setViewport|setDraft|setHistory|fetch\(/);
  });
});
