'use client';

import React, { useId, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, MotionConfig, motion, type Variants } from 'motion/react';
import {
  changeAccountPasswordAction,
  type PersonalAccount,
} from '@/app/actions/accountActions';
import { BellIcon, DocumentTextIcon, MessagesIcon, ShieldCheckIcon } from '@/components/client/ClientIcons';
import { NeuAlert, NeuButton, EXTRUDE, CheckCircleIcon, InfoIcon, Spinner } from '@/components/shared/neu';
import { EASE_OUT } from '@/components/shared/neu/motion';
import { ResendVerificationButton } from '@/components/auth/ResendVerificationButton';
import { LEGAL_DOCUMENTS } from '@/lib/legal';
import { SignOutConfirmModal } from '@/components/shared/SignOutConfirmModal';
import { ProfilePhoto } from '@/components/shared/ProfilePhoto';
import { useMyAvatar } from './avatarStore';
import {
  NOTIFICATION_ROWS,
  PRIVACY_ROWS,
  formatConsentDate,
  downloadMyData,
  useConsent,
  useDeleteAccount,
  usePreferenceToggles,
} from './useAccountControls';
import { SubmissionOverlay, useSubmission, type SubmissionCopy, type SubmissionResult } from '@/components/shared/feedback';
import { useScreenReveal } from '@/components/shared/loading';

/**
 * "Account Settings" page for clients and lawyers, in the neumorphic parchment style used across
 * both portals (Dashboard, Consultations, Messages, Documents). Lawyers get their own account
 * label, profile link and deletion note; everything else is shared. Its building blocks (section
 * card, setting row, switch, password field) are exported for the profile and admin account pages.
 */

export const PAGE: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.04 } },
};
export const RISE_IN: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
};

/**
 * Page container for Settings / My Profile, with the same margins and width as the other screens
 * of each portal: the client Dashboard / Consultations container, or the lawyer Dashboard /
 * Consultations one. (Only the spacing is copied; .lawyer-page would also change the font.)
 */
