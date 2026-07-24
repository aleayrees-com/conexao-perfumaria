'use client';

import { useState, type ChangeEventHandler, type ReactElement } from 'react';

import { getPasswordVisibilityCopy } from '@/lib/password-visibility';

interface PasswordFieldProps {
  readonly autoComplete: 'current-password' | 'new-password';
  readonly label: string;
  readonly maxLength?: number;
  readonly minLength?: number;
  readonly name: string;
  readonly onChange?: ChangeEventHandler<HTMLInputElement>;
  readonly required?: boolean;
  readonly value?: string;
}

function PasswordEyeIcon({
  isRevealed,
}: {
  readonly isRevealed: boolean;
}): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.7" />
      {isRevealed ? <path d="m4 4 16 16" /> : null}
    </svg>
  );
}

function PasswordVisibilityButton({
  isRevealed,
  onToggle,
}: {
  readonly isRevealed: boolean;
  readonly onToggle: () => void;
}): ReactElement {
  const visibility = getPasswordVisibilityCopy(isRevealed);

  return (
    <button
      aria-label={visibility.label}
      aria-pressed={isRevealed}
      className="admin-password-toggle"
      onClick={onToggle}
      title={visibility.label}
      type="button"
    >
      <PasswordEyeIcon isRevealed={isRevealed} />
    </button>
  );
}

export function PasswordField({
  autoComplete,
  label,
  maxLength,
  minLength,
  name,
  onChange,
  required = false,
  value,
}: PasswordFieldProps): ReactElement {
  const [isRevealed, setIsRevealed] = useState(false);
  const visibility = getPasswordVisibilityCopy(isRevealed);

  return (
    <label className="admin-password-field">
      {label}
      <span className="admin-password-control">
        <input
          autoComplete={autoComplete}
          maxLength={maxLength}
          minLength={minLength}
          name={name}
          onChange={onChange}
          required={required}
          type={visibility.type}
          value={value}
        />
        <PasswordVisibilityButton
          isRevealed={isRevealed}
          onToggle={() => setIsRevealed((current) => !current)}
        />
      </span>
    </label>
  );
}
