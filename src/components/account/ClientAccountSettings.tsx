'use client';

import React, { useEffect, useId, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, MotionConfig, motion, type Variants } from 'motion/react';
import {
  changeAccountPasswordAction,
  updateAccountPreferencesAction,
  type PersonalAccount,
} from '@/app/actions/accountActions';
import { BellIcon, ShieldCheckIcon } from '@/components/client/ClientIcons';
import { NeuAlert, NeuButton, EXTRUDE, CheckCircleIcon, InfoIcon, Spinner } from '@/components/shared/neu';
import { EASE_OUT } from '@/components/shared/neu/motion';

/**
 * Client "Account Settings" page in the neumorphic parchment style used by the other client
 * screens (Dashboard, Consultations, Messages, Documents). Lawyer settings keep the shared
 * AccountSettings component; this one only renders for client accounts. Its building blocks
 * (section card, setting row, switch, password field) are exported for the admin account pages.
 */

export const PAGE: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.04 } },
};
export const RISE_IN: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
};

// ─── Small building blocks ────────────────────────────────────────────────────

export const KeyIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="7.5" cy="15.5" r="4.5" />
    <path d="M10.7 12.3 20 3M16 7l3 3M14 9l2 2" />
  </svg>
);

const EyeIcon = ({ off = false }: { off?: boolean }) => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {off ? (
      <>
        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 10 8 10 8a18.5 18.5 0 01-2.16 3.19M6.6 6.6A18.4 18.4 0 002 12s3 8 10 8a9.7 9.7 0 005.4-1.6" />
        <path d="M14.12 14.12a3 3 0 11-4.24-4.24M2 2l20 20" />
      </>
    ) : (
      <>
        <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

/** Pressed-in track with a raised knob; the track fills caramel when on. */
export function NeuSwitch({
  checked,
  disabled,
  onChange,
  labelledBy,
  describedBy,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange?: (next: boolean) => void;
  labelledBy: string;
  describedBy?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className="relative shrink-0 w-[52px] h-7 rounded-full transition-colors duration-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#C58B3C]"
      style={{
        backgroundColor: checked ? '#D49E56' : '#DCCFC1',
        boxShadow: checked
          ? 'inset 2px 2px 5px rgba(140, 96, 32, 0.45), inset -2px -2px 5px rgba(255, 226, 180, 0.45)'
          : 'inset 2px 2px 5px rgba(176, 156, 136, 0.55), inset -2px -2px 5px rgba(255, 248, 240, 0.8)',
      }}
    >
      <motion.span
        aria-hidden="true"
        initial={false}
        animate={{ x: checked ? 24 : 0 }}
        transition={{ type: 'spring', stiffness: 620, damping: 34 }}
        className="absolute top-1 left-1 size-5 rounded-full bg-[#F1E7DC]"
        style={{ boxShadow: '2px 2px 4px rgba(120, 90, 60, 0.35), -1px -1px 3px rgba(255, 255, 255, 0.85)' }}
      />
    </button>
  );
}

/** Raised section card with an icon bubble, title, subtitle and an optional status slot. */
export function SectionCard({
  icon,
  title,
  subtitle,
  status,
  children,
  labelId,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  status?: React.ReactNode;
  children: React.ReactNode;
  labelId: string;
}) {
  return (
    <motion.section
      variants={EXTRUDE}
      aria-labelledby={labelId}
      className="neu-raised bg-[#E5D8CB] rounded-[24px] sm:rounded-[28px] p-5 sm:p-7 space-y-5"
    >
      <div className="flex items-start gap-3.5">
        <span className="neu-raised-sm size-10 shrink-0 rounded-full flex items-center justify-center text-[#C58B3C]">
          {icon}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 id={labelId} className="font-lora text-base sm:text-[17px] font-bold text-[#341512] leading-tight">
            {title}
          </h2>
          <p className="font-inter text-[11.5px] sm:text-xs text-[#5C4535] mt-1 leading-relaxed">{subtitle}</p>
        </div>
        {status && <div className="shrink-0 pt-1">{status}</div>}
      </div>
      {children}
    </motion.section>
  );
}

export function ComingSoonPill() {
  return (
    <span className="inline-flex items-center h-5 px-2 rounded-full bg-[#D9C9B8] font-inter text-[9.5px] font-bold uppercase tracking-[0.12em] text-[#7D6855] align-middle">
      Coming soon
    </span>
  );
}

export function SettingRow({
  id,
  title,
  description,
  badge,
  control,
}: {
  id: string;
  title: string;
  description: string;
  badge?: React.ReactNode;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 sm:px-5 py-4">
      <div className="min-w-0">
        <p id={`${id}-label`} className="font-inter text-[13px] font-semibold text-[#341512] leading-snug">
          {title} {badge && <span className="ml-1">{badge}</span>}
        </p>
        <p id={`${id}-desc`} className="font-inter text-[11.5px] text-[#7D6855] mt-0.5 leading-relaxed">
          {description}
        </p>
      </div>
      {control}
    </div>
  );
}

export function PasswordField({
  name,
  label,
  autoComplete,
  minLength,
  value,
  onChange,
}: {
  name: string;
  label: string;
  autoComplete: string;
  minLength?: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block font-inter text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#7D6855]">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          required
          minLength={minLength}
          maxLength={256}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="neu-input w-full h-11 rounded-xl pl-4 pr-11 font-inter text-[13px] text-[#341512] disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          className="absolute right-2 top-1/2 -translate-y-1/2 size-8 rounded-lg flex items-center justify-center text-[#7D6855] hover:text-[#C58B3C] transition-colors cursor-pointer"
        >
          <EyeIcon off={visible} />
        </button>
      </div>
    </div>
  );
}

export function Hint({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-inter text-[11px] transition-colors ${ok ? 'text-[#1F7A3A]' : 'text-[#7D6855]'}`}>
      <span
        aria-hidden="true"
        className={`size-3.5 rounded-full flex items-center justify-center transition-colors ${ok ? 'bg-[#1F7A3A] text-white' : 'bg-[#D9C9B8] text-transparent'}`}
      >
        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      {children}
    </span>
  );
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '')).toUpperCase();
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ClientAccountSettings({ account }: { account: PersonalAccount }) {
  const router = useRouter();

  // Notifications (saved immediately; reverted if the save fails)
  const [notifications, setNotifications] = useState(account.consultationNotifications);
  const [saving, startSaving] = useTransition();
  const [preferenceError, setPreferenceError] = useState('');
  const [savedTick, setSavedTick] = useState(0);

  useEffect(() => {
    if (!savedTick) return;
    const t = window.setTimeout(() => setSavedTick(0), 2400);
    return () => window.clearTimeout(t);
  }, [savedTick]);

  const toggleNotifications = (next: boolean) => {
    const previous = notifications;
    setNotifications(next);
    setPreferenceError('');
    setSavedTick(0);
    startSaving(async () => {
      try {
        const result = await updateAccountPreferencesAction({ consultationNotifications: next });
        if (!result.success) {
          setNotifications(previous);
          setPreferenceError(result.error);
          return;
        }
        setSavedTick(Date.now());
        router.refresh();
      } catch {
        setNotifications(previous);
        setPreferenceError('Unable to save preferences. Please try again.');
      }
    });
  };

  // Password
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [changing, startChanging] = useTransition();
  const [passwordError, setPasswordError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const resetPasswordForm = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
    setPasswordError('');
  };

  const submitPassword = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordMessage('');
    startChanging(async () => {
      try {
        const result = await changeAccountPasswordAction({ currentPassword: current, password: next, confirmPassword: confirm });
        if (!result.success) {
          setPasswordError(result.error);
          return;
        }
        resetPasswordForm();
        setPasswordOpen(false);
        setPasswordMessage(result.message);
      } catch {
        setPasswordError('Unable to change your password. Please try again.');
      }
    });
  };

  const saveStatus = (
    <AnimatePresence mode="wait" initial={false}>
      {saving ? (
        <motion.span
          key="saving"
          role="status"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="inline-flex items-center gap-1.5 font-inter text-[11px] font-semibold text-[#7D6855]"
        >
          <Spinner className="w-3.5 h-3.5" /> Saving…
        </motion.span>
      ) : savedTick ? (
        <motion.span
          key="saved"
          role="status"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="inline-flex items-center gap-1.5 font-inter text-[11px] font-semibold text-[#1F7A3A]"
        >
          <CheckCircleIcon className="w-3.5 h-3.5" /> Saved
        </motion.span>
      ) : null}
    </AnimatePresence>
  );

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        variants={PAGE}
        initial="hidden"
        animate="show"
        className="px-8 sm:px-12 lg:px-16 xl:px-20 py-6 sm:py-12 max-w-[1200px] mx-auto space-y-7 sm:space-y-9 bg-[#E5D8CB]"
      >
        {/* ─── Heading ─── */}
        <motion.header variants={RISE_IN} className="space-y-1.5">
          <h1 className="font-lora text-2xl sm:text-3xl lg:text-[36px] font-medium text-[#34150F] tracking-tight leading-[1.2]">
            Account <span className="text-[#C58B3C] font-semibold">Settings</span>
          </h1>
          <p className="font-inter text-[12.5px] sm:text-[13px] text-[#5C4535] max-w-xl leading-relaxed">
            Manage how Justicia notifies you, and keep your sign-in and session secure.
          </p>
        </motion.header>

        <div className="grid grid-cols-1 lg:grid-cols-[290px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
          {/* ─── Left: account summary ─── */}
          <motion.aside
            variants={EXTRUDE}
            aria-label="Account summary"
            className="neu-raised rounded-[24px] sm:rounded-[28px] p-5 sm:p-6 lg:sticky lg:top-6"
            style={{ backgroundColor: 'rgba(211, 151, 88, 0.3)' }}
          >
            <div className="flex lg:flex-col items-center lg:items-start gap-4">
              <span
                aria-hidden="true"
                className="neu-btn-banner size-14 sm:size-16 shrink-0 rounded-full flex items-center justify-center font-lora text-lg sm:text-xl font-bold text-[#341512]"
              >
                {initialsOf(account.fullName)}
              </span>
              <div className="min-w-0">
                <p className="font-lora text-base sm:text-lg font-bold text-[#341512] leading-tight break-words">
                  {account.fullName || 'Your account'}
                </p>
                <p className="font-inter text-[11.5px] sm:text-xs text-[#5C4535] mt-1 break-all">{account.email}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <span className="neu-inset-banner inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full font-inter text-[10.5px] font-bold text-[#5C4535]">
                <span
                  aria-hidden="true"
                  className={`size-1.5 rounded-full ${account.emailVerified ? 'bg-[#1F7A3A]' : 'bg-[#B7791F]'}`}
                />
                {account.emailVerified ? 'Email verified' : 'Email not verified'}
              </span>
              <span className="neu-inset-banner inline-flex items-center h-6 px-2.5 rounded-full font-inter text-[10.5px] font-bold text-[#5C4535]">
                Client account
              </span>
            </div>

            <div className="border-t border-dotted border-[#B8946E]/60 mt-5 pt-4 space-y-3">
              <p className="font-inter text-[11px] leading-relaxed text-[#5C4535]">
                Your name and contact number are managed on your profile.
              </p>
              <Link
                href="/client/profile"
                className="neu-btn-banner w-full h-10 rounded-xl inline-flex items-center justify-center gap-2 font-lora text-xs sm:text-[13px] font-bold text-[#341512]"
              >
                View my profile
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            </div>
          </motion.aside>

          {/* ─── Right: settings sections ─── */}
          <motion.div variants={PAGE} className="space-y-6 sm:space-y-7 min-w-0">
            {/* Notifications */}
            <SectionCard
              labelId="settings-notifications"
              icon={<BellIcon className="w-[18px] h-[18px]" />}
              title="Notifications"
              subtitle="Choose which consultation updates reach you. Changes save automatically."
              status={saveStatus}
            >
              <div className="neu-recessed rounded-[18px] divide-y divide-dotted divide-[#B8946E]/50">
                <SettingRow
                  id="notif-inapp"
                  title="In-app consultation updates"
                  description="Bookings, confirmations, reschedules and meeting links in your notification bell."
                  control={
                    <NeuSwitch
                      checked={notifications}
                      disabled={saving}
                      onChange={toggleNotifications}
                      labelledBy="notif-inapp-label"
                      describedBy="notif-inapp-desc"
                    />
                  }
                />
                <SettingRow
                  id="notif-email"
                  title="Email updates"
                  badge={<ComingSoonPill />}
                  description="Get an email when a consultation is scheduled or changed."
                  control={<NeuSwitch checked={false} disabled labelledBy="notif-email-label" describedBy="notif-email-desc" />}
                />
                <SettingRow
                  id="notif-sms"
                  title="SMS alerts"
                  badge={<ComingSoonPill />}
                  description="Text messages for urgent hearing notices."
                  control={<NeuSwitch checked={false} disabled labelledBy="notif-sms-label" describedBy="notif-sms-desc" />}
                />
              </div>

              <AnimatePresence>
                {preferenceError && (
                  <NeuAlert key="pref-error" tone="error" onDismiss={() => setPreferenceError('')}>
                    {preferenceError}
                  </NeuAlert>
                )}
              </AnimatePresence>

              <p className="flex items-start gap-2 font-inter text-[11px] text-[#7D6855] leading-relaxed">
                <InfoIcon className="w-3.5 h-3.5 mt-px shrink-0 text-[#C58B3C]" />
                Account security and moderation notices are always delivered, whatever you choose here.
              </p>
            </SectionCard>

            {/* Security & Session */}
            <SectionCard
              labelId="settings-security"
              icon={<ShieldCheckIcon className="w-[18px] h-[18px]" />}
              title="Security & Session"
              subtitle="Protect access to your consultations, messages and documents."
            >
              <div className="neu-recessed rounded-[18px] divide-y divide-dotted divide-[#B8946E]/50">
                <SettingRow
                  id="sec-idle"
                  title="Automatic sign-out"
                  description="You're signed out after 30 minutes without activity, so an unattended device doesn't expose your case details."
                  control={
                    <span className="neu-raised-pill bg-[#E5D8CB] shrink-0 inline-flex items-center gap-1.5 h-7 px-3 rounded-full font-inter text-[11px] font-bold text-[#1F7A3A]">
                      <span className="relative flex size-2" aria-hidden="true">
                        <span className="absolute inset-0 rounded-full bg-[#27AE60] neu-beacon" />
                        <span className="relative size-2 rounded-full bg-[#27AE60]" />
                      </span>
                      Active
                    </span>
                  }
                />

                <div>
                  <SettingRow
                    id="sec-password"
                    title="Password"
                    description="Use 8 or more characters. You'll confirm your current password first."
                    control={
                      <AnimatePresence initial={false}>
                        {!passwordOpen && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.16 }}
                            className="shrink-0"
                          >
                            <NeuButton
                              size="sm"
                              variant="secondary"
                              icon={<KeyIcon className="w-3.5 h-3.5" />}
                              aria-expanded={passwordOpen}
                              aria-controls="password-form"
                              onClick={() => {
                                setPasswordOpen(true);
                                setPasswordMessage('');
                              }}
                            >
                              Change
                            </NeuButton>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    }
                  />

                  <AnimatePresence initial={false}>
                    {passwordOpen && (
                      <motion.div
                        key="password-form"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.32, ease: EASE_OUT }}
                        className="overflow-hidden"
                      >
                        <form id="password-form" onSubmit={submitPassword} className="px-4 sm:px-5 pb-5 pt-1 space-y-4">
                          <fieldset disabled={changing} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2 sm:max-w-[calc(50%-0.5rem)]">
                              <PasswordField
                                name="currentPassword"
                                label="Current password"
                                autoComplete="current-password"
                                value={current}
                                onChange={setCurrent}
                              />
                            </div>
                            <PasswordField
                              name="password"
                              label="New password"
                              autoComplete="new-password"
                              minLength={8}
                              value={next}
                              onChange={setNext}
                            />
                            <PasswordField
                              name="confirmPassword"
                              label="Confirm new password"
                              autoComplete="new-password"
                              minLength={8}
                              value={confirm}
                              onChange={setConfirm}
                            />
                          </fieldset>

                          <div className="flex flex-wrap gap-x-4 gap-y-1.5" aria-live="polite">
                            <Hint ok={next.length >= 8}>At least 8 characters</Hint>
                            <Hint ok={next.length > 0 && next === confirm}>Passwords match</Hint>
                            <Hint ok={next.length > 0 && next !== current}>Different from current</Hint>
                          </div>

                          <AnimatePresence>
                            {passwordError && (
                              <NeuAlert key="pw-error" tone="error" onDismiss={() => setPasswordError('')}>
                                {passwordError}
                              </NeuAlert>
                            )}
                          </AnimatePresence>

                          <div className="flex flex-wrap items-center gap-3 pt-1">
                            <NeuButton type="submit" variant="primary" size="sm" loading={changing}>
                              {changing ? 'Updating…' : 'Update password'}
                            </NeuButton>
                            <NeuButton
                              size="sm"
                              variant="secondary"
                              disabled={changing}
                              onClick={() => {
                                resetPasswordForm();
                                setPasswordOpen(false);
                              }}
                            >
                              Cancel
                            </NeuButton>
                            <Link
                              href="/forgot-password"
                              className="ml-auto font-inter text-[12px] font-semibold text-[#946525] underline underline-offset-2 hover:text-[#C58B3C] transition-colors"
                            >
                              Forgot password?
                            </Link>
                          </div>
                        </form>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <AnimatePresence>
                {passwordMessage && (
                  <NeuAlert key="pw-ok" tone="success" onDismiss={() => setPasswordMessage('')}>
                    {passwordMessage}
                  </NeuAlert>
                )}
              </AnimatePresence>
            </SectionCard>
          </motion.div>
        </div>
      </motion.div>
    </MotionConfig>
  );
}

export default ClientAccountSettings;
