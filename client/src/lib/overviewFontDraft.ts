import type { OverviewElement } from './overviewElements.js';

export interface FontSizePreview { elementId: string; fontSize: number }
export function parseOverviewFontSize(input: string): number | undefined {
  if (!input.trim()) return undefined;
  const value = Number(input);
  return Number.isFinite(value) && value >= 8 && value <= 96 ? value : undefined;
}
/** Render overlay only. Never modifies persisted configuration, Draft/history or revision. */
export function previewOverviewFontSize(elements: readonly OverviewElement[], preview: FontSizePreview | null, mode: 'VIEW' | 'EDIT'): readonly OverviewElement[] {
  if (mode !== 'EDIT' || !preview || parseOverviewFontSize(String(preview.fontSize)) === undefined) return elements;
  return elements.map(element => element.id === preview.elementId && !element.locked
    ? { ...element, style: { ...element.style, fontSize: preview.fontSize } } : element);
}

/** One editing gesture: preview many inputs, finish at most one changed property. */
export class FontSizeDraftSession {
  private baseline: number;
  private input: string;
  constructor(value: number) { this.baseline = value; this.input = String(value); }
  reset(value: number): string { this.baseline = value; this.input = String(value); return this.input; }
  change(value: string): number | null { this.input = value; return parseOverviewFontSize(value) ?? null; }
  cancel(): string { this.input = String(this.baseline); return this.input; }
  finish(): { text: string; commit?: number } {
    const value = parseOverviewFontSize(this.input);
    if (value === undefined) return { text: this.cancel() };
    const changed = value !== this.baseline;
    this.baseline = value; this.input = String(value);
    return changed ? { text: this.input, commit: value } : { text: this.input };
  }
}
