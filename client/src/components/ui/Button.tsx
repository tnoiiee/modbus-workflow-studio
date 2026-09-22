import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  /** Renders a busy state and blocks repeated activation. */
  pending?: boolean;
  block?: boolean;
}

function classes(list: Array<string | false | undefined>) {
  return list.filter((value): value is string => Boolean(value)).join(' ');
}

/**
 * Shared button primitive (v1.2.12 design system).
 *
 * Visual only: it renders a native `button` and forwards every handler, so
 * existing click behavior is unchanged when it replaces a plain button.
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  pending = false,
  block = false,
  className,
  children,
  type = 'button',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classes(['btn', `btn--${variant}`, size === 'sm' && 'btn--sm', block && 'btn--block', className])}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...rest}
    >
      {icon ? (
        <span className="btn__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}
