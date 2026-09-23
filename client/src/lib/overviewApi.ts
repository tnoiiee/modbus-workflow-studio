import type { OverviewPageRecord, OverviewPageSummary } from './overviewState.js';

/** JSON API helper for Overview persistence routes. */
export async function overviewApi<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
      signal: init?.signal ?? controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) throw Error(`Request timed out: ${url}`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message =
      typeof body === 'object' && body && 'error' in body
        ? String((body as { error: unknown }).error)
        : `${response.status} ${response.statusText}: ${String(body).slice(0, 160)}`;
    throw Object.assign(new Error(message), {
      status: response.status,
      currentRevision:
        typeof body === 'object' && body && 'currentRevision' in body
          ? (body as { currentRevision?: number }).currentRevision
          : undefined,
    });
  }
  if (!contentType.includes('application/json')) {
    throw Error(`Expected JSON from ${url} but received ${contentType || 'unknown content type'}`);
  }
  return body as T;
}

export function fetchOverviewPages(): Promise<OverviewPageSummary[]> {
  return overviewApi<OverviewPageSummary[]>('/api/overview-pages');
}

export function fetchOverviewPage(id: string): Promise<OverviewPageRecord> {
  return overviewApi<OverviewPageRecord>(`/api/overview-pages/${id}`);
}

export function createOverviewPage(input: {
  name: string;
  description?: string;
  designWidth?: number;
  designHeight?: number;
  backgroundColor?: string;
}): Promise<OverviewPageRecord> {
  return overviewApi<OverviewPageRecord>('/api/overview-pages', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function renameOverviewPage(
  id: string,
  input: { name: string; description?: string },
): Promise<OverviewPageRecord> {
  return overviewApi<OverviewPageRecord>(`/api/overview-pages/${id}/rename`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function duplicateOverviewPage(id: string, name?: string): Promise<OverviewPageRecord> {
  return overviewApi<OverviewPageRecord>(`/api/overview-pages/${id}/duplicate`, {
    method: 'POST',
    body: JSON.stringify(name ? { name } : {}),
  });
}

export function updateOverviewPage(
  id: string,
  expectedRevision: number,
  patch: Record<string, unknown>,
): Promise<OverviewPageRecord> {
  return overviewApi<OverviewPageRecord>(`/api/overview-pages/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...patch, expectedRevision }),
  });
}

export interface OverviewControlState {
  value: boolean;
  updatedAt: string;
}

/**
 * Dedicated View-mode control-state PATCH (partial update).
 * Never sends the full Elements array.
 */
export function patchOverviewElementControlState(
  pageId: string,
  elementId: string,
  expectedRevision: number,
  controlState: OverviewControlState,
): Promise<{ elementId: string; controlState: OverviewControlState; revision: number }> {
  return overviewApi(`/api/overview-pages/${pageId}/elements/${elementId}/control-state`, {
    method: 'PATCH',
    body: JSON.stringify({ expectedRevision, controlState }),
  });
}

export function deleteOverviewPage(id: string): Promise<{ ok: boolean }> {
  return overviewApi<{ ok: boolean }>(`/api/overview-pages/${id}`, { method: 'DELETE' });
}
