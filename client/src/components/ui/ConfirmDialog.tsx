import { useRef, type ReactNode } from 'react';

import { Modal } from './Modal.js';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  /** Extra facts the operator needs before confirming, e.g. node counts. */
  facts?: ReactNode[];
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  pending?: boolean;
  /** Inline API failure. The dialog stays open when this is set. */
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Confirmation dialog replacing `window.confirm` for destructive workflow
 * actions. Cancel never issues a request; a failure keeps the dialog open.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  facts,
  confirmLabel,
  cancelLabel = 'Cancel',
  danger = false,
  pending = false,
  error,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={pending ? () => undefined : onClose}
      tone={danger ? 'danger' : 'default'}
      size="sm"
      initialFocusRef={confirmRef}
      footer={
        <>
          {error ? (
            <span className="modal__error" role="alert">
              {error}
            </span>
          ) : null}
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={pending}>
            {cancelLabel}
          </button>
          <button
            type="button"
            ref={confirmRef}
            className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`}
            onClick={onConfirm}
            disabled={pending}
            aria-busy={pending || undefined}
          >
            {pending ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      {facts && facts.length > 0 ? (
        <ul className="modal__facts">
          {facts.map((fact, index) => (
            <li key={index}>{fact}</li>
          ))}
        </ul>
      ) : null}
    </Modal>
  );
}
