'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { changeAccountPasswordAction, type PersonalAccount } from '@/app/actions/accountActions';
import { ResendVerificationButton } from '@/components/auth/ResendVerificationButton';
import { LEGAL_DOCUMENTS } from '@/lib/legal';
import { SignOutConfirmModal } from '@/components/shared/SignOutConfirmModal';
import { accountInputClass, accountButtonClass } from './PersonalProfileCard';
import {
  NOTIFICATION_ROWS,
  PRIVACY_ROWS,
  formatConsentDate,
  useConsent,
  useDataExport,
  useDeleteAccount,
  usePreferenceToggles,
} from './useAccountControls';

const cardClass = 'rounded-2xl p-6 bg-[#EFE5D8] shadow-[5px_5px_12px_rgba(0,0,0,0.06),-5px_-5px_12px_rgba(255,255,255,0.85)] border border-[#E8DCCB]/60 space-y-4';
const quietButtonClass = 'rounded-lg border border-[#D6C4AE] px-4 py-2 text-xs font-medium text-[#34150F] transition-colors hover:bg-[#E5D7C5] disabled:opacity-50';
const dangerButtonClass = 'rounded-lg bg-[#9A3B2E] px-4 py-2 text-xs font-medium text-[#F7EDE3] transition-colors hover:bg-[#7F2F25] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C58B3C]';

