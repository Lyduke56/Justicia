'use client';

/**
 * Shared building blocks for the authentication screens (sign in, sign up, forgot / reset
 * password), in the portal's neumorphic style: recessed parchment fields with a leading icon,
 * Lora labels, Inter values, inline errors, and a tactile submit button.
 *
 * Fields stay plain <input>s with real names and autocomplete tokens so browser autofill and
 * password managers work; autofilled values keep the field's look (see .neu-input autofill rules
 * in globals.css).
 */
import React, { useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { NeuAlert, type NeuAlertTone } from '@/components/shared/neu';

// ─── Icons ────────────────────────────────────────────────────────────────────

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function MailIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg {...iconProps} className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

export function LockIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg {...iconProps} className={className}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function PersonIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg {...iconProps} className={className}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c0-3.7 3.1-6.3 7-6.3s7 2.6 7 6.3" />
    </svg>
  );
}

export function EyeIcon({ open, className = 'w-4 h-4' }: { open: boolean; className?: string }) {
  return open ? (
    <svg {...iconProps} className={className}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg {...iconProps} className={className}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/** Larger icons for the raised tile at the top of an auth panel. */
export function AuthPanelHeaderIcon({ kind, className = 'w-6 h-6' }: { kind: 'key' | 'signin' | 'mail' | 'shield'; className?: string }) {
  const p = { ...iconProps, className, strokeWidth: 1.7 };
  switch (kind) {
    case 'key':
      return (
        <svg {...p}>
          <circle cx="8" cy="15" r="4" />
          <path d="m10.85 12.15 8.65-8.65M17 6l2.5 2.5M14.5 8.5 17 11" />
        </svg>
      );
    case 'mail':
      return (
        <svg {...p}>
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...p}>
          <path d="M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6l-7-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
          <path d="M10 16l4-4-4-4M14 12H4" />
        </svg>
      );
  }
}

function ErrorGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.75 4a.75.75 0 0 1 1.5 0v3a.75.75 0 0 1-1.5 0V5zm.75 6.5a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75z" />
    </svg>
  );
}

// ─── Fields ───────────────────────────────────────────────────────────────────

export const authLabelClass = 'block font-lora text-[13px] font-semibold text-[#4A3426] select-none';

function fieldClass(hasError: boolean, withIcon: boolean, withTrailing: boolean) {
  return `neu-input w-full h-11 sm:h-12 rounded-[13px] ${withIcon ? 'pl-11' : 'pl-4'} ${withTrailing ? 'pr-12' : 'pr-4'} font-inter text-[14px] text-[#34150F] transition-shadow duration-200 ${
    hasError ? 'neu-input-error' : ''
  }`;
}

