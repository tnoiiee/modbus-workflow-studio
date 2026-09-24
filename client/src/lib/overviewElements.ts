/**
 * Overview Element model, placement, history, and validation (O1-C).
 * Pure helpers only — drafts stay client-side until Save & Exit.
 */

export type OverviewElementType =
  | 'NUMERIC_LABEL'
  | 'TEXT_LABEL'
  | 'STATUS_LIGHT'
  | 'VALUE_BADGE'
  | 'PICTURE_BOX'
  | 'SWITCH'
  | 'PUSH_BUTTON'
  | 'NAVIGATION_LINK'
  | 'STATIC_TEXT'
  | 'RECTANGLE'
  | 'PANEL'
  | 'DIVIDER'
  | 'STATIC_IMAGE';

export type OverviewElementCategory = 'MONITORING' | 'CONTROL' | 'DISPLAY';

export type OverviewBindingStatus = 'NOT_BOUND' | 'DRAFT';
export type OverviewBindingDirection = 'MONITOR' | 'COMMAND' | 'NONE';
export type OverviewBindingDataType = 'Boolean' | 'Number' | 'String' | 'Unknown';

export interface OverviewElementStyle {
  text: string;
  fontSize: number;
  textColor: string;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  opacity: number;
  alignment: 'left' | 'center' | 'right';
}

export interface OverviewElementBinding {
  tagId: string;
  tagName: string;
  dataType: OverviewBindingDataType;
  direction: OverviewBindingDirection;
  status: OverviewBindingStatus;
}

/** Configuration metadata only; no registry lookup or runtime connection. */
export function validateOverviewBinding(category: OverviewElementCategory, value: unknown): string[] {
  if (!value || typeof value !== 'object') return ['Binding configuration is required'];
  const binding = value as Record<string, unknown>;
  const errors: string[] = [];
  if (typeof binding.tagId !== 'string') errors.push('Tag ID must be text');
  if (typeof binding.tagName !== 'string') errors.push('Tag Name must be text');
  if (!['Boolean', 'Number', 'String', 'Unknown'].includes(String(binding.dataType))) {
    errors.push('Data Type must be Boolean, Number, String or Unknown');
  }
  if (!['NOT_BOUND', 'DRAFT'].includes(String(binding.status))) {
    errors.push('Binding status must be NOT_BOUND or DRAFT');
  }
  if (!overviewAllowedDirections(category).includes(binding.direction as OverviewBindingDirection)) {
    errors.push(`Binding direction must be ${overviewAllowedDirections(category).join(' or ')}`);
  }
  const tagId = typeof binding.tagId === 'string' ? binding.tagId.trim() : '';
  if (binding.status === 'DRAFT' && !tagId) errors.push('DRAFT binding requires a non-empty Tag ID');
  if (binding.status === 'NOT_BOUND' && tagId) errors.push('A Tag ID requires DRAFT status');
  return errors;
}

/** One inspector commit; derive status from identity, never from runtime. */
export function patchOverviewBinding(
  category: OverviewElementCategory,
  binding: OverviewElementBinding,
  patch: Partial<OverviewElementBinding>,
): OverviewElementBinding {
  const next = { ...binding, ...patch };
  if (patch.tagId !== undefined) next.tagId = patch.tagId.trim();
  if (patch.tagName !== undefined) next.tagName = patch.tagName.trim();
  if (patch.direction !== undefined) next.direction = normalizeOverviewBindingDirection(category, patch.direction);
  next.status = next.tagId.trim() ? 'DRAFT' : 'NOT_BOUND';
  return next;
}

/** Full O1-C Overview Element shape persisted in Page `elements`. */
export interface OverviewElement {
  id: string;
  type: OverviewElementType;
  category: OverviewElementCategory;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  visible: boolean;
  style: OverviewElementStyle;
  binding: OverviewElementBinding;
  /** Persisted View-mode control preview state (CONTROL elements only). */
  controlState?: { value: boolean; updatedAt: string };
}

export type OverviewElementSnapshot = readonly OverviewElement[];

