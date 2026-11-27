'use client';

import React, { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { changeAccountPasswordAction, updatePersonalAccountAction, type PersonalAccount } from '@/app/actions/accountActions';
import { ComingSoonPill, Hint, KeyIcon, NeuSwitch, PAGE, PasswordField, RISE_IN, SectionCard, SettingRow, initialsOf } from '@/components/account/ClientAccountSettings';
import { ChevronRightIcon, EXTRUDE, InfoIcon, NeuAlert, NeuButton, PencilIcon } from '@/components/shared/neu';
import { SubmissionOverlay, useSubmission } from '@/components/shared/feedback';
import { useScreenReveal } from '@/components/shared/loading';
import { EASE_OUT } from '@/components/shared/neu/motion';
import { PAGE_FRAME } from '../table/kit';
import { ProfilePhoto } from '@/components/shared/ProfilePhoto';
import { setMyAvatar, useMyAvatar } from '@/components/account/avatarStore';
import { changeProfilePhotoAction, removeMyProfilePhotoAction } from '@/app/actions/profilePhotoActions';

/**
 * Admin Settings and My Profile, built from the client Account Settings page's own pieces
 * (caramel account summary, raised section cards, recessed setting rows, the neumorphic switch
 * and password fields), so they read as the same product:
 *  - Settings: security and session (password), administration shortcuts, platform controls.
 *  - My Profile: the administrator's name and contact number.
 */

const glyph = (d: string) =>
  function Glyph({ className = 'w-[18px] h-[18px]' }: { className?: string }) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={d} />
      </svg>
    );
  };
const ShieldGlyph = glyph('M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Zm-3.2 9 2.2 2.2 4.4-4.4');
const ScalesGlyph = glyph('M12 3v17M8 20h8M4.5 7.5h15M6.5 7.5 3.5 13.5a3 3 0 0 0 6 0l-3-6ZM17.5 7.5l-3 6a3 3 0 0 0 6 0l-3-6Z');
const SlidersGlyph = glyph('M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4');
const PersonGlyph = glyph('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0');

// ─── Shared layout ────────────────────────────────────────────────────────────

