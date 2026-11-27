'use client';

/**
 * The personal profile page for clients (/client/profile) and lawyers (/lawyer/account), in the
 * same design as the Account Settings page: a caramel summary card on the left (photo, name,
 * verification, completeness, activity) and raised sections on the right for personal and
 * contact details. Lawyers also get their Payment QR here, and their legal name is read-only
 * (changing it needs credential verification; the server enforces this too).
 *
 * The same server actions save the name, phone and contact preferences, and the photo is shared
 * with the top bar, Messages and consultations.
 */
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { updatePersonalAccountAction, type PersonalAccount } from '@/app/actions/accountActions';
import { updateProfileExtrasAction } from '@/app/actions/profileExtrasActions';
import { changeProfilePhotoAction, removeMyProfilePhotoAction } from '@/app/actions/profilePhotoActions';
import { setMyAvatar, useMyAvatar } from './avatarStore';
import { ProfilePhoto } from '@/components/shared/ProfilePhoto';
import { ResendVerificationButton } from '@/components/auth/ResendVerificationButton';
import { NeuAlert, NeuButton, EXTRUDE, CheckCircleIcon, PencilIcon, Spinner } from '@/components/shared/neu';
import { PAGE, RISE_IN, SectionCard, accountPageClass, initialsOf } from './ClientAccountSettings';
import { PaymentQrCard } from './PaymentQrCard';
import { SubmissionOverlay, useSubmission, type SubmissionCopy, type SubmissionResult } from '@/components/shared/feedback';
import { useScreenReveal } from '@/components/shared/loading';
import type { ProfileExtrasData } from './PersonalProfileCard';
import {
  CONSULTATION_LANGUAGES,
  CONTACT_METHODS,
  CONTACT_TIMES,
  contactMethodLabel,
  contactTimeLabel,
  profileCompleteness,
  type ProfileExtras,
} from '@/lib/account/profileExtras';

const inputClass =
  'neu-input w-full h-11 rounded-[13px] px-4 font-inter text-[13.5px] text-[#34150F] disabled:cursor-not-allowed disabled:opacity-60 read-only:cursor-default';
const labelClass = 'block font-lora text-[12.5px] font-semibold text-[#4A3426] mb-1.5';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}

const PersonIcon = () => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="3.6" />
    <path d="M5 20c0-3.7 3.1-6.3 7-6.3s7 2.6 7 6.3" />
  </svg>
);

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12Z" />
  </svg>
);

const CameraIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </svg>
);

/** A read-only value in a recessed well; "Not added" in a softer tone when empty. */
function DetailValue({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="neu-recessed rounded-2xl px-4 py-3 min-w-0">
      <dt className="font-inter text-[10px] font-bold uppercase tracking-[0.12em] text-[#7D6855]">{label}</dt>
      <dd className={`mt-1 font-inter text-[13.5px] break-words ${value ? 'font-medium text-[#34150F]' : 'italic text-[#9A8270]'}`}>
        {value || 'Not added yet'}
      </dd>
    </div>
  );
}