export function accountPageClass(role: PersonalAccount['role']): string {
  return role === 'lawyer'
    ? 'mx-auto max-w-[1196px] px-4 pb-14 pt-6 sm:px-8 sm:pt-10 lg:px-12 lg:pt-12 space-y-7 sm:space-y-8 bg-[#E5D8CB]'
    : 'px-8 sm:px-12 lg:px-16 xl:px-20 py-6 sm:py-12 max-w-[1300px] mx-auto space-y-7 sm:space-y-8 bg-[#E5D8CB]';
}

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
  const myAvatar = useMyAvatar();
  const isLawyer = account.role === 'lawyer';
  const profileHref = isLawyer ? '/lawyer/account' : '/client/profile';
  // Notification categories and messaging privacy (saved immediately; reverted if the save fails)
  const prefs = usePreferenceToggles(account);
  const { saving, savedTick } = prefs;
  const preferenceError = prefs.error;
  const setPreferenceError = prefs.setError;
  const [signOutAllOpen, setSignOutAllOpen] = useState(false);
  const consent = useConsent();
  const deletion = useDeleteAccount();
  // The entrance plays when the portal's loading screen lifts (not underneath it).
  const { revealed } = useScreenReveal();

  // Password, terms, data export and deletion show the submission card: loader, then check / X.
  const submission = useSubmission();
  const [card, setCard] = useState<{ kind: 'password' | 'consent' | 'export' | 'delete'; processing: SubmissionCopy; success: SubmissionCopy & { actionLabel?: string }; failure: string }>({
    kind: 'password',
    processing: { title: 'Saving…' },
    success: { title: 'Saved' },
    failure: 'Something went wrong',
  });
  const runWithCard = (next: typeof card, task: () => Promise<SubmissionResult>) => {
    setCard(next);
    return submission.run(task);
  };
  const exportPending = submission.processing && card.kind === 'export';
  const consentPending = submission.processing && card.kind === 'consent';
  const deletePending = submission.processing && card.kind === 'delete';

  // Password
  const [passwordOpen, setPasswordOpen] = useState(false);
  const changing = submission.processing && card.kind === 'password';
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
    void runWithCard(
      {
        kind: 'password',
        processing: { title: 'Updating your password', message: 'Checking your current password and saving the new one.' },
        success: { title: 'Password updated', message: 'Use your new password the next time you sign in.' },
        failure: "We couldn't update your password",
      },
      async () => {
        try {
          const result = await changeAccountPasswordAction({ currentPassword: current, password: next, confirmPassword: confirm });
          if (!result.success) {
            setPasswordError(result.error);
            return { ok: false, error: result.error };
          }
          resetPasswordForm();
          setPasswordOpen(false);
          return { ok: true };
        } catch {
          setPasswordError('Unable to change your password. Please try again.');
          return { ok: false, error: 'Unable to change your password. Please try again.' };
        }
      }
    );
  };

  const acceptTerms = () =>
    void runWithCard(
      {
        kind: 'consent',
        processing: { title: 'Saving your acceptance', message: 'Recording that you accepted the current terms and policies.' },
        success: { title: 'Terms accepted', message: 'Thank you. You have accepted the current versions.' },
        failure: "We couldn't save your acceptance",
      },
      consent.acceptAndReport
    );

  const exportData = () =>
    void runWithCard(
      {
        kind: 'export',
        processing: { title: 'Preparing your data', message: 'Gathering your profile, consultations, messages, payments and reviews.' },
        success: { title: 'Your data is downloaded', message: 'Check your downloads for the JSON file.' },
        failure: "We couldn't export your data",
      },
      downloadMyData
    );

  const deleteAccount = () =>
    void runWithCard(
      {
        kind: 'delete',
        processing: { title: 'Deleting your account', message: 'Signing you out on every device.' },
        success: {
          title: 'Your account is scheduled for deletion',
          message: 'Your personal data is erased in 7 days. Sign in before then to restore it.',
          actionLabel: 'Continue',
        },
        failure: "We couldn't delete your account",
      },
      deletion.request
    );

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
        animate={revealed ? 'show' : 'hidden'}
        className={accountPageClass(account.role)}
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
                className="neu-btn-banner size-14 sm:size-16 shrink-0 overflow-hidden rounded-full flex items-center justify-center font-lora text-lg sm:text-xl font-bold text-[#341512]"
              >
                {myAvatar ? <ProfilePhoto src={myAvatar} className="size-full" fallback={initialsOf(account.fullName)} /> : initialsOf(account.fullName)}
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
                {isLawyer ? 'Lawyer account' : 'Client account'}
              </span>
            </div>

            <div className="border-t border-dotted border-[#B8946E]/60 mt-5 pt-4 space-y-3">
              <p className="font-inter text-[11px] leading-relaxed text-[#5C4535]">
                Your name and contact number are managed on your profile.
              </p>
              <Link
                href={profileHref}
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
                {NOTIFICATION_ROWS.map((row) => (
                  <SettingRow
                    key={row.key}
                    id={`notif-${row.key}`}
                    title={row.title}
                    description={row.description}
                    control={
                      <NeuSwitch
                        checked={prefs.notifications[row.key]}
                        disabled={saving}
                        onChange={(next) => prefs.toggleNotification(row.key, next)}
                        labelledBy={`notif-${row.key}-label`}
                        describedBy={`notif-${row.key}-desc`}
                      />
                    }
                  />
                ))}
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

            {/* Messaging privacy */}
            <SectionCard
              labelId="settings-messaging"
              icon={<MessagesIcon className="w-[18px] h-[18px]" />}
              title="Messaging Privacy"
              subtitle="Choose what the other person sees while you chat."
            >
              <div className="neu-recessed rounded-[18px] divide-y divide-dotted divide-[#B8946E]/50">
                {PRIVACY_ROWS.map((row) => (
                  <SettingRow
                    key={row.key}
                    id={`privacy-${row.key}`}
                    title={row.title}
                    description={row.description}
                    control={
                      <NeuSwitch
                        checked={prefs.messaging[row.key]}
                        disabled={saving}
                        onChange={(next) => prefs.toggleMessaging(row.key, next)}
                        labelledBy={`privacy-${row.key}-label`}
                        describedBy={`privacy-${row.key}-desc`}
                      />
                    }
                  />
                ))}
              </div>
            </SectionCard>

            {/* Security & Session */}
            <SectionCard
              labelId="settings-security"
              icon={<ShieldCheckIcon className="w-[18px] h-[18px]" />}
              title="Security & Session"
              subtitle="Protect access to your consultations, messages and documents."
            >
              <div className="neu-recessed rounded-[18px] divide-y divide-dotted divide-[#B8946E]/50">
                {!account.emailVerified && (
                  <SettingRow
                    id="sec-verify"
                    title="Verify your email"
                    description={`We'll send a new confirmation link to ${account.email}.`}
                    control={
                      <ResendVerificationButton
                        label="Resend link"
                        className="neu-raised-pill bg-[#E5D8CB] shrink-0 inline-flex items-center h-8 px-3.5 rounded-full font-lora text-[12px] font-bold text-[#341512] hover:text-[#A8742E] transition-colors cursor-pointer disabled:opacity-60"
                        messageClassName="font-inter text-[11px] text-[#7D6855] max-w-[200px]"
                      />
                    }
                  />
                )}
                <SettingRow
                  id="sec-everywhere"
                  title="Sign out everywhere"
                  description="Ends your session on every device and browser, including this one. Use it if you signed in on a shared or lost device."
                  control={
                    <NeuButton size="sm" variant="secondary" onClick={() => setSignOutAllOpen(true)}>
                      Sign out all
                    </NeuButton>
                  }
                />
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
                            <NeuButton type="submit" variant="primary" size="sm" disabled={changing}>
                              Update password
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

            {/* Privacy & your data */}
            <SectionCard
              labelId="settings-data"
              icon={<DocumentTextIcon className="w-[18px] h-[18px]" />}
              title="Privacy & Your Data"
              subtitle="Your rights under the Data Privacy Act (RA 10173): see what you agreed to, get a copy of your data, or delete your account."
            >
              <div className="neu-recessed rounded-[18px] divide-y divide-dotted divide-[#B8946E]/50">
                <SettingRow
                  id="data-legal"
                  title="Terms and policies"
                  description={
                    consent.consent?.current && consent.consent.acceptedAt
                      ? `You accepted the current versions on ${formatConsentDate(consent.consent.acceptedAt)}.`
                      : 'Please review and accept the current versions.'
                  }
                  control={
                    consent.consent && !consent.consent.current ? (
                      <NeuButton size="sm" variant="secondary" disabled={consentPending} onClick={acceptTerms}>
                        Accept
                      </NeuButton>
                    ) : null
                  }
                />
                <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 sm:px-5 py-3">
                  {LEGAL_DOCUMENTS.map((doc) => (
                    <Link
                      key={doc.href}
                      href={doc.href}
                      target="_blank"
                      className="font-inter text-[12px] font-semibold text-[#946525] underline underline-offset-2 hover:text-[#C58B3C] transition-colors"
                    >
                      {doc.title}
                    </Link>
                  ))}
                </div>
                <SettingRow
                  id="data-export"
                  title="Download my data"
                  description="A JSON file with your profile, consultations, messages, payments and reviews. Once a day."
                  control={
                    <NeuButton size="sm" variant="secondary" disabled={exportPending} onClick={exportData}>
                      Download
                    </NeuButton>
                  }
                />
                <div>
                  <SettingRow
                    id="data-delete"
                    title="Delete my account"
                    description="Your personal data is erased after 7 days. Sign in before then to undo it."
                    control={
                      !deletion.open ? (
                        <NeuButton size="sm" variant="danger" onClick={() => deletion.setOpen(true)}>
                          Delete
                        </NeuButton>
                      ) : null
                    }
                  />
                  <AnimatePresence initial={false}>
                    {deletion.open && (
                      <motion.div
                        key="delete-form"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.32, ease: EASE_OUT }}
                        className="overflow-hidden"
                      >
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (deletion.ready) deleteAccount();
                          }}
                          className="px-4 sm:px-5 pb-5 pt-1 space-y-4"
                        >
                          <p className="font-inter text-[12px] leading-relaxed text-[#5C4535]">
                            You can’t delete your account while you have upcoming consultations. After you confirm, you are signed out on
                            every device, and your account is removed in 7 days unless you sign in and restore it.
                            {isLawyer && ' Your profile leaves Find a Lawyer immediately.'}
                          </p>
                          <fieldset disabled={deletePending} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <PasswordField
                              name="deletePassword"
                              label="Your password"
                              autoComplete="current-password"
                              value={deletion.password}
                              onChange={deletion.setPassword}
                            />
                            <div className="space-y-1.5">
                              <label htmlFor="delete-confirm" className="block font-inter text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#7D6855]">
                                Type DELETE to confirm
                              </label>
                              <input
                                id="delete-confirm"
                                value={deletion.confirmation}
                                onChange={(e) => deletion.setConfirmation(e.target.value)}
                                autoComplete="off"
                                className="neu-input w-full h-11 rounded-xl px-4 font-inter text-[13px] text-[#341512] disabled:opacity-60"
                              />
                            </div>
                          </fieldset>
                          <AnimatePresence>
                            {deletion.error && (
                              <NeuAlert key="delete-error" tone="error">
                                {deletion.error}
                              </NeuAlert>
                            )}
                          </AnimatePresence>
                          <div className="flex flex-wrap items-center gap-3 pt-1">
                            <NeuButton type="submit" variant="danger" size="sm" disabled={!deletion.ready || deletePending}>
                              Delete my account
                            </NeuButton>
                            <NeuButton size="sm" variant="secondary" disabled={deletePending} onClick={deletion.reset}>
                              Cancel
                            </NeuButton>
                          </div>
                        </form>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

            </SectionCard>
          </motion.div>
        </div>
      </motion.div>
      <SignOutConfirmModal open={signOutAllOpen} onClose={() => setSignOutAllOpen(false)} everywhere />
      <SubmissionOverlay
        submission={submission}
        processing={card.processing}
        success={card.success}
        failure={{ title: card.failure }}
        // After a deletion request the person is signed out: "Continue" takes them to sign in.
        onDone={card.kind === 'delete' ? deletion.leave : undefined}
      />
    </MotionConfig>
  );
}

export default ClientAccountSettings;