export function AccountSettings({ account }: { account: PersonalAccount }) {
  const prefs = usePreferenceToggles(account);
  const [signOutAllOpen, setSignOutAllOpen] = useState(false);
  const consent = useConsent();
  const dataExport = useDataExport();
  const deletion = useDeleteAccount();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [changing, startChanging] = useTransition();
  const [passwordError, setPasswordError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  return <div className="space-y-6">
    {account.role !== 'admin' && <div className={cardClass}>
      <h3 className="font-cormorant font-bold text-lg text-[#34150F]">Notifications</h3>
      <div className="space-y-3 text-xs text-[#5C4535]">
        {NOTIFICATION_ROWS.map((row, i) => (
          <label key={row.key} className={`flex items-center justify-between cursor-pointer py-1 gap-3 ${i > 0 ? 'border-t border-[#E5D7C5]' : ''}`}>
            <span>In-app: {row.title.toLowerCase()} <span className="text-[#7D6855]">({row.description.replace(/\.$/, '').toLowerCase()})</span></span>
            <input type="checkbox" checked={prefs.notifications[row.key]} disabled={prefs.saving} onChange={(event) => prefs.toggleNotification(row.key, event.target.checked)} className="accent-[#C58B3C] w-4 h-4 rounded" />
          </label>
        ))}
        <label className="flex items-center justify-between cursor-pointer py-1 border-t border-[#E5D7C5] gap-3">
          <span>Email updates <span className="text-[#7D6855]">(also send the updates turned on above to {account.email})</span></span>
          <input type="checkbox" checked={prefs.emailUpdates} disabled={prefs.saving} onChange={(event) => prefs.toggleEmailUpdates(event.target.checked)} className="accent-[#C58B3C] w-4 h-4 rounded" />
        </label>
        <label className="flex items-center justify-between py-1 border-t border-[#E5D7C5] gap-3">
          <span>SMS alerts for urgent hearing notices <span className="text-[#7D6855]">(not available yet)</span></span>
          <input type="checkbox" checked={false} disabled className="accent-[#C58B3C] w-4 h-4 rounded" />
        </label>
      </div>
      <p className="text-xs text-[#7D6855]">Changes save automatically. Account security and moderation notices remain available.</p>
      {prefs.saving && <p role="status" className="text-xs text-[#7D6855]">Saving…</p>}
      {prefs.error && <p role="alert" className="text-xs text-red-700">{prefs.error}</p>}
      {!prefs.saving && prefs.savedTick > 0 && <p role="status" className="text-xs text-[#5C4535]">Your preferences have been saved.</p>}
    </div>}
    {account.role !== 'admin' && <div className={cardClass}>
      <h3 className="font-cormorant font-bold text-lg text-[#34150F]">Messaging Privacy</h3>
      <div className="space-y-3 text-xs text-[#5C4535]">
        {PRIVACY_ROWS.map((row, i) => (
          <label key={row.key} className={`flex items-center justify-between cursor-pointer py-1 gap-3 ${i > 0 ? 'border-t border-[#E5D7C5]' : ''}`}>
            <span>{row.title} <span className="text-[#7D6855]">({row.description})</span></span>
            <input type="checkbox" checked={prefs.messaging[row.key]} disabled={prefs.saving} onChange={(event) => prefs.toggleMessaging(row.key, event.target.checked)} className="accent-[#C58B3C] w-4 h-4 rounded" />
          </label>
        ))}
      </div>
    </div>}
    <div className={cardClass}>
      <h3 className="font-cormorant font-bold text-lg text-[#34150F]">Security &amp; Session</h3>
      <p className="text-xs text-[#7D6855]">Your session automatically expires after 30 minutes of inactivity for client confidentiality.</p>
      <div className="pt-2"><span className="inline-block px-3 py-1.5 rounded-lg bg-[#E5D7C5] text-[#34150F] text-xs font-medium">🔒 Inactivity Protection: Active (30 mins)</span></div>
      {!account.emailVerified && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5D7C5] pt-3 text-xs text-[#5C4535]">
        <span>Your email address is not verified yet.</span>
        <ResendVerificationButton className={quietButtonClass} messageClassName="text-xs text-[#5C4535]" />
      </div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5D7C5] pt-3 text-xs text-[#5C4535]">
        <span>Sign out on every device and browser, including this one.</span>
        <button type="button" onClick={() => setSignOutAllOpen(true)} className={quietButtonClass}>Sign out everywhere</button>
      </div>
      {!passwordOpen ? <button type="button" onClick={() => { setPasswordOpen(true); setPasswordMessage(''); }} className={accountButtonClass}>Change password</button> : <form onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPasswordError(''); setPasswordMessage('');
        startChanging(async () => {
          try {
            const result = await changeAccountPasswordAction({ currentPassword: String(form.get('currentPassword') ?? ''), password: String(form.get('password') ?? ''), confirmPassword: String(form.get('confirmPassword') ?? '') });
            if (!result.success) { setPasswordError(result.error); return; }
            setPasswordMessage(result.message); setPasswordOpen(false);
          } catch { setPasswordError('Unable to change your password. Please try again.'); }
        });
      }} className="space-y-4">
        <fieldset disabled={changing} className="space-y-3 text-xs text-[#5C4535]">
          <label className="block">Current password<input name="currentPassword" type="password" required maxLength={256} autoComplete="current-password" className={accountInputClass} /></label>
          <label className="block">New password<input name="password" type="password" required minLength={8} maxLength={256} autoComplete="new-password" className={accountInputClass} /></label>
          <label className="block">Confirm new password<input name="confirmPassword" type="password" required minLength={8} maxLength={256} autoComplete="new-password" className={accountInputClass} /></label>
        </fieldset>
<div className="flex gap-3"><button disabled={changing} className={accountButtonClass}>{changing ? 'Updating…' : 'Update password'}</button><button type="button" disabled={changing} onClick={() => { setPasswordOpen(false); setPasswordError(''); }} className="text-xs text-[#5C4535] transition-colors hover:text-[#A8742E]">Cancel</button></div>
        <Link href="/forgot-password" className="inline-block text-xs text-[#946525] underline">Forgot password?</Link>
      </form>}
      {passwordError && <p role="alert" className="text-xs text-red-700">{passwordError}</p>}
      {passwordMessage && <p role="status" className="text-xs text-[#5C4535]">{passwordMessage}</p>}
    </div>
    <div className={cardClass}>
      <h3 className="font-cormorant font-bold text-lg text-[#34150F]">Privacy &amp; Your Data</h3>
      <div className="space-y-2 text-xs text-[#5C4535]">
        <p>
          {consent.consent?.current && consent.consent.acceptedAt
            ? `You accepted the current terms and policies on ${formatConsentDate(consent.consent.acceptedAt)}.`
            : 'Please review and accept the current terms and policies.'}
          {' '}{LEGAL_DOCUMENTS.map((doc, i) => <span key={doc.href}>{i > 0 && ' · '}<Link href={doc.href} target="_blank" className="text-[#946525] underline">{doc.title}</Link></span>)}
        </p>
        {consent.consent && !consent.consent.current && <button type="button" disabled={consent.pending} onClick={consent.accept} className={quietButtonClass}>{consent.pending ? 'Saving…' : 'Accept current versions'}</button>}
        {consent.error && <p role="alert" className="text-xs text-red-700">{consent.error}</p>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5D7C5] pt-3 text-xs text-[#5C4535]">
        <span>Download a copy of your data (JSON). Once a day.</span>
        <button type="button" disabled={dataExport.pending} onClick={() => void dataExport.run()} className={quietButtonClass}>{dataExport.pending ? 'Preparing…' : 'Download my data'}</button>
      </div>
      {dataExport.message && <p role={dataExport.message.ok ? 'status' : 'alert'} className={`text-xs ${dataExport.message.ok ? 'text-[#5C4535]' : 'text-red-700'}`}>{dataExport.message.text}</p>}
      <div className="border-t border-[#E5D7C5] pt-3 space-y-3 text-xs text-[#5C4535]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>Delete your account. Your personal data is erased after 7 days; sign in before then to undo it.</span>
          {!deletion.open && <button type="button" onClick={() => deletion.setOpen(true)} className={dangerButtonClass}>Delete my account</button>}
        </div>
        {deletion.open && <form onSubmit={(event) => { event.preventDefault(); if (deletion.ready) deletion.submit(); }} className="space-y-3">
          <p className="text-[#7D6855]">You can’t delete your account while you have upcoming consultations. Your profile leaves Find a Lawyer immediately and you are signed out on every device.</p>
          <fieldset disabled={deletion.pending} className="space-y-3">
            <label className="block">Your password<input type="password" required autoComplete="current-password" value={deletion.password} onChange={(e) => deletion.setPassword(e.target.value)} className={accountInputClass} /></label>
            <label className="block">Type DELETE to confirm<input required autoComplete="off" value={deletion.confirmation} onChange={(e) => deletion.setConfirmation(e.target.value)} className={accountInputClass} /></label>
          </fieldset>
          {deletion.error && <p role="alert" className="text-xs text-red-700">{deletion.error}</p>}
<div className="flex gap-3"><button disabled={deletion.pending || !deletion.ready} className={dangerButtonClass}>{deletion.pending ? 'Deleting…' : 'Delete my account'}</button><button type="button" disabled={deletion.pending} onClick={deletion.reset} className="text-xs text-[#5C4535] transition-colors hover:text-[#A8742E]">Cancel</button></div>
        </form>}
      </div>
    </div>
    <SignOutConfirmModal open={signOutAllOpen} onClose={() => setSignOutAllOpen(false)} everywhere />
  </div>;
}
