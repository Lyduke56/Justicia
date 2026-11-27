'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserCircleIcon } from '@/components/client/ClientIcons';
import { updatePersonalAccountAction, type PersonalAccount } from '@/app/actions/accountActions';
import { updateProfileExtrasAction, type ProfileSummary } from '@/app/actions/profileExtrasActions';
import { changeProfilePhotoAction, removeMyProfilePhotoAction } from '@/app/actions/profilePhotoActions';
import { setMyAvatar, useMyAvatar } from './avatarStore';
import { ProfilePhoto } from '@/components/shared/ProfilePhoto';
import { CopyButton } from '@/components/shared/CopyButton';
import { ResendVerificationButton } from '@/components/auth/ResendVerificationButton';
import {
  CONSULTATION_LANGUAGES,
  CONTACT_METHODS,
  CONTACT_TIMES,
  contactMethodLabel,
  contactTimeLabel,
  profileCompleteness,
  type ProfileExtras,
} from '@/lib/account/profileExtras';

export const accountInputClass = 'mt-1 block w-full rounded-lg border border-[#D6C4AE] bg-[#EFE5D8] px-3 py-2 text-xs text-[#34150F] outline-none focus:border-[#C58B3C] focus:ring-1 focus:ring-[#C58B3C]';
export const accountButtonClass = 'rounded-lg bg-[#34150F] px-4 py-2 text-xs font-medium text-[#EFE5D8] transition-colors hover:bg-[#4A2118] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C58B3C]';

