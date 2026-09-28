import type { OverviewElement } from './overviewElements.js';
import { hasInlineRuntimeAction, inheritedMonitoringFont } from './overviewPresentationStyle.js';
import { operatorRuntimeStatus, type runtimePresentation } from './overviewRuntimePresentation.js';

/** Canvas wording only. The canonical projection and Details diagnostics remain untouched. */
export function canvasRuntimeStatus(p: ReturnType<typeof runtimePresentation>, age: string, roomy: boolean, editorPreview = false) {
  if (editorPreview) return p.text === '—' ? 'Unsupported' : '';
  return operatorRuntimeStatus(p, roomy ? age : '')
    .replace('Unsupported producer', 'Unsupported')
    .replace('Last good', 'Historical')
    .replace('Device disconnected', 'Disconnected')
    .replace('BAD sample', 'BAD')
    .replace('Awaiting data', 'No data')
    .replace('UNCERTAIN', 'Uncertain')
    .replace('STALE', 'Stale')
    .replace(/ · $/, '');
}

/** Geometry/configuration only, identical in Edit and View; never driven by a sample. */
export function canvasMonitoringLayout(element: OverviewElement) {
  const { style, type } = element;
  const width = Math.max(0, element.width - 2 * style.borderWidth);
  const height = Math.max(0, element.height - 2 * style.borderWidth);
  const light = type === 'STATUS_LIGHT';
  const compact = type === 'VALUE_BADGE' || element.height < 64;
  const micro = element.width < 112 || element.height < 36;
  const valueSize = style.valueFontSize ?? inheritedMonitoringFont(element, 'valueFontSize');
  const captionSize = style.captionFontSize ?? inheritedMonitoringFont(element, 'captionFontSize');
  const lampSize = Math.min(32, Math.max(16, 1.25 * style.fontSize));
  const readingHeight = light ? lampSize : 1.15 * valueSize;
  const contentHeight = Math.max(0, height - (micro ? 6 : compact ? 10 : 16));
  const statusRow = width >= 72 && contentHeight >= readingHeight + 15;
  const inlineAction = hasInlineRuntimeAction(element) && statusRow;
  const horizontalCaption = compact && !micro && !light;
  const caption = !!style.text.trim() && (horizontalCaption
    ? width >= 112 && contentHeight >= Math.max(readingHeight, 1.15 * captionSize) + (statusRow ? 15 : 0)
    : contentHeight >= readingHeight + 1.15 * captionSize + 2 + (statusRow ? 15 : 0));
  const contentWidth = Math.max(0, width - 2 - (micro ? 8 : 20) - (inlineAction ? 26 : 0) - (statusRow ? 0 : 16));
  return { compact, micro, statusRow, inlineAction, caption,
    tiny: height < 26 || width < 48,
    unit: width >= 88 && contentHeight >= Math.max(readingHeight, .6 * style.fontSize * 1.15) + (statusRow ? 15 : 0) + (caption && !horizontalCaption ? 1.15 * captionSize + 2 : 0),
    lightText: !light || (contentWidth >= lampSize + 5 + valueSize * 4 && contentHeight >= 1.15 * valueSize + (statusRow ? 15 : 0) + (caption ? 1.15 * captionSize + 2 : 0)),
    roomy: width >= 224 && height >= 64,
  };
}
