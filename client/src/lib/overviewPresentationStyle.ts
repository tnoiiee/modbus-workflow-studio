import type { OverviewElement, OverviewElementStyle, OverviewElementType } from './overviewElements.js';

export const hasMonitoringTypography = (type: OverviewElementType) =>
  ['NUMERIC_LABEL', 'TEXT_LABEL', 'STATUS_LIGHT', 'VALUE_BADGE'].includes(type);
export const hasValueTypography = (type: OverviewElementType) =>
  ['NUMERIC_LABEL', 'STATUS_LIGHT', 'VALUE_BADGE'].includes(type);

/** Diagnostic/Inspector fallback only: leave absent overrides out of DOM style and persistence. */
export function inheritedMonitoringFont(element: OverviewElement, property: 'captionFontSize' | 'valueFontSize') {
  const base = element.style.fontSize;
  if (property === 'valueFontSize') return element.type === 'STATUS_LIGHT' ? .75 * base : base;
  return element.width < 112 || element.height < 36 ? .65 * base : Math.min(15, Math.max(11, .65 * base));
}

/** Fixed 24px target + 4px margins, separate from a minimum readable content column. */
export function hasInlineRuntimeAction(element: OverviewElement) {
  return element.width - 2 * element.style.borderWidth >= 112 && element.height - 2 * element.style.borderWidth >= 32;
}

export type PresentationPreviewProperty = 'captionFontSize' | 'valueFontSize' | 'backgroundOpacity';
export interface PresentationPreview { elementId: string; property: PresentationPreviewProperty; value: number }
export function isPresentationNumber(property: PresentationPreviewProperty, value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) &&
    (property === 'backgroundOpacity' ? value >= 0 && value <= 1 : value >= 8 && value <= 96);
}
/** Render-only overlay. Never normalize or persist defaults; preserve unknown style fields. */
export function previewOverviewPresentation(elements: readonly OverviewElement[], preview: PresentationPreview | null, mode: 'EDIT' | 'VIEW') {
  if (mode !== 'EDIT' || !preview || !isPresentationNumber(preview.property, preview.value)) return elements;
  return elements.map(element => element.id === preview.elementId && !element.locked
    ? { ...element, style: { ...element.style, [preview.property]: preview.value } } : element);
}

/** UI numeric gesture in display units (percent or px). Enter + blur cannot commit twice. */
export class PresentationNumberSession {
  private baseline: number;
  private input: string;
  constructor(value: number, private min: number, private max: number) { this.baseline = value; this.input = String(value); }
  reset(value: number) { this.baseline = value; this.input = String(value); return this.input; }
  change(input: string): number | null {
    this.input = input;
    const value = Number(input);
    return input.trim() && Number.isFinite(value) && value >= this.min && value <= this.max ? value : null;
  }
  cancel() { this.input = String(this.baseline); return this.input; }
  finish(): { text: string; commit?: number } {
    const value = this.change(this.input);
    if (value === null) return { text: this.cancel() };
    const changed = value !== this.baseline; this.baseline = value;
    return changed ? { text: this.input, commit: value } : { text: this.input };
  }
}

/** Approved four-field extension only; separate from Binding/Source validation. */
export function validatePresentationStyle(style: OverviewElementStyle): string[] {
  const errors: string[] = [];
  for (const property of ['captionFontSize', 'valueFontSize', 'backgroundOpacity'] as const) {
    if (style[property] !== undefined && !isPresentationNumber(property, style[property])) errors.push(`${property} is outside its finite presentation range`);
  }
  if (style.showBorder !== undefined && typeof style.showBorder !== 'boolean') errors.push('showBorder must be boolean');
  return errors;
}