export interface ProfileExtrasData {
  extras: ProfileExtras;
  fieldsReady: boolean;
  summary: ProfileSummary;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function PersonalProfileCard({ account, extras: initialExtras = null, avatarUrl = null }: { account: PersonalAccount; extras?: ProfileExtrasData | null; avatarUrl?: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [extras, setExtras] = useState<ProfileExtras | null>(initialExtras?.extras ?? null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  // One photo per person, shared with the top bar, Messages and consultation cards.
  const photo = useMyAvatar(avatarUrl ?? initialExtras?.extras.avatarUrl ?? null);
  const role = account.role[0].toUpperCase() + account.role.slice(1);
  const showExtras = !!initialExtras && !!extras;
  const completeness = showExtras ? profileCompleteness({ fullName: account.fullName, phone: account.phone, emailVerified: account.emailVerified, extras: extras! }) : null;

  const uploadPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    setError(''); setMessage('');
    try {
      const fd = new FormData();
      fd.set('file', file);
      const res = await changeProfilePhotoAction(fd);
      if (!res.success) { setError(res.error); return; }
      setMyAvatar(res.avatarUrl);
      setExtras((e) => (e ? { ...e, avatarUrl: res.avatarUrl } : e));
      setMessage('Your photo has been updated.');
      router.refresh();
    } catch { setError('Your photo could not be uploaded. Please try again.'); }
    finally {
      setPhotoBusy(false);
      if (photoInput.current) photoInput.current.value = '';
    }
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    setError(''); setMessage('');
    try {
      const res = await removeMyProfilePhotoAction();
      if (!res.success) { setError(res.error); return; }
      setMyAvatar(null);
      setExtras((e) => (e ? { ...e, avatarUrl: null } : e));
      setMessage('Your photo has been removed.');
      router.refresh();
    } finally { setPhotoBusy(false); }
  };

  return <div className="rounded-3xl p-8 bg-[#EFE5D8] shadow-[6px_6px_16px_rgba(0,0,0,0.06),-6px_-6px_16px_rgba(255,255,255,0.85)] border border-[#E8DCCB]/60 space-y-6">
    <div className="flex items-center gap-5">
      <div className="w-16 h-16 shrink-0 rounded-full border-2 border-[#5C4535]/80 flex items-center justify-center text-[#5C4535] bg-[#EAE0D2] overflow-hidden">
        <ProfilePhoto src={photo} className="w-full h-full" fallback={<UserCircleIcon className="w-10 h-10" />} />
      </div>
      <div className="min-w-0">
        <h2 className="font-cormorant font-bold text-xl text-[#34150F] break-words">{account.fullName}</h2>
        <p className="text-xs text-[#7D6855] break-all">{account.email}</p>
        <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-[#E5D7C5] text-[#34150F] text-[10px] font-semibold">
          {account.emailVerified ? 'Email Verified' : 'Email Unverified'} · {role} Account
        </span>
        {!account.emailVerified && (
          <div className="mt-1">
            <ResendVerificationButton className="text-[11px] text-[#946525] underline disabled:opacity-60" messageClassName="text-[11px] text-[#7D6855]" />
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]">
          <input ref={photoInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" id="profile-photo" disabled={photoBusy} onChange={(e) => void uploadPhoto(e.target.files?.[0])} />
          <label htmlFor="profile-photo" className={`text-[#946525] underline cursor-pointer ${photoBusy ? 'opacity-60 pointer-events-none' : ''}`}>
            {photoBusy ? 'Uploading…' : photo ? 'Change photo' : 'Add a photo'}
          </label>
          {photo && <button type="button" disabled={photoBusy} onClick={() => void removePhoto()} className="text-[#7D6855] hover:text-red-700 disabled:opacity-60">Remove photo</button>}
        </div>
      </div>
    </div>
    {editing ? <form onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      setError(''); setMessage('');
      startTransition(async () => {
        try {
          const result = await updatePersonalAccountAction({ fullName: String(form.get('fullName') ?? ''), phone: String(form.get('phone') ?? '') });
          if (!result.success) { setError(result.error); return; }
          if (showExtras) {
            const saved = await updateProfileExtrasAction({
              cityProvince: String(form.get('cityProvince') ?? ''),
              preferredLanguage: String(form.get('preferredLanguage') ?? ''),
              contactMethod: String(form.get('contactMethod') ?? ''),
              contactTime: String(form.get('contactTime') ?? ''),
            });
            if (!saved.success) { setError(saved.error); router.refresh(); return; }
            setExtras(saved.extras);
          }
          setMessage(result.message); setEditing(false); router.refresh();
        } catch { setError('Unable to save your profile. Please try again.'); }
      });
    }} className="space-y-4 pt-4 border-t border-[#E5D7C5]">
      <fieldset disabled={pending} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#7D6855]">
        <label>Full Legal Name<input name="fullName" required maxLength={120} autoComplete="name" readOnly={account.role === 'lawyer'} defaultValue={account.fullName} className={accountInputClass} /></label>
        <label>Contact Number<input name="phone" type="tel" maxLength={30} autoComplete="tel" defaultValue={account.phone} className={accountInputClass} /></label>
        {showExtras && <>
          <label>City / Province<input name="cityProvince" maxLength={120} autoComplete="address-level2" placeholder="e.g. Cebu City, Cebu" defaultValue={extras?.cityProvince ?? ''} disabled={!initialExtras?.fieldsReady} className={accountInputClass} /></label>
          <label>Preferred Consultation Language<select name="preferredLanguage" defaultValue={extras?.preferredLanguage ?? ''} disabled={!initialExtras?.fieldsReady} className={accountInputClass}>
            <option value="">No preference</option>
            {CONSULTATION_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select></label>
          <label>Preferred Contact Method<select name="contactMethod" defaultValue={extras?.contactMethod ?? ''} disabled={!initialExtras?.fieldsReady} className={accountInputClass}>
            <option value="">No preference</option>
            {CONTACT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select></label>
          <label>Best Time to Reach You<select name="contactTime" defaultValue={extras?.contactTime ?? ''} disabled={!initialExtras?.fieldsReady} className={accountInputClass}>
            <option value="">No preference</option>
            {CONTACT_TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select></label>
        </>}
      </fieldset>
      <p className="text-xs text-[#7D6855]">Your sign-in email and account role cannot be changed here.{showExtras && ' Lawyers you book see your location and contact preferences.'}</p>
      {account.role === 'lawyer' && <p className="text-xs text-[#7D6855]">Legal-name changes require credential verification. Please contact support.</p>}
      <div className="flex gap-3">
        <button disabled={pending} className={accountButtonClass}>{pending ? 'Saving…' : 'Save changes'}</button>
        <button type="button" disabled={pending} onClick={() => { setEditing(false); setError(''); }} className="px-3 py-2 text-xs text-[#5C4535] transition-colors hover:text-[#A8742E]">Cancel</button>
      </div>
    </form> : <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#E5D7C5] text-xs">
        {[
          ['Full Legal Name', account.fullName], ['Email Address', account.email],
          ['Account Role', role], ['Jurisdiction', 'Republic of the Philippines'],
          ...(account.phone ? [['Contact Number', account.phone]] : []),
          ...(showExtras && extras?.cityProvince ? [['City / Province', extras.cityProvince]] : []),
          ...(showExtras && extras?.preferredLanguage ? [['Consultation Language', extras.preferredLanguage]] : []),
          ...(showExtras && (extras?.contactMethod || extras?.contactTime)
            ? [['Contact Preference', [contactMethodLabel(extras?.contactMethod), contactTimeLabel(extras?.contactTime)].filter(Boolean).join(' · ')]]
            : []),
        ].map(([label, value]) => <div key={label} className="p-3 rounded-xl bg-[#E8DAC9]/50">
          <span className="text-[10px] uppercase font-bold text-[#7D6855] tracking-wider block">{label}</span>
          <span className="font-medium text-[#34150F] mt-1 block break-words select-text">{value}</span>
          {(label === 'Email Address' || label === 'Contact Number') && value && (
            <CopyButton key={value} value={value} label={label.toLowerCase()} />
          )}
        </div>)}
      </div>
      <button type="button" onClick={() => { setEditing(true); setMessage(''); }} className={accountButtonClass}>Edit profile</button>
    </>}
    {showExtras && initialExtras && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#E5D7C5] text-xs">
      <div className="p-3 rounded-xl bg-[#E8DAC9]/50">
        <span className="text-[10px] uppercase font-bold text-[#7D6855] tracking-wider block">Member Since</span>
        <span className="font-medium text-[#34150F] mt-1 block">{formatDate(initialExtras.summary.memberSince)}</span>
        <span className="text-[#7D6855] mt-1 block">
          {initialExtras.summary.consultationsCompleted} consultation{initialExtras.summary.consultationsCompleted === 1 ? '' : 's'} completed
          {' · '}{account.role === 'lawyer'
            ? `${initialExtras.summary.lawyersConsulted} client${initialExtras.summary.lawyersConsulted === 1 ? '' : 's'} served`
            : `${initialExtras.summary.lawyersConsulted} lawyer${initialExtras.summary.lawyersConsulted === 1 ? '' : 's'} consulted`}
          {initialExtras.summary.upcomingConsultations > 0 && ` · ${initialExtras.summary.upcomingConsultations} upcoming`}
        </span>
      </div>
      {completeness && <div className="p-3 rounded-xl bg-[#E8DAC9]/50">
        <span className="text-[10px] uppercase font-bold text-[#7D6855] tracking-wider block">Profile Completeness</span>
        <div className="mt-2 h-2 rounded-full bg-[#D6C4AE] overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completeness.percent} aria-label="Profile completeness">
          <div className="h-full rounded-full bg-[#C58B3C]" style={{ width: `${completeness.percent}%` }} />
        </div>
        <span className="text-[#7D6855] mt-1.5 block">
          {completeness.percent}% complete{completeness.missing.length ? ` · add your ${completeness.missing.slice(0, 2).join(' and ')}` : ''}
        </span>
      </div>}
    </div>}
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    {message && <p role="status" className="text-xs text-[#5C4535]">{message}</p>}
  </div>;
}
