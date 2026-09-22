/**
 * Tone classification for the existing save/revision indicator text.
 * Presentation only: the strings themselves are produced by the unchanged
 * save pipeline in `App.tsx`.
 */
export function saveTone(saved: string): 'saved' | 'saving' | 'pending' | 'error' {
  const value = saved.toLowerCase();
  if (value.includes('fail') || value.includes('not saved')) return 'error';
  if (value.includes('saved')) return 'saved';
  if (value.includes('pending')) return 'pending';
  return 'saving';
}

/** Class name for the save indicator element. */
export function saveIndicatorClass(saved: string): string {
  return `save-indicator save-indicator--${saveTone(saved)}`;
}