/** Canvas snap grid — matches OverviewCanvas and Workflow canvas. */
export const OVERVIEW_ELEMENT_SNAP = 16;

export const OVERVIEW_ALL_ELEMENT_TYPES: readonly OverviewElementType[] = [
  'NUMERIC_LABEL',
  'TEXT_LABEL',
  'STATUS_LIGHT',
  'VALUE_BADGE',
  'PICTURE_BOX',
  'SWITCH',
  'PUSH_BUTTON',
  'NAVIGATION_LINK',
  'STATIC_TEXT',
  'RECTANGLE',
  'PANEL',
  'DIVIDER',
  'STATIC_IMAGE',
];

export const OVERVIEW_TYPE_CATEGORY: Readonly<Record<OverviewElementType, OverviewElementCategory>> = {
  NUMERIC_LABEL: 'MONITORING',
  TEXT_LABEL: 'MONITORING',
  STATUS_LIGHT: 'MONITORING',
  VALUE_BADGE: 'MONITORING',
  PICTURE_BOX: 'MONITORING',
  SWITCH: 'CONTROL',
  PUSH_BUTTON: 'CONTROL',
  NAVIGATION_LINK: 'CONTROL',
  STATIC_TEXT: 'DISPLAY',
  RECTANGLE: 'DISPLAY',
  PANEL: 'DISPLAY',
  DIVIDER: 'DISPLAY',
  STATIC_IMAGE: 'DISPLAY',
};

export const OVERVIEW_ELEMENT_LABELS: Readonly<Record<OverviewElementType, string>> = {
  NUMERIC_LABEL: 'Numeric Label',
  TEXT_LABEL: 'Text Label',
  STATUS_LIGHT: 'Status Light',
  VALUE_BADGE: 'Value Badge',
  PICTURE_BOX: 'Picture Box',
  SWITCH: 'Switch',
  PUSH_BUTTON: 'Push Button',
  NAVIGATION_LINK: 'Navigation Link',
  STATIC_TEXT: 'Static Text',
  RECTANGLE: 'Rectangle',
  PANEL: 'Panel',
  DIVIDER: 'Divider',
  STATIC_IMAGE: 'Static Image',
};

export const OVERVIEW_CATEGORY_TYPES: Readonly<Record<OverviewElementCategory, readonly OverviewElementType[]>> = {
  MONITORING: ['NUMERIC_LABEL', 'TEXT_LABEL', 'STATUS_LIGHT', 'VALUE_BADGE', 'PICTURE_BOX'],
  CONTROL: ['SWITCH', 'PUSH_BUTTON', 'NAVIGATION_LINK'],
  DISPLAY: ['STATIC_TEXT', 'RECTANGLE', 'PANEL', 'DIVIDER', 'STATIC_IMAGE'],
};

export const OVERVIEW_CATEGORY_LABELS: Readonly<Record<OverviewElementCategory, string>> = {
  MONITORING: 'Monitoring',
  CONTROL: 'Controls',
  DISPLAY: 'Display',
};

const DEFAULT_SIZE: Readonly<Record<OverviewElementType, { width: number; height: number }>> = {
  NUMERIC_LABEL: { width: 144, height: 48 },
  TEXT_LABEL: { width: 160, height: 32 },
  STATUS_LIGHT: { width: 48, height: 48 },
  VALUE_BADGE: { width: 128, height: 40 },
  PICTURE_BOX: { width: 160, height: 120 },
  SWITCH: { width: 72, height: 40 },
  PUSH_BUTTON: { width: 128, height: 44 },
  NAVIGATION_LINK: { width: 168, height: 36 },
  STATIC_TEXT: { width: 200, height: 40 },
  RECTANGLE: { width: 200, height: 120 },
  PANEL: { width: 320, height: 240 },
  DIVIDER: { width: 240, height: 4 },
  STATIC_IMAGE: { width: 160, height: 120 },
};