function AdminAccountLayout({
  account,
  title,
  accent,
  intro,
  link,
  children,
}: {
  account: PersonalAccount;
  title: string;
  accent: string;
  intro: string;
  link: { href: string; label: string };
  children: ReactNode;
}) {
  const myAvatar = useMyAvatar();
  // The entrance plays when the portal's loading screen lifts (not underneath it).
  const { revealed } = useScreenReveal();
  return (
    <MotionConfig reducedMotion="user">
      <motion.div variants={PAGE} initial="hidden" animate={revealed ? 'show' : 'hidden'} className={`${PAGE_FRAME} admin-account`}>
        <motion.header variants={RISE_IN} className="space-y-1.5">
          <h1 className="font-lora text-2xl font-medium leading-[1.2] tracking-tight text-[#34150F] sm:text-3xl lg:text-[36px]">
            {title} <span className="font-semibold text-[#C58B3C]">{accent}</span>
          </h1>
          <p className="max-w-xl font-inter text-[12.5px] leading-relaxed text-[#5C4535] sm:text-[13px]">{intro}</p>
        </motion.header>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[290px_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[320px_minmax(0,1fr)]">
          {/* Account summary (the client page's caramel card) */}
          <motion.aside variants={EXTRUDE} aria-label="Account summary" className="neu-raised rounded-[24px] p-5 sm:rounded-[28px] sm:p-6 lg:sticky lg:top-6" style={{ backgroundColor: 'rgba(211, 151, 88, 0.3)' }}>
            <div className="flex items-center gap-4 lg:flex-col lg:items-start">
              <span aria-hidden className="neu-btn-banner flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full font-lora text-lg font-bold text-[#341512] sm:size-16 sm:text-xl">
                {myAvatar ? <ProfilePhoto src={myAvatar} className="size-full" fallback={initialsOf(account.fullName)} /> : initialsOf(account.fullName)}
              </span>
              <div className="min-w-0">
                <p className="break-words font-lora text-base font-bold leading-tight text-[#341512] sm:text-lg">{account.fullName || 'Administrator'}</p>
                <p className="mt-1 break-all font-inter text-[11.5px] text-[#5C4535] sm:text-xs">{account.email}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="neu-inset-banner inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 font-inter text-[10.5px] font-bold text-[#5C4535]">
                <span aria-hidden className={`size-1.5 rounded-full ${account.emailVerified ? 'bg-[#1F7A3A]' : 'bg-[#B7791F]'}`} />
                {account.emailVerified ? 'Email verified' : 'Email not verified'}
              </span>
              <span className="neu-inset-banner inline-flex h-6 items-center rounded-full px-2.5 font-inter text-[10.5px] font-bold text-[#5C4535]">Administrator</span>
            </div>
            <div className="mt-5 space-y-3 border-t border-dotted border-[#B8946E]/60 pt-4">
              <p className="font-inter text-[11px] leading-relaxed text-[#5C4535]">Signed in to the Justicia admin portal.</p>
              <Link href={link.href} className="neu-btn-banner inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl font-lora text-xs font-bold text-[#341512] sm:text-[13px]">
                {link.label}
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            </div>
          </motion.aside>

          <motion.div variants={PAGE} className="min-w-0 space-y-6 sm:space-y-7">
            {children}
          </motion.div>
        </div>
      </motion.div>
    </MotionConfig>
  );
}

function OpenLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="neu-raised-sm inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[#E5D8CB] pl-4 pr-3 font-lora text-xs font-bold text-[#341512] transition-[translate,color] duration-200 hover:-translate-y-0.5 hover:text-[#A8742E]"
    >
      Open
      <ChevronRightIcon className="h-3.5 w-3.5" />
    </Link>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────

const SHORTCUTS = [
  { id: 'admin-users', title: 'User accounts', description: 'Review every client, lawyer and administrator account, change roles and send password resets.', href: '/admin/users' },
  { id: 'admin-admins', title: 'Administrator accounts', description: 'The accounts that can sign in to this admin portal.', href: '/admin/settings/admin-accounts' },
  { id: 'admin-reports', title: 'Reports', description: 'Reports filed from Messages and the suspensions or terminations decided on them.', href: '/admin/reports' },
  { id: 'admin-audit', title: 'Audit log', description: 'Every review, report decision and account change, with CSV export.', href: '/admin/settings/security-audit-log' },
];

const PLATFORM = [
  { id: 'platform-maintenance', title: 'Maintenance mode', description: 'Show a maintenance notice to clients and lawyers while the platform is updated.' },
  { id: 'platform-2fa', title: 'Two-step sign-in for administrators', description: 'Ask administrators for a one-time code each time they sign in.' },
  { id: 'platform-fees', title: 'Consultation fee limits', description: 'Set the lowest and highest rates lawyers can charge per session.' },
];

export function AdminAccountSettings({ account }: { account: PersonalAccount }) {
  const [passwordOpen, setPasswordOpen] = useState(false);
  // Changing the password shows the submission card: loader, then check / X.
  const passwordSubmission = useSubmission();
  const changing = passwordSubmission.processing;
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
    void passwordSubmission
      .run(async () => {
        try {
          const result = await changeAccountPasswordAction({ currentPassword: current, password: next, confirmPassword: confirm });
          if (!result.success) return { ok: false, error: result.error };
          resetPasswordForm();
          setPasswordOpen(false);
          return { ok: true };
        } catch {
          return { ok: false, error: 'Unable to change your password. Please try again.' };
        }
      })
      .then((result) => {
        if (result && !result.ok) setPasswordError(result.error);
      });
  };

  return (
    <AdminAccountLayout
      account={account}
      title="Account"
      accent="Settings"
      intro="Keep your administrator sign-in secure, and reach the tools that manage accounts, reports and the audit trail."
      link={{ href: '/admin/profile', label: 'View my profile' }}
    >
      {/* Security & Session (the client page's section) */}
      <SectionCard labelId="admin-settings-security" icon={<ShieldGlyph />} title="Security & Session" subtitle="An administrator account can change roles and suspend accounts, so keep its sign-in protected.">
        <div className="neu-recessed divide-y divide-dotted divide-[#B8946E]/50 rounded-[18px]">
          <SettingRow
            id="admin-sec-idle"
            title="Automatic sign-out"
            description="You're signed out after 30 minutes without activity, so an unattended device doesn't expose the admin portal."
            control={
              <span className="neu-raised-pill inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-[#E5D8CB] px-3 font-inter text-[11px] font-bold text-[#1F7A3A]">
                <span className="relative flex size-2" aria-hidden>
                  <span className="neu-beacon absolute inset-0 rounded-full bg-[#27AE60]" />
                  <span className="relative size-2 rounded-full bg-[#27AE60]" />
                </span>
                Active
              </span>
            }
          />
          <div>
            <SettingRow
              id="admin-sec-password"
              title="Password"
              description="Use 8 or more characters. You'll confirm your current password first."
              control={
                <AnimatePresence initial={false}>
                  {!passwordOpen && (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.16 }} className="shrink-0">
                      <NeuButton
                        size="sm"
                        icon={<KeyIcon className="h-3.5 w-3.5" />}
                        aria-expanded={passwordOpen}
                        aria-controls="admin-password-form"
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
                <motion.div key="password-form" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.32, ease: EASE_OUT }} className="overflow-hidden">
                  <form id="admin-password-form" onSubmit={submitPassword} className="space-y-4 px-4 pb-5 pt-1 sm:px-5">
                    <fieldset disabled={changing} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2 sm:max-w-[calc(50%-0.5rem)]">
                        <PasswordField name="currentPassword" label="Current password" autoComplete="current-password" value={current} onChange={setCurrent} />
                      </div>
                      <PasswordField name="password" label="New password" autoComplete="new-password" minLength={8} value={next} onChange={setNext} />
                      <PasswordField name="confirmPassword" label="Confirm new password" autoComplete="new-password" minLength={8} value={confirm} onChange={setConfirm} />
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
                        disabled={changing}
                        onClick={() => {
                          resetPasswordForm();
                          setPasswordOpen(false);
                        }}
                      >
                        Cancel
                      </NeuButton>
                      <Link href="/forgot-password" className="ml-auto font-inter text-[12px] font-semibold text-[#946525] underline underline-offset-2 transition-colors hover:text-[#C58B3C]">
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

      {/* Administration shortcuts */}
      <SectionCard labelId="admin-settings-tools" icon={<ScalesGlyph />} title="Administration" subtitle="The tools that manage accounts, reports and the audit trail.">
        <div className="neu-recessed divide-y divide-dotted divide-[#B8946E]/50 rounded-[18px]">
          {SHORTCUTS.map((s) => (
            <SettingRow key={s.id} id={s.id} title={s.title} description={s.description} control={<OpenLink href={s.href} label={`Open ${s.title.toLowerCase()}`} />} />
          ))}
        </div>
      </SectionCard>

      {/* Platform controls (not connected yet) */}
      <SectionCard labelId="admin-settings-platform" icon={<SlidersGlyph />} title="Platform controls" subtitle="Platform-wide switches. These appear here first and turn on once they can be saved and enforced.">
        <div className="neu-recessed divide-y divide-dotted divide-[#B8946E]/50 rounded-[18px]">
          {PLATFORM.map((p) => (
            <SettingRow
              key={p.id}
              id={p.id}
              title={p.title}
              badge={<ComingSoonPill />}
              description={p.description}
              control={<NeuSwitch checked={false} disabled labelledBy={`${p.id}-label`} describedBy={`${p.id}-desc`} />}
            />
          ))}
        </div>
        <p className="flex items-start gap-2 font-inter text-[11px] leading-relaxed text-[#7D6855]">
          <InfoIcon className="mt-px h-3.5 w-3.5 shrink-0 text-[#C58B3C]" />
          These controls are not connected to the application yet, so they can&apos;t be changed here.
        </p>
      </SectionCard>

      <SubmissionOverlay
        submission={passwordSubmission}
        processing={{ title: 'Updating your password', message: 'Checking your current password and saving the new one.' }}
        success={{ title: 'Password updated', message: 'Use your new password the next time you sign in.' }}
        failure={{ title: "We couldn't update your password" }}
      />
    </AdminAccountLayout>
  );
}

