'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { changeAccountPasswordAction, updateAccountPreferencesAction, type PersonalAccount } from '@/app/actions/accountActions';
import { accountInputClass, accountButtonClass } from './PersonalProfileCard';

const cardClass = 'rounded-2xl p-6 bg-[#EFE5D8] shadow-[5px_5px_12px_rgba(0,0,0,0.06),-5px_-5px_12px_rgba(255,255,255,0.85)] border border-[#E8DCCB]/60 space-y-4';

export function AccountSettings({ account }: { account: PersonalAccount }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(account.consultationNotifications);
  const [saving, startSaving] = useTransition();
  const [preferenceError, setPreferenceError] = useState('');
  const [preferenceMessage, setPreferenceMessage] = useState('');
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [changing, startChanging] = useTransition();
  const [passwordError, setPasswordError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  return <div className="space-y-6">
    {account.role !== 'admin' && <div className={cardClass}>
      <h3 className="font-cormorant font-bold text-lg text-[#34150F]">Notifications</h3>
      <div className="space-y-3 text-xs text-[#5C4535]">
        <label className="flex items-center justify-between py-1 gap-3">
          <span>Email updates for scheduled attorney consultations <span className="text-[#7D6855]">(not available yet)</span></span>
          <input type="checkbox" checked={false} disabled className="accent-[#C58B3C] w-4 h-4 rounded" />
        </label>
        <label className="flex items-center justify-between cursor-pointer py-1 border-t border-[#E5D7C5] gap-3">
          <span>In-app notifications for consultation updates</span>
          <input type="checkbox" checked={notifications} disabled={saving} onChange={(event) => {
            const next = event.target.checked;
            setPreferenceError(''); setPreferenceMessage('');
            startSaving(async () => {
              try {
                const result = await updateAccountPreferencesAction({ consultationNotifications: next });
                if (!result.success) { setPreferenceError(result.error); return; }
                setNotifications(next); setPreferenceMessage(result.message); router.refresh();
              } catch { setPreferenceError('Unable to save preferences. Please try again.'); }
            });
          }} className="accent-[#C58B3C] w-4 h-4 rounded" />
        </label>
        <label className="flex items-center justify-between py-1 border-t border-[#E5D7C5] gap-3">
          <span>SMS alerts for urgent hearing notices <span className="text-[#7D6855]">(not available yet)</span></span>
          <input type="checkbox" checked={false} disabled className="accent-[#C58B3C] w-4 h-4 rounded" />
        </label>
      </div>
      <p className="text-xs text-[#7D6855]">Changes save automatically. Account security and moderation notices remain available.</p>
      {saving && <p role="status" className="text-xs text-[#7D6855]">Saving…</p>}
      {preferenceError && <p role="alert" className="text-xs text-red-700">{preferenceError}</p>}
      {preferenceMessage && <p role="status" className="text-xs text-[#5C4535]">{preferenceMessage}</p>}
    </div>}
    <div className={cardClass}>
      <h3 className="font-cormorant font-bold text-lg text-[#34150F]">Security &amp; Session</h3>
      <p className="text-xs text-[#7D6855]">Your session automatically expires after 30 minutes of inactivity for client confidentiality.</p>
      <div className="pt-2"><span className="inline-block px-3 py-1.5 rounded-lg bg-[#E5D7C5] text-[#34150F] text-xs font-medium">🔒 Inactivity Protection: Active (30 mins)</span></div>
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
        <div className="flex gap-3"><button disabled={changing} className={accountButtonClass}>{changing ? 'Updating…' : 'Update password'}</button><button type="button" disabled={changing} onClick={() => { setPasswordOpen(false); setPasswordError(''); }} className="text-xs text-[#5C4535]">Cancel</button></div>
        <Link href="/forgot-password" className="inline-block text-xs text-[#946525] underline">Forgot password?</Link>
      </form>}
      {passwordError && <p role="alert" className="text-xs text-red-700">{passwordError}</p>}
      {passwordMessage && <p role="status" className="text-xs text-[#5C4535]">{passwordMessage}</p>}
    </div>
  </div>;
}