/** Ring that fills to the completeness percentage. */
function CompletenessRing({ percent }: { percent: number }) {
  // Fills once the portal's loading screen lifts, with the rest of the entrance.
  const { revealed } = useScreenReveal();
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 56 56" className="h-14 w-14 shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(52, 21, 15, 0.12)" strokeWidth="5" />
      <motion.circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke="#34150F"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: revealed ? c * (1 - percent / 100) : c }}
        transition={{ duration: 1.1, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}

export function ClientProfileView({
  account,
  extras: initialExtras = null,
  avatarUrl = null,
}: {
  account: PersonalAccount;
  extras?: ProfileExtrasData | null;
  avatarUrl?: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  // Saving the profile or changing the photo shows the submission card: loader, then check / X.
  const submission = useSubmission();
  const pending = submission.processing;
  const [overlayCopy, setOverlayCopy] = useState<{ processing: SubmissionCopy; success: SubmissionCopy; failure: string }>({
    processing: { title: 'Saving your profile' },
    success: { title: 'Profile saved' },
    failure: "We couldn't save your profile",
  });
  /** Runs a request with the submission card; a failure is also shown on the page. */
  const runWithCard = async (copy: typeof overlayCopy, task: () => Promise<SubmissionResult>, fallback: string) => {
    setOverlayCopy(copy);
    const result = await submission.run(async () => {
      try {
        return await task();
      } catch {
        return { ok: false, error: fallback };
      }
    });
    if (result && !result.ok) setError(result.error);
    return result;
  };
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState(0);
  const [photoMessage, setPhotoMessage] = useState('');
  const [extras, setExtras] = useState<ProfileExtras | null>(initialExtras?.extras ?? null);
  const photoBusy = submission.processing;
  const photoInput = useRef<HTMLInputElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  // One photo per person, shared with the top bar, Messages and consultation cards.
  const photo = useMyAvatar(avatarUrl ?? initialExtras?.extras.avatarUrl ?? null);
  const showExtras = !!initialExtras && !!extras;
  const fieldsReady = !!initialExtras?.fieldsReady;
  const completeness = showExtras
    ? profileCompleteness({ fullName: account.fullName, phone: account.phone, emailVerified: account.emailVerified, extras: { ...extras!, avatarUrl: photo } })
    : null;
  const summary = initialExtras?.summary ?? null;
  // Lawyers see the same page with their own wording, links and Payment QR.
  const isLawyer = account.role === 'lawyer';
  // The entrance plays when the portal's loading screen lifts (not underneath it).
  const { revealed } = useScreenReveal();
  const settingsHref = isLawyer ? '/lawyer/settings' : '/client/settings';

  // "Saved" fades after a moment.
  useEffect(() => {
    if (!savedAt) return;
    const t = setTimeout(() => setSavedAt(0), 2600);
    return () => clearTimeout(t);
  }, [savedAt]);

  useEffect(() => {
    if (editing) firstFieldRef.current?.focus();
  }, [editing]);

  const uploadPhoto = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setPhotoMessage('');
    await runWithCard(
      {
        processing: { title: 'Uploading your photo', message: 'Updating the photo people see on Justicia.' },
        success: { title: 'Photo updated', message: 'It now shows in the top bar, Messages and your consultations.' },
        failure: "We couldn't upload your photo",
      },
      async () => {
        const fd = new FormData();
        fd.set('file', file);
        const res = await changeProfilePhotoAction(fd);
        if (!res.success) return { ok: false, error: res.error };
        setMyAvatar(res.avatarUrl);
        setExtras((e) => (e ? { ...e, avatarUrl: res.avatarUrl } : e));
        router.refresh();
        return { ok: true };
      },
      'Your photo could not be uploaded. Please try again.'
    );
    if (photoInput.current) photoInput.current.value = '';
  };

  const removePhoto = async () => {
    setError('');
    setPhotoMessage('');
    await runWithCard(
      {
        processing: { title: 'Removing your photo' },
        success: { title: 'Photo removed', message: 'Your initials show in its place.' },
        failure: "We couldn't remove your photo",
      },
      async () => {
        const res = await removeMyProfilePhotoAction();
        if (!res.success) return { ok: false, error: res.error };
        setMyAvatar(null);
        setExtras((e) => (e ? { ...e, avatarUrl: null } : e));
        router.refresh();
        return { ok: true };
      },
      'Your photo could not be removed. Please try again.'
    );
  };

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get('fullName') ?? '').trim();
    if (fullName.length < 2) {
      setError('Please enter your full legal name.');
      return;
    }
    setError('');
    void runWithCard(
      {
        processing: { title: 'Saving your profile', message: 'Updating your personal and contact details.' },
        success: { title: 'Profile saved', message: 'Your details are up to date.' },
        failure: "We couldn't save your profile",
      },
      async () => {
        const result = await updatePersonalAccountAction({ fullName, phone: String(form.get('phone') ?? '') });
        if (!result.success) return { ok: false, error: result.error };
        if (showExtras) {
          const saved = await updateProfileExtrasAction({
            cityProvince: String(form.get('cityProvince') ?? ''),
            preferredLanguage: String(form.get('preferredLanguage') ?? ''),
            contactMethod: String(form.get('contactMethod') ?? ''),
            contactTime: String(form.get('contactTime') ?? ''),
          });
          if (!saved.success) {
            router.refresh();
            return { ok: false, error: saved.error };
          }
          setExtras(saved.extras);
        }
        setEditing(false);
        setSavedAt(Date.now());
        router.refresh();
        return { ok: true };
      },
      'Unable to save your profile. Please try again.'
    );
  };

  const contactPreference = showExtras
    ? [contactMethodLabel(extras?.contactMethod), contactTimeLabel(extras?.contactTime)].filter(Boolean).join(' · ')
    : '';

  const editButton = (
    <AnimatePresence mode="wait" initial={false}>
      {savedAt ? (
        <motion.span
          key="saved"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="neu-raised-pill bg-[#E5D8CB] inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 font-inter text-[11.5px] font-bold text-[#1F7A3A]"
          role="status"
        >
          <CheckCircleIcon className="h-3.5 w-3.5" /> Saved
        </motion.span>
      ) : !editing ? (
        <motion.button
          key="edit"
          type="button"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            setEditing(true);
            setError('');
          }}
          className="neu-raised-pill bg-[#E5D8CB] inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 font-lora text-[12px] font-bold text-[#341512] transition-colors hover:text-[#A8742E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58B3C]/60 cursor-pointer"
        >
          <PencilIcon className="h-3.5 w-3.5" /> Edit
        </motion.button>
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
            My <span className="text-[#C58B3C] font-semibold">Profile</span>
          </h1>
          <p className="font-inter text-[12.5px] sm:text-[13px] text-[#5C4535] max-w-xl leading-relaxed">
            Personal identification and contact details for your consultation records.
          </p>
        </motion.header>

        <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
          {/* ─── Left: profile summary ─── */}
          <motion.aside
            variants={EXTRUDE}
            aria-label="Profile summary"
            className="neu-raised rounded-[24px] sm:rounded-[28px] p-5 sm:p-6 lg:sticky lg:top-6"
            style={{ backgroundColor: 'rgba(211, 151, 88, 0.3)' }}
          >
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <motion.span
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={revealed ? { scale: 1, opacity: 1 } : { scale: 0.7, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
                  className="neu-btn-banner grid size-24 place-items-center overflow-hidden rounded-full font-lora text-2xl font-bold text-[#341512]"
                >
                  {photo ? <ProfilePhoto src={photo} alt={account.fullName} className="size-full" fallback={initialsOf(account.fullName)} /> : initialsOf(account.fullName)}
                  {photoBusy && (
                    <span className="absolute inset-0 grid place-items-center rounded-full bg-[#341512]/45 text-white" aria-hidden="true">
                      <Spinner className="h-6 w-6" />
                    </span>
                  )}
                </motion.span>
                <input
                  ref={photoInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="peer sr-only"
                  id="profile-photo"
                  disabled={photoBusy}
                  onChange={(e) => void uploadPhoto(e.target.files?.[0])}
                />
                <label
                  htmlFor="profile-photo"
                  title={photo ? 'Change photo' : 'Add a photo'}
                  className={`absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-full bg-[#E5D8CB] text-[#341512] transition-all hover:-translate-y-0.5 hover:text-[#A8742E] peer-focus-visible:ring-2 peer-focus-visible:ring-[#C58B3C]/60 cursor-pointer ${
                    photoBusy ? 'pointer-events-none opacity-60' : ''
                  }`}
                >
                  <CameraIcon />
                  <span className="sr-only">{photo ? 'Change photo' : 'Add a photo'}</span>
                </label>
              </div>

              <p className="mt-4 font-lora text-lg font-bold text-[#341512] leading-tight break-words">{account.fullName || 'Your profile'}</p>
              <p className="mt-1 font-inter text-xs text-[#5C4535] break-all">{account.email}</p>

              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <span className="neu-inset-banner inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 font-inter text-[10.5px] font-bold text-[#5C4535]">
                  <span aria-hidden="true" className={`size-1.5 rounded-full ${account.emailVerified ? 'bg-[#1F7A3A]' : 'bg-[#B7791F]'}`} />
                  {account.emailVerified ? 'Email verified' : 'Email not verified'}
                </span>
                <span className="neu-inset-banner inline-flex h-6 items-center rounded-full px-2.5 font-inter text-[10.5px] font-bold text-[#5C4535]">
                  {isLawyer ? 'Lawyer account' : 'Client account'}
                </span>
              </div>
              {!account.emailVerified && (
                <div className="mt-2">
                  <ResendVerificationButton
                    cooldownSeconds={60}
                    className="font-inter text-[11.5px] font-semibold text-[#946525] underline underline-offset-2 disabled:opacity-60 cursor-pointer"
                    messageClassName="font-inter text-[11px] text-[#5C4535]"
                  />
                </div>
              )}

              <div className="mt-3 flex min-h-[1.25rem] flex-wrap items-center justify-center gap-3 font-inter text-[11.5px]">
                {photo && (
                  <button
                    type="button"
                    disabled={photoBusy}
                    onClick={() => void removePhoto()}
                    className="font-semibold text-[#7D6855] hover:text-[#B42318] disabled:opacity-60 cursor-pointer"
                  >
                    Remove photo
                  </button>
                )}
                <AnimatePresence>
                  {photoMessage && (
                    <motion.span key={photoMessage} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="status" className="text-[#1F7A3A] font-medium">
                      {photoMessage}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {completeness && (
              <div className="mt-5 border-t border-dotted border-[#B8946E]/60 pt-5">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <CompletenessRing percent={completeness.percent} />
                    <span className="absolute inset-0 grid place-items-center font-lora text-[13px] font-bold text-[#341512]">
                      {completeness.percent}%
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-lora text-sm font-bold text-[#341512]">Profile completeness</p>
                    <p className="mt-0.5 font-inter text-[11.5px] leading-relaxed text-[#5C4535]">
                      {completeness.missing.length
                        ? `Add your ${completeness.missing.slice(0, 2).join(' and ')} to help ${isLawyer ? 'clients' : 'lawyers'} reach you.`
                        : 'Everything is filled in. Nice work.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {summary && (
              <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-dotted border-[#B8946E]/60 pt-5">
                {[
                  ['Member since', formatDate(summary.memberSince)],
                  ['Completed', `${summary.consultationsCompleted} consultation${summary.consultationsCompleted === 1 ? '' : 's'}`],
                  // For lawyers this count is the clients they've served.
                  [isLawyer ? 'Clients served' : 'Lawyers consulted', String(summary.lawyersConsulted)],
                  ['Upcoming', String(summary.upcomingConsultations)],
                ].map(([label, value]) => (
                  <div key={label} className="neu-inset-banner rounded-2xl px-3 py-2.5">
                    <dt className="font-inter text-[9.5px] font-bold uppercase tracking-[0.12em] text-[#7D6855]">{label}</dt>
                    <dd className="mt-0.5 font-lora text-[13px] font-bold text-[#341512] leading-snug">{value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {/* Lawyers: their public profile (what clients see) is a separate page. */}
            {isLawyer && (
              <div className="mt-5 border-t border-dotted border-[#B8946E]/60 pt-5">
                <Link
                  href="/lawyer/profile"
                  className="neu-btn-banner w-full h-10 rounded-xl inline-flex items-center justify-center gap-2 font-lora text-xs sm:text-[13px] font-bold text-[#341512]"
                >
                  View public profile
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Link>
              </div>
            )}
          </motion.aside>

          {/* ─── Right: details ─── */}
          <motion.div variants={PAGE} className="space-y-6 sm:space-y-7 min-w-0">
            <AnimatePresence initial={false}>
              {error && (
                <motion.div key="error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <NeuAlert tone="error" title="We couldn't save that" onDismiss={() => setError('')}>
                    {error}
                  </NeuAlert>
                </motion.div>
              )}
            </AnimatePresence>

            <SectionCard
              labelId="profile-details"
              icon={<PersonIcon />}
              title="Personal details"
              subtitle="Used on your consultation records. Your sign-in email and account role cannot be changed here."
              status={editButton}
            >
              <AnimatePresence mode="wait" initial={false}>
                {editing ? (
                  <motion.form
                    key="edit"
                    onSubmit={save}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.22 }}
                    className="space-y-5"
                    aria-busy={pending || undefined}
                  >
                    <fieldset disabled={pending} className="m-0 min-w-0 space-y-5 border-0 p-0">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="profile-fullName" className={labelClass}>Full legal name</label>
                          <input
                            ref={firstFieldRef}
                            id="profile-fullName"
                            name="fullName"
                            required
                            maxLength={120}
                            autoComplete="name"
                            defaultValue={account.fullName}
                            readOnly={isLawyer}
                            aria-describedby={isLawyer ? 'profile-name-note' : undefined}
                            className={`${inputClass} ${isLawyer ? 'text-[#7D6855]' : ''}`}
                          />
                          {isLawyer && (
                            <p id="profile-name-note" className="mt-1.5 font-inter text-[11px] text-[#7D6855]">
                              Legal-name changes require credential verification. Please contact support.
                            </p>
                          )}
                        </div>
                        <div>
                          <label htmlFor="profile-phone" className={labelClass}>Contact number</label>
                          <input id="profile-phone" name="phone" type="tel" inputMode="tel" maxLength={30} autoComplete="tel" placeholder="e.g. 0917 123 4567" defaultValue={account.phone} className={inputClass} />
                        </div>
                        <div className="sm:col-span-2">
                          <label htmlFor="profile-email" className={labelClass}>Email address</label>
                          <input id="profile-email" value={account.email} readOnly aria-describedby="profile-email-note" className={`${inputClass} text-[#7D6855]`} />
                          <p id="profile-email-note" className="mt-1.5 font-inter text-[11px] text-[#7D6855]">
                            This is your sign-in email and can&apos;t be changed here. Notification options are in{' '}
                            <Link href={settingsHref} className="font-semibold text-[#946525] underline underline-offset-2">Settings</Link>.
                          </p>
                        </div>
                      </div>

                      {showExtras && (
                        <div className="space-y-4 border-t border-dotted border-[#B8946E]/50 pt-5">
                          <p className="font-lora text-[13px] font-bold text-[#341512]">Contact preferences</p>
                          {!fieldsReady && (
                            <NeuAlert tone="info">Contact preferences are not available yet. Your name and number can still be saved.</NeuAlert>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label htmlFor="profile-city" className={labelClass}>City / Province</label>
                              <input id="profile-city" name="cityProvince" maxLength={120} autoComplete="address-level2" placeholder="e.g. Cebu City, Cebu" defaultValue={extras?.cityProvince ?? ''} disabled={!fieldsReady} className={inputClass} />
                            </div>
                            <div>
                              <label htmlFor="profile-language" className={labelClass}>Consultation language</label>
                              <select id="profile-language" name="preferredLanguage" defaultValue={extras?.preferredLanguage ?? ''} disabled={!fieldsReady} className={`${inputClass} cursor-pointer`}>
                                <option value="">No preference</option>
                                {CONSULTATION_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                              </select>
                            </div>
                            <div>
                              <label htmlFor="profile-method" className={labelClass}>Preferred contact method</label>
                              <select id="profile-method" name="contactMethod" defaultValue={extras?.contactMethod ?? ''} disabled={!fieldsReady} className={`${inputClass} cursor-pointer`}>
                                <option value="">No preference</option>
                                {CONTACT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                              </select>
                            </div>
                            <div>
                              <label htmlFor="profile-time" className={labelClass}>Best time to reach you</label>
                              <select id="profile-time" name="contactTime" defaultValue={extras?.contactTime ?? ''} disabled={!fieldsReady} className={`${inputClass} cursor-pointer`}>
                                <option value="">No preference</option>
                                {CONTACT_TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                              </select>
                            </div>
                          </div>
                          <p className="font-inter text-[11.5px] text-[#7D6855]">
                            {isLawyer
                              ? 'Your location, language and how you would like to be reached.'
                              : 'Lawyers you book see your location and contact preferences.'}
                          </p>
                        </div>
                      )}
                    </fieldset>

                    <div className="flex flex-col-reverse gap-3 border-t border-[#CDBCA8]/60 pt-5 sm:flex-row sm:justify-end">
                      <NeuButton
                        variant="secondary"
                        disabled={pending}
                        onClick={() => {
                          setEditing(false);
                          setError('');
                        }}
                      >
                        Cancel
                      </NeuButton>
                      <NeuButton type="submit" variant="primary" disabled={pending}>
                        Save Changes
                      </NeuButton>
                    </div>
                  </motion.form>
                ) : (
                  <motion.dl
                    key="view"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.22 }}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3.5"
                  >
                    <DetailValue label="Full legal name" value={account.fullName} />
                    <DetailValue label="Email address" value={account.email} />
                    <DetailValue label="Contact number" value={account.phone} />
                    <DetailValue label="Jurisdiction" value="Republic of the Philippines" />
                  </motion.dl>
                )}
              </AnimatePresence>
            </SectionCard>

            {showExtras && !editing && (
              <SectionCard
                labelId="profile-contact"
                icon={<ChatIcon />}
                title="Contact preferences"
                subtitle={isLawyer ? 'Your location, language and how you would like to be reached.' : "Lawyers you book see your location and how you'd like to be reached."}
              >
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <DetailValue label="City / Province" value={extras?.cityProvince} />
                  <DetailValue label="Consultation language" value={extras?.preferredLanguage} />
                  <div className="sm:col-span-2">
                    <DetailValue label="Contact preference" value={contactPreference} />
                  </div>
                </dl>
              </SectionCard>
            )}

            {/* Lawyers: the QR clients scan to pay for an approved consultation. */}
            {isLawyer && <PaymentQrCard />}
          </motion.div>
        </div>
      </motion.div>

      <SubmissionOverlay
        submission={submission}
        processing={overlayCopy.processing}
        success={overlayCopy.success}
        failure={{ title: overlayCopy.failure }}
      />
    </MotionConfig>
  );
}