export function AuthFieldError({ id, message }: { id?: string; message?: string | null }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.p
          key={message}
          id={id}
          initial={{ opacity: 0, y: -4, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          transition={{ duration: 0.2 }}
          className="flex items-start gap-1.5 pt-1.5 font-inter text-[11.5px] font-medium leading-snug text-[#B42318]"
          role="alert"
        >
          <span className="mt-px">
            <ErrorGlyph />
          </span>
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export interface AuthFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  error?: string | null;
  /** Shown on the right of the label row (e.g. "Forgot password?"). */
  labelAside?: React.ReactNode;
  /** Inside the field, on the right (e.g. the show-password toggle). */
  trailing?: React.ReactNode;
  /** Under the field when there is no error. */
  hint?: React.ReactNode;
  inputRef?: React.Ref<HTMLInputElement>;
}

export function AuthField({ id, label, icon, error, labelAside, trailing, hint, inputRef, ...input }: AuthFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div>
      <div className="mb-1.5 flex items-end justify-between gap-3 pl-0.5">
        <label htmlFor={id} className={authLabelClass}>
          {label}
        </label>
        {labelAside}
      </div>
      <div className="group relative">
        {icon && (
          <span className="pointer-events-none absolute left-4 top-1/2 z-[1] -translate-y-1/2 text-[#9A8270] transition-colors group-focus-within:text-[#C58B3C]">
            {icon}
          </span>
        )}
        <input
          id={id}
          ref={inputRef}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={fieldClass(!!error, !!icon, !!trailing)}
          {...input}
        />
        {trailing && <span className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</span>}
      </div>
      <AuthFieldError id={errorId} message={error} />
      {!error && hint && (
        <div id={hintId} className="pt-1.5">
          {hint}
        </div>
      )}
    </div>
  );
}

/** Password strength, 0–4 (length, capital, number, symbol). */
export function passwordStrength(pw: string): number {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  return score;
}

const STRENGTH = [
  { label: 'Weak', color: '#B42318' },
  { label: 'Fair', color: '#C2410C' },
  { label: 'Good', color: '#B7791F' },
  { label: 'Strong', color: '#1F7A3A' },
];

/** Four-segment meter with the requirements it checks. */
export function PasswordStrengthMeter({ value, showRules = false }: { value: string; showRules?: boolean }) {
  const score = passwordStrength(value);
  const rules = [
    { ok: value.length >= 8, text: '8+ characters' },
    { ok: /[A-Z]/.test(value), text: 'A capital letter' },
    { ok: /[0-9]/.test(value), text: 'A number' },
    { ok: /[^a-zA-Z0-9]/.test(value), text: 'A symbol' },
  ];
  if (!value && !showRules) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2.5">
        <div className="flex flex-1 gap-1" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="h-1.5 flex-1 rounded-full transition-colors duration-300"
              style={{ background: i < score ? STRENGTH[score - 1].color : 'rgba(154, 130, 112, 0.25)' }}
            />
          ))}
        </div>
        <span
          className="w-12 shrink-0 text-right font-inter text-[10.5px] font-semibold"
          style={{ color: score ? STRENGTH[score - 1].color : '#9A8270' }}
          aria-live="polite"
        >
          {score ? STRENGTH[score - 1].label : ''}
        </span>
      </div>
      {showRules && (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
          {rules.map((r) => (
            <li
              key={r.text}
              className={`flex items-center gap-1.5 font-inter text-[11px] transition-colors ${r.ok ? 'text-[#1F7A3A]' : 'text-[#7A6756]'}`}
            >
              <span
                aria-hidden="true"
                className={`grid size-3.5 place-items-center rounded-full text-[8px] leading-none transition-colors ${
                  r.ok ? 'bg-[#1F7A3A] text-white' : 'border border-[#B9A48F]'
                }`}
              >
                {r.ok ? '✓' : ''}
              </span>
              {r.text}
              <span className="sr-only">{r.ok ? '(met)' : '(not met)'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface PasswordFieldProps extends Omit<AuthFieldProps, 'type' | 'trailing' | 'icon'> {
  /** Show the strength meter under the field (sign up / new password). */
  meter?: boolean;
  /** Also list the rules the meter checks. */
  rules?: boolean;
}

/** Password input with a show / hide toggle and, optionally, the strength meter. */
export function PasswordField({ meter = false, rules = false, onChange, value, defaultValue, ...field }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const [typed, setTyped] = useState(typeof defaultValue === 'string' ? defaultValue : '');
  const reduce = useReducedMotion();
  const current = typeof value === 'string' ? value : typed;
  return (
    <AuthField
      {...field}
      value={value}
      defaultValue={defaultValue}
      type={visible ? 'text' : 'password'}
      icon={<LockIcon />}
      onChange={(e) => {
        setTyped(e.target.value);
        onChange?.(e);
      }}
      trailing={
        <motion.button
          type="button"
          onClick={() => setVisible((v) => !v)}
          whileHover={reduce ? undefined : { scale: 1.12 }}
          whileTap={reduce ? undefined : { scale: 0.88 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          className="grid size-8 place-items-center rounded-lg text-[#7A604D] transition-colors hover:text-[#34150F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58B3C]/60 cursor-pointer"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={visible ? 'open' : 'closed'}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.12 }}
              className="block"
            >
              <EyeIcon open={visible} />
            </motion.span>
          </AnimatePresence>
        </motion.button>
      }
      hint={meter ? <PasswordStrengthMeter value={current} showRules={rules} /> : field.hint}
    />
  );
}

// ─── Feedback & actions ───────────────────────────────────────────────────────

export function AuthAlert({ tone = 'error', title, children }: { tone?: NeuAlertTone; title?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <NeuAlert tone={tone} title={title}>
      {children}
    </NeuAlert>
  );
}

export interface AuthSubmitButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart'> {
  pending?: boolean;
  pendingLabel?: string;
}

/**
 * The primary action on auth screens. Lifts on hover, presses in on click, shows a focus ring
 * for keyboard users, dims when disabled, and swaps to a spinner + label while processing
 * (clicks are ignored until the request answers).
 */
export function AuthSubmitButton({
  pending = false,
  pendingLabel = 'Please wait…',
  disabled,
  children,
  className = '',
  type = 'submit',
  ...rest
}: AuthSubmitButtonProps) {
  const reduce = useReducedMotion();
  const inactive = disabled || pending;
  const id = useId();
  return (
    <motion.button
      type={type}
      disabled={inactive}
      aria-busy={pending || undefined}
      aria-describedby={pending ? id : undefined}
      whileHover={reduce || inactive ? undefined : { y: -2, scale: 1.01 }}
      whileTap={reduce || inactive ? undefined : { y: 1, scale: 0.975 }}
      transition={{ type: 'spring', stiffness: 520, damping: 28 }}
      className={`neu-btn-create relative inline-flex h-12 w-full items-center justify-center overflow-hidden rounded-[14px] px-6 font-inter text-[12.5px] font-semibold uppercase tracking-[0.16em] text-[#F3E6D6] cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58B3C]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#E5D8CB] disabled:cursor-not-allowed ${
        pending ? '' : 'disabled:opacity-55'
      } ${className}`}
      {...rest}
    >
      {/* A slow light sweep while processing, so a long request still looks alive. */}
      {pending && !reduce && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent"
          initial={{ x: '-150%' }}
          animate={{ x: '350%' }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <AnimatePresence mode="wait" initial={false}>
        {pending ? (
          <motion.span
            key="pending"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="relative flex items-center justify-center gap-2.5"
          >
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <span id={id}>{pendingLabel}</span>
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="relative flex items-center justify-center gap-2"
          >
            {children}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/** "Text link" style used under auth forms (Sign up, Back to sign in …). */
export const authLinkClass =
  'font-semibold text-[#99431E] underline decoration-[#99431E]/35 underline-offset-[3px] transition-colors hover:text-[#34150F] hover:decoration-[#34150F]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58B3C]/60 rounded-sm cursor-pointer';
