import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OverviewCommandBar, type OverviewCommandBarProps } from './OverviewCommandBar.js';
const noop = () => {};
const props: OverviewCommandBarProps = {
  pages: [{ id: 'p', name: 'Page' }], activePageId: 'p', mode: 'VIEW', saveState: 'SAVED', revision: 7,
  canDeletePage: false, canUndo: false, canRedo: false, hasSelection: false,
  onSelectPage: noop, onNewPage: noop, onRenamePage: noop, onDuplicatePage: noop, onDeletePage: noop,
  onEdit: noop, onSaveAndExit: noop, onCancelChanges: noop, onUndo: noop, onRedo: noop,
  onFitView: noop, onZoomIn: noop, onZoomOut: noop, onLockSelected: noop, onUnlockSelected: noop, onDeleteSelected: noop,
};
describe('Operational View command bar', () => {
  it.each(['SAVED', 'UNSAVED', 'SAVING', 'ERROR', 'CONFLICT'] as const)('does not render save group or revision for %s', saveState => {
    const html = renderToStaticMarkup(<OverviewCommandBar {...props} saveState={saveState} />);
    expect(html).not.toContain('SAVE STATUS');
    expect(html).not.toContain('save-status');
    expect(html).not.toContain('Overview page revision');
    expect(html).not.toContain('CHANGES PENDING');
    expect(html).toContain('Overview mode: VIEW');
  });
  it('retains save status and revision in Edit', () => {
    const html = renderToStaticMarkup(<OverviewCommandBar {...props} mode="EDIT" />);
    expect(html).toContain('SAVE STATUS');
    expect(html).toContain('Overview page revision 7');
    expect(html).toContain('EDIT ACTIONS');
  });
});
