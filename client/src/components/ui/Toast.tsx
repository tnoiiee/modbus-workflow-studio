import { useEffect } from 'react';
import { CircleAlert, CircleCheck, X } from 'lucide-react';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  tone: ToastTone;
  text: string;
}

export interface ToastStackProps {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
  /** Auto dismiss delay in milliseconds. */
  duration?: number;
}

const ICONS: Record<ToastTone, typeof CircleCheck> = {
  success: CircleCheck,
  error: CircleAlert,
  info: CircleAlert,
};

function Toast({ toast, onDismiss, duration }: { toast: ToastMessage; onDismiss: (id: number) => void; duration: number }) {
  const Icon = ICONS[toast.tone];
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(timer);
  }, [toast.id, duration, onDismiss]);

  return (
    <div className={`toast toast--${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
      <span className="toast__icon" aria-hidden="true">
        <Icon size={16} />
      </span>
      <span className="toast__text">{toast.text}</span>
      <button type="button" className="btn-icon btn-icon--sm toast__close" aria-label="Dismiss notification" onClick={() => onDismiss(toast.id)}>
        <X size={13} />
      </button>
    </div>
  );
}

/**
 * Non-blocking notification stack used for workflow action feedback instead of
 * `window.alert`. Rendering only: the owner decides what to announce.
 */
export function ToastStack({ toasts, onDismiss, duration = 4200 }: ToastStackProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-stack" aria-label="Notifications">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} duration={duration} />
      ))}
    </div>
  );
}