const DEFAULT_STYLE: Readonly<Record<OverviewElementCategory, OverviewElementStyle>> = {
  MONITORING: {
    text: 'Editor Preview',
    fontSize: 16,
    textColor: '#e6eef5',
    backgroundColor: 'rgba(11, 24, 34, 0.72)',
    borderColor: 'rgba(148, 163, 184, 0.35)',
    borderWidth: 1,
    borderRadius: 8,
    opacity: 1,
    alignment: 'left',
  },
  CONTROL: {
    text: 'Control',
    fontSize: 14,
    textColor: '#e6eef5',
    backgroundColor: 'rgba(11, 24, 34, 0.72)',
    borderColor: 'rgba(52, 211, 153, 0.45)',
    borderWidth: 1,
    borderRadius: 8,
    opacity: 1,
    alignment: 'center',
  },
  DISPLAY: {
    text: '',
    fontSize: 14,
    textColor: '#e6eef5',
    backgroundColor: 'rgba(11, 24, 34, 0.45)',
    borderColor: 'rgba(148, 163, 184, 0.35)',
    borderWidth: 1,
    borderRadius: 6,
    opacity: 1,
    alignment: 'left',
  },
};

export function isOverviewElementType(value: string): value is OverviewElementType {
  return Object.prototype.hasOwnProperty.call(OVERVIEW_TYPE_CATEGORY, value);
}

export function overviewTypeCategory(type: OverviewElementType): OverviewElementCategory {
  return OVERVIEW_TYPE_CATEGORY[type];
}

export function overviewTypeDefaultSize(type: OverviewElementType): { width: number; height: number } {
  return { ...DEFAULT_SIZE[type] };
}

export function overviewDefaultBinding(category: OverviewElementCategory): OverviewElementBinding {
  return {
    tagId: '',
    tagName: '',
    dataType: 'Unknown',
    direction: overviewDefaultDirection(category),
    status: 'NOT_BOUND',
  };
}

/** Binding Direction options allowed for a category (O1-C §9). */
export function overviewAllowedDirections(
  category: OverviewElementCategory,
): readonly OverviewBindingDirection[] {
  if (category === 'MONITORING') return ['MONITOR', 'NONE'];
  if (category === 'CONTROL') return ['COMMAND', 'NONE'];
  return ['NONE'];
}

/** Default Direction for a category. */
export function overviewDefaultDirection(category: OverviewElementCategory): OverviewBindingDirection {
  return category === 'MONITORING' ? 'MONITOR' : category === 'CONTROL' ? 'COMMAND' : 'NONE';
}

/**
 * Normalize a Direction to a value valid for the category.
 * Invalid values fall back to the category default — never preserved.
 */
export function normalizeOverviewBindingDirection(
  category: OverviewElementCategory,
  direction: OverviewBindingDirection,
): OverviewBindingDirection {
  const allowed = overviewAllowedDirections(category);
  return allowed.includes(direction) ? direction : overviewDefaultDirection(category);
}

export function overviewDefaultStyle(category: OverviewElementCategory): OverviewElementStyle {
  return { ...DEFAULT_STYLE[category] };
}

