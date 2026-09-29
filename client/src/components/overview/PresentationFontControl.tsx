import type { OverviewElement } from '../../lib/overviewElements.js';
import { inheritedMonitoringFont, type PresentationPreviewProperty } from '../../lib/overviewPresentationStyle.js';
import { PresentationNumberField } from './PresentationNumberField.js';

export function PresentationFontControl({ element, property, onPatchStyle, onPreview }: {
  element: OverviewElement; property: 'captionFontSize' | 'valueFontSize';
  onPatchStyle: (patch: Partial<OverviewElement['style']>) => void;
  onPreview?: (property: PresentationPreviewProperty, value: number | null) => void;
}) {
  const value = element.style[property], fallback = inheritedMonitoringFont(element, property);
  const label = property === 'captionFontSize' ? 'Caption Font Size' : 'Value Font Size';
  return <div className="element-inspector__font-override">
    {value === undefined ? <>
      <span>{label}</span><output>Inherited · {Number(fallback.toFixed(3))} px</output>
      <button type="button" onClick={() => onPatchStyle({ [property]: Math.max(8, Math.min(96, fallback)) })}>Customize {label}</button>
    </> : <>
      <span className="element-inspector__inheritance">Custom</span>
      <PresentationNumberField label={label} value={value} min={8} max={96} unit="px"
        onPreview={next => onPreview?.(property, next)} onCommit={next => onPatchStyle({ [property]: next })} />
      <button type="button" onClick={() => { onPreview?.(property, null); onPatchStyle({ [property]: undefined }); }}>Reset {label} to Inherited</button>
    </>}
  </div>;
}
