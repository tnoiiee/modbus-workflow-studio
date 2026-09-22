import { Copy, Pencil, Plus, Trash2 } from 'lucide-react';

import { IconButton } from '../ui/IconButton.js';
import { OVERVIEW_SCAFFOLD_BADGE, type OverviewScaffoldPage } from '../../lib/overviewState.js';

export interface OverviewPageBarProps {
  pages: readonly OverviewScaffoldPage[];
  activePageId: string;
  onSelectPage: (pageId: string) => void;
  onNewPage: () => void;
  onRenamePage: () => void;
  onDuplicatePage: () => void;
  onDeletePage: () => void;
}

/**
 * Overview Page Bar: page selector plus New / Rename / Duplicate / Delete.
 *
 * In O1-A every CRUD action is disabled with the "Available in O1-B" tooltip;
 * the selector reads the local scaffold list only. "Edit" is deliberately
 * absent — that word belongs to the canvas mode, not page management.
 */
export function OverviewPageBar({
  pages,
  activePageId,
  onSelectPage,
  onNewPage,
  onRenamePage,
  onDuplicatePage,
  onDeletePage,
}: OverviewPageBarProps) {
  return (
    <div className="command-bar overview-page-bar" aria-label="Overview Page Bar">
      <div className="command-group">
        <span className="command-group__label">Page</span>
        <div className="command-group__controls">
          <select
            className="workflow-selector overview-page-select"
            aria-label="Overview page"
            value={activePageId}
            onChange={(event) => onSelectPage(event.target.value)}
          >
            {pages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.name}
              </option>
            ))}
          </select>
          <IconButton
            label="New page"
            tooltip="Available in O1-B"
            icon={<Plus size={15} />}
            disabled
            onClick={onNewPage}
          />
          <IconButton
            label="Rename page"
            tooltip="Available in O1-B"
            icon={<Pencil size={15} />}
            disabled
            onClick={onRenamePage}
          />
          <IconButton
            label="Duplicate page"
            tooltip="Available in O1-B"
            icon={<Copy size={15} />}
            disabled
            onClick={onDuplicatePage}
          />
          <span className="command-divider command-divider--danger" aria-hidden="true" />
          <IconButton
            label="Delete page"
            tooltip="Available in O1-B"
            variant="danger"
            icon={<Trash2 size={15} />}
            disabled
            onClick={onDeletePage}
          />
          <span className="pill pill--warning" title="Local editor scaffold list — not persisted production data">
            {OVERVIEW_SCAFFOLD_BADGE}
          </span>
        </div>
      </div>
    </div>
  );
}