function defaultName(type: OverviewElementType, existing: readonly { name: string }[]): string {
  const base = OVERVIEW_ELEMENT_LABELS[type];
  const taken = new Set(existing.map(item => item.name.trim().toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = `${base} ${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${base} ${Date.now()}`;
}

/** Create exactly one Element with contract defaults at a top-left position. */
export function createOverviewElement(
  type: OverviewElementType,
  options: {
    id: string;
    x: number;
    y: number;
    zIndex?: number;
    existing?: readonly { name: string }[];
  },
): OverviewElement {
  const category = overviewTypeCategory(type);
  const size = overviewTypeDefaultSize(type);
  return {
    id: options.id,
    type,
    category,
    name: defaultName(type, options.existing ?? []),
    x: options.x,
    y: options.y,
    width: size.width,
    height: size.height,
    rotation: 0,
    zIndex: options.zIndex ?? 1,
    locked: false,
    visible: true,
    style: overviewDefaultStyle(category),
    binding: overviewDefaultBinding(category),
  };
}

export function snapOverviewCoordinate(value: number, grid = OVERVIEW_ELEMENT_SNAP): number {
  return Math.round(value / grid) * grid;
}

/**
 * Center the complete Element on a flow-space point (not the top-left corner),
 * then snap to the Overview grid.
 */
export function centerOverviewElementPosition(
  flowCenter: { x: number; y: number },
  size: { width: number; height: number },
  grid = OVERVIEW_ELEMENT_SNAP,
): { x: number; y: number } {
  return {
    x: snapOverviewCoordinate(flowCenter.x - size.width / 2, grid),
    y: snapOverviewCoordinate(flowCenter.y - size.height / 2, grid),
  };
}

function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * Deterministic collision nudge: walk the snap grid until free.
 * Existing elements are never moved; no randomness is used.
 * When `bounds` is provided the candidate rectangle is kept fully inside
 * the Design Canvas (expanding ring search over grid cells).
 */
export function nudgeOverviewElementToFreeSlot(
  base: { x: number; y: number },
  size: { width: number; height: number },
  existing: readonly Pick<OverviewElement, 'x' | 'y' | 'width' | 'height'>[],
  grid = OVERVIEW_ELEMENT_SNAP,
  limit = 400,
  bounds?: { width: number; height: number },
): { x: number; y: number } | null {
  const hasBounds = Boolean(bounds);
  const maxX = bounds ? Math.max(0, Math.floor((bounds.width - size.width) / grid) * grid) : Number.POSITIVE_INFINITY;
  const maxY = bounds ? Math.max(0, Math.floor((bounds.height - size.height) / grid) * grid) : Number.POSITIVE_INFINITY;
  const snap = (value: number) => Math.round(value / grid) * grid;
  const clamp = (point: { x: number; y: number }): { x: number; y: number } => {
    if (!hasBounds) return { x: snap(point.x), y: snap(point.y) };
    return {
      x: Math.min(Math.max(0, snap(point.x)), maxX),
      y: Math.min(Math.max(0, snap(point.y)), maxY),
    };
  };
  const free = (point: { x: number; y: number }): boolean =>
    point.x >= 0 &&
    point.y >= 0 &&
    (!hasBounds || (point.x <= maxX && point.y <= maxY)) &&
    !existing.some(other => rectsOverlap({ ...point, ...size }, other));

  const start = clamp(base);
  if (free(start)) return start;

  if (!hasBounds) {
    // Unbounded diagonal walk (legacy behaviour).
    let candidate = { x: start.x, y: start.y };
    for (let i = 0; i < limit; i += 1) {
      candidate = { x: candidate.x + grid, y: candidate.y + grid };
      if (free(candidate)) return candidate;
    }
    // No valid free slot — never fall back to an overlapping position.
    return null;
  }

  // Expanding ring search over grid cells — deterministic, stays in bounds.
  const baseCol = Math.round(start.x / grid);
  const baseRow = Math.round(start.y / grid);
  const maxRing = Math.ceil(Math.max(maxX, maxY) / grid) + 2;
  let visited = 0;
  for (let ring = 0; ring <= maxRing && visited < limit; ring += 1) {
    for (let dr = -ring; dr <= ring && visited < limit; dr += 1) {
      for (let dc = -ring; dc <= ring && visited < limit; dc += 1) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
        const col = baseCol + dc;
        const row = baseRow + dr;
        if (col < 0 || row < 0) continue;
        const candidate = { x: col * grid, y: row * grid };
        if (candidate.x > maxX || candidate.y > maxY) continue;
        visited += 1;
        if (free(candidate)) return candidate;
      }
    }
  }
  return null;
}

/** Layer operations — return a new elements array with updated zIndex values. */
export function overviewBringForward(
  elements: readonly OverviewElement[],
  id: string,
): OverviewElement[] {
  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
  const index = sorted.findIndex(el => el.id === id);
  if (index < 0 || index === sorted.length - 1) return elements.map(el => ({ ...el }));
  const next = [...sorted];
  [next[index], next[index + 1]] = [next[index + 1], next[index]];
  return next.map((el, i) => ({ ...el, zIndex: i + 1 }));
}

export function overviewSendBackward(
  elements: readonly OverviewElement[],
  id: string,
): OverviewElement[] {
  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
  const index = sorted.findIndex(el => el.id === id);
  if (index <= 0) return elements.map(el => ({ ...el }));
  const next = [...sorted];
  [next[index - 1], next[index]] = [next[index], next[index - 1]];
  return next.map((el, i) => ({ ...el, zIndex: i + 1 }));
}

export function overviewBringToFront(
  elements: readonly OverviewElement[],
  id: string,
): OverviewElement[] {
  const target = elements.find(el => el.id === id);
  if (!target) return elements.map(el => ({ ...el }));
  const rest = elements.filter(el => el.id !== id).sort((a, b) => a.zIndex - b.zIndex);
  return [...rest, { ...target }].map((el, i) => ({ ...el, zIndex: i + 1 }));
}

export function overviewSendToBack(
  elements: readonly OverviewElement[],
  id: string,
): OverviewElement[] {
  const target = elements.find(el => el.id === id);
  if (!target) return elements.map(el => ({ ...el }));
  const rest = elements.filter(el => el.id !== id).sort((a, b) => a.zIndex - b.zIndex);
  return [{ ...target }, ...rest].map((el, i) => ({ ...el, zIndex: i + 1 }));
}

/** Duplicate an element with a new id, unique name, and nudged position. */
export function duplicateOverviewElement(
  elements: readonly OverviewElement[],
  id: string,
  newId: string,
): { element: OverviewElement; elements: OverviewElement[] } | null {
  const source = elements.find(el => el.id === id);
  if (!source) return null;
  const size = { width: source.width, height: source.height };
  const base = { x: source.x + OVERVIEW_ELEMENT_SNAP, y: source.y + OVERVIEW_ELEMENT_SNAP };
  const position = nudgeOverviewElementToFreeSlot(
    base,
    size,
    elements.filter(el => el.id !== id),
  );
  if (!position) return null;
  const copy: OverviewElement = {
    ...structuredClone(source),
    id: newId,
    name: defaultName(source.type, elements),
    x: position.x,
    y: position.y,
    zIndex: Math.max(...elements.map(el => el.zIndex), 0) + 1,
    locked: false,
  };
  return { element: copy, elements: [...elements, copy] };
}

/* ---- undo / redo history (draft-only, never calls the Server) ---------- */

export interface OverviewDraftHistory {
  past: OverviewElementSnapshot[];
  future: OverviewElementSnapshot[];
}

export function emptyOverviewHistory(): OverviewDraftHistory {
  return { past: [], future: [] };
}

/** One user action → one history entry. New action invalidates the redo stack. */
export function pushOverviewHistory(
  history: OverviewDraftHistory,
  current: OverviewElementSnapshot,
): OverviewDraftHistory {
  const past = [...history.past, current];
  // Cap history so long sessions stay bounded.
  const trimmed = past.length > 100 ? past.slice(past.length - 100) : past;
  return { past: trimmed, future: [] };
}

export function canUndoOverview(history: OverviewDraftHistory): boolean {
  return history.past.length > 0;
}

export function canRedoOverview(history: OverviewDraftHistory): boolean {
  return history.future.length > 0;
}

export function undoOverviewHistory(
  history: OverviewDraftHistory,
  current: OverviewElementSnapshot,
): { history: OverviewDraftHistory; value: OverviewElementSnapshot } | null {
  if (history.past.length === 0) return null;
  const previous = history.past[history.past.length - 1];
  return {
    history: {
      past: history.past.slice(0, -1),
      future: [current, ...history.future],
    },
    value: previous.map(el => ({ ...el })),
  };
}

export function redoOverviewHistory(
  history: OverviewDraftHistory,
  current: OverviewElementSnapshot,
): { history: OverviewDraftHistory; value: OverviewElementSnapshot } | null {
  if (history.future.length === 0) return null;
  const next = history.future[0];
  return {
    history: {
      past: [...history.past, current],
      future: history.future.slice(1),
    },
    value: next.map(el => ({ ...el })),
  };
}

/* ---- validation before Save ------------------------------------------- */

export function validateOverviewElements(
  page: { id: string; layerOrder: readonly string[] },
  elements: readonly OverviewElement[],
): string[] {
  const errors: string[] = [];
  if (!page.id) errors.push('Page ID is required');

  const ids = new Set<string>();
  for (const el of elements) {
    if (!el.id) {
      errors.push('Element ID is required');
      continue;
    }
    if (ids.has(el.id)) errors.push(`Duplicate Element ID: ${el.id}`);
    ids.add(el.id);

    if (!isOverviewElementType(el.type)) {
      errors.push(`Invalid Element Type: ${String(el.type)}`);
      continue;
    }
    if (overviewTypeCategory(el.type) !== el.category) {
      errors.push(`Element category does not match Type ${el.type}`);
    }
    if (typeof el.name !== 'string' || !el.name.trim()) errors.push(`Element ${el.id}: name is required`);
    if (typeof el.locked !== 'boolean' || typeof el.visible !== 'boolean') errors.push(`Element ${el.id}: locked/visible must be boolean`);
    if (!Number.isFinite(el.width) || el.width <= 0) errors.push(`Element ${el.id}: width must be greater than zero`);
    if (!Number.isFinite(el.height) || el.height <= 0) errors.push(`Element ${el.id}: height must be greater than zero`);
    if (!Number.isFinite(el.x) || !Number.isFinite(el.y)) errors.push(`Element ${el.id}: x/y must be finite`);
    if (!Number.isFinite(el.rotation)) errors.push(`Element ${el.id}: rotation must be finite`);
    if (!Number.isInteger(el.zIndex)) errors.push(`Element ${el.id}: zIndex must be an integer`);
    if (!el.style || typeof el.style !== 'object') {
      errors.push(`Element ${el.id}: style is required`);
    } else {
      if (!Number.isFinite(el.style.fontSize) || el.style.fontSize < 8 || el.style.fontSize > 96) errors.push(`Element ${el.id}: font size must be 8–96`);
      if (!Number.isFinite(el.style.borderWidth) || el.style.borderWidth < 0 || el.style.borderWidth > 12) errors.push(`Element ${el.id}: border width must be 0–12`);
      if (!Number.isFinite(el.style.borderRadius) || el.style.borderRadius < 0 || el.style.borderRadius > 64) errors.push(`Element ${el.id}: border radius must be 0–64`);
      if (!['left', 'center', 'right'].includes(el.style.alignment)) errors.push(`Element ${el.id}: invalid alignment`);
      if (typeof el.style.text !== 'string') errors.push(`Element ${el.id}: text must be a string`);
      for (const color of ['textColor', 'backgroundColor', 'borderColor'] as const) {
        if (typeof el.style[color] !== 'string' || !el.style[color].trim()) errors.push(`Element ${el.id}: ${color} must be a non-empty color`);
      }
      if (!Number.isFinite(el.style.opacity) || el.style.opacity < 0 || el.style.opacity > 1) {
        errors.push(`Element ${el.id}: opacity must be between 0 and 1`);
      }
    }

    for (const error of validateOverviewBinding(el.category, el.binding)) {
      errors.push(`Element ${el.id}: ${error}`);
    }
  }

  const orderIds = new Set<string>();
  for (const id of page.layerOrder) {
    if (!ids.has(id)) errors.push(`Layer order contains unknown ID: ${id}`);
    if (orderIds.has(id)) errors.push(`Layer order contains duplicate ID: ${id}`);
    orderIds.add(id);
  }
  for (const id of ids) {
    if (!orderIds.has(id)) errors.push(`Layer order is missing Element ID: ${id}`);
  }

  return errors;
}

/** Rebuild layerOrder (bottom → top) from element zIndex values. */
export function layerOrderFromElements(elements: readonly OverviewElement[]): string[] {
  return [...elements]
    .sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id))
    .map(el => el.id);
}

/** Normalize rotation into [0, 360). */
export function normalizeOverviewRotation(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const wrapped = value % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/** Clamp opacity into [0, 1]. */
export function clampOverviewOpacity(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}
