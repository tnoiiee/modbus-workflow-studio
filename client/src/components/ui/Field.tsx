import { useId, type KeyboardEvent, type Ref } from 'react';

export interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  /** Called on Enter when the caller considers the current value valid. */
  onSubmit?: () => void;
}

/**
 * Labeled text field with inline validation message. The error text is always
 * rendered as text (never color only) and is announced through `role="alert"`.
 */
export function Field({
  label,
  value,
  onChange,
  error,
  hint,
  maxLength,
  placeholder,
  disabled,
  inputRef,
  onSubmit,
}: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (!error && onSubmit) onSubmit();
  };

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        ref={inputRef}
        className={`field__input${error ? ' field__input--invalid' : ''}`}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={[error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      {error ? (
        <span className="field__message field__message--error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
      {hint && !error ? (
        <span className="field__message" id={hintId}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