// ─── My Profile ───────────────────────────────────────────────────────────────

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-dossier-cell min-w-0 rounded-[14px] px-4 py-3">
      <dt className="font-inter text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[#8A6A4C]">{label}</dt>
      <dd className="mt-1 font-lora text-[14px] font-semibold leading-snug text-[#341512] [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}

export function AdminProfile({ account }: { account: PersonalAccount }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(account.fullName);
  const [phone, setPhone] = useState(account.phone);
  // Saving shows the submission card: loader, then check / X.
  const profileSubmission = useSubmission();
  const saving = profileSubmission.processing;
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    void profileSubmission
      .run(async () => {
        try {
          const result = await updatePersonalAccountAction({ fullName, phone });
          if (!result.success) return { ok: false, error: result.error };
          setEditing(false);
          router.refresh();
          return { ok: true };
        } catch {
          return { ok: false, error: 'Unable to save your profile. Please try again.' };
        }
      })
      .then((result) => {
        if (result && !result.ok) setError(result.error);
      });
  };

  return (
    <AdminAccountLayout
      account={account}
      title="My"
      accent="Profile"
      intro="Your name and contact number, as other administrators see them in the audit log."
      link={{ href: '/admin/settings', label: 'Account settings' }}
    >
      <SectionCard
        labelId="admin-profile-details"
        icon={<PersonGlyph />}
        title="Personal details"
        subtitle="Your sign-in email and role can't be changed here."
        status={
          !editing && (
            <NeuButton
              size="sm"
              icon={<PencilIcon className="h-3.5 w-3.5" />}
              onClick={() => {
                setEditing(true);
                setMessage('');
              }}
            >
              Edit
            </NeuButton>
          )
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          {editing ? (
            <motion.form key="edit" onSubmit={save} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="space-y-4">
              <fieldset disabled={saving} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="block font-inter text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#7D6855]">Full name</span>
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={120} autoComplete="name" className="neu-input h-11 w-full rounded-xl px-4 font-inter text-[13px] text-[#341512]" />
                </label>
                <label className="space-y-1.5">
                  <span className="block font-inter text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#7D6855]">Contact number</span>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" maxLength={30} autoComplete="tel" className="neu-input h-11 w-full rounded-xl px-4 font-inter text-[13px] text-[#341512]" />
                </label>
              </fieldset>
              <div className="flex flex-wrap gap-3">
                <NeuButton type="submit" variant="primary" size="sm" disabled={saving}>
                  Save changes
                </NeuButton>
                <NeuButton
                  size="sm"
                  disabled={saving}
                  onClick={() => {
                    setEditing(false);
                    setFullName(account.fullName);
                    setPhone(account.phone);
                    setError('');
                  }}
                >
                  Cancel
                </NeuButton>
              </div>
            </motion.form>
          ) : (
            <motion.dl key="view" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Detail label="Full name" value={account.fullName || '—'} />
              <Detail label="Email" value={account.email} />
              <Detail label="Contact number" value={account.phone || 'Not added'} />
              <Detail label="Role" value="Administrator" />
            </motion.dl>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {(error || message) && (
            <NeuAlert key={error ? 'error' : 'ok'} tone={error ? 'error' : 'success'} onDismiss={() => (error ? setError('') : setMessage(''))}>
              {error || message}
            </NeuAlert>
          )}
        </AnimatePresence>
      </SectionCard>
      <ProfilePhotoSection fullName={account.fullName} />

      <SubmissionOverlay
        submission={profileSubmission}
        processing={{ title: 'Saving your profile', message: 'Updating your name and contact number.' }}
        success={{ title: 'Profile saved', message: 'Other administrators see your updated details in the audit log.' }}
        failure={{ title: "We couldn't save your profile" }}
      />
    </AdminAccountLayout>
  );
}

/** Profile photo: shows in the header's account button and the account summary. */
function ProfilePhotoSection({ fullName }: { fullName: string }) {
  const photo = useMyAvatar();
  const input = React.useRef<HTMLInputElement>(null);
  // Changing or removing the photo shows the submission card: loader, then check / X.
  const submission = useSubmission();
  const busy = submission.processing;
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setRemoving(false);
    setError('');
    setMessage('');
    const result = await submission.run(async () => {
      try {
        const fd = new FormData();
        fd.set('file', file);
        const res = await changeProfilePhotoAction(fd);
        if (!res.success) return { ok: false, error: res.error };
        setMyAvatar(res.avatarUrl);
        return { ok: true };
      } catch {
        return { ok: false, error: 'Your photo could not be uploaded. Please try again.' };
      }
    });
    if (result && !result.ok) setError(result.error);
    if (input.current) input.current.value = '';
  };

  const remove = async () => {
    setRemoving(true);
    setError('');
    setMessage('');
    const result = await submission.run(async () => {
      try {
        const res = await removeMyProfilePhotoAction();
        if (!res.success) return { ok: false, error: res.error };
        setMyAvatar(null);
        return { ok: true };
      } catch {
        return { ok: false, error: 'Your photo could not be removed. Please try again.' };
      }
    });
    if (result && !result.ok) setError(result.error);
  };

  return (
    <SectionCard labelId="admin-profile-photo" icon={<PersonGlyph />} title="Profile photo" subtitle="PNG, JPG or WebP up to 4 MB. It replaces the person icon in the header.">
      <div className="flex flex-wrap items-center gap-4">
        <span aria-hidden className="neu-btn-banner flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full font-lora text-lg font-bold text-[#341512]">
          {photo ? <ProfilePhoto src={photo} className="size-full" fallback={initialsOf(fullName)} /> : initialsOf(fullName)}
        </span>
        <input ref={input} id="admin-profile-photo-input" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy} onChange={(e) => void upload(e.target.files?.[0])} />
        <NeuButton size="sm" variant="primary" disabled={busy} onClick={() => input.current?.click()}>
          {photo ? 'Change photo' : 'Add a photo'}
        </NeuButton>
        {photo && (
          <NeuButton size="sm" disabled={busy} onClick={() => void remove()}>
            Remove photo
          </NeuButton>
        )}
      </div>
      <AnimatePresence>
        {(error || message) && (
          <NeuAlert key={error ? 'photo-error' : 'photo-ok'} tone={error ? 'error' : 'success'} onDismiss={() => (error ? setError('') : setMessage(''))}>
            {error || message}
          </NeuAlert>
        )}
      </AnimatePresence>

      <SubmissionOverlay
        submission={submission}
        processing={removing ? { title: 'Removing your photo' } : { title: 'Uploading your photo', message: 'It replaces the person icon in the header.' }}
        success={removing ? { title: 'Photo removed', message: 'Your initials show in its place.' } : { title: 'Photo updated', message: 'It now shows in the header and your account summary.' }}
        failure={{ title: removing ? "We couldn't remove your photo" : "We couldn't upload your photo" }}
      />
    </SectionCard>
  );
}
