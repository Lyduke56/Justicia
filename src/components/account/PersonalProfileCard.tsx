'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserCircleIcon } from '@/components/client/ClientIcons';
import { updatePersonalAccountAction, type PersonalAccount } from '@/app/actions/accountActions';

export const accountInputClass = 'mt-1 block w-full rounded-lg border border-[#D6C4AE] bg-[#EFE5D8] px-3 py-2 text-xs text-[#34150F] outline-none focus:border-[#C58B3C] focus:ring-1 focus:ring-[#C58B3C]';
export const accountButtonClass = 'rounded-lg bg-[#34150F] px-4 py-2 text-xs font-medium text-[#EFE5D8] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C58B3C]';

export function PersonalProfileCard({ account }: { account: PersonalAccount }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const role = account.role[0].toUpperCase() + account.role.slice(1);

  return <div className="rounded-3xl p-8 bg-[#EFE5D8] shadow-[6px_6px_16px_rgba(0,0,0,0.06),-6px_-6px_16px_rgba(255,255,255,0.85)] border border-[#E8DCCB]/60 space-y-6">
    <div className="flex items-center gap-5">
      <div className="w-16 h-16 shrink-0 rounded-full border-2 border-[#5C4535]/80 flex items-center justify-center text-[#5C4535] bg-[#EAE0D2]">
        <UserCircleIcon className="w-10 h-10" />
      </div>
      <div className="min-w-0">
        <h2 className="font-cormorant font-bold text-xl text-[#34150F] break-words">{account.fullName}</h2>
        <p className="text-xs text-[#7D6855] break-all">{account.email}</p>
        <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-[#E5D7C5] text-[#34150F] text-[10px] font-semibold">
          {account.emailVerified ? 'Email Verified' : 'Email Unverified'} · {role} Account
        </span>
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
          setMessage(result.message); setEditing(false); router.refresh();
        } catch { setError('Unable to save your profile. Please try again.'); }
      });
    }} className="space-y-4 pt-4 border-t border-[#E5D7C5]">
      <fieldset disabled={pending} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#7D6855]">
        <label>Full Legal Name<input name="fullName" required maxLength={120} autoComplete="name" readOnly={account.role === 'lawyer'} defaultValue={account.fullName} className={accountInputClass} /></label>
        <label>Contact Number<input name="phone" type="tel" maxLength={30} autoComplete="tel" defaultValue={account.phone} className={accountInputClass} /></label>
      </fieldset>
      <p className="text-xs text-[#7D6855]">Your sign-in email and account role cannot be changed here.</p>
      {account.role === 'lawyer' && <p className="text-xs text-[#7D6855]">Legal-name changes require credential verification. Please contact support.</p>}
      <div className="flex gap-3">
        <button disabled={pending} className={accountButtonClass}>{pending ? 'Saving…' : 'Save changes'}</button>
        <button type="button" disabled={pending} onClick={() => { setEditing(false); setError(''); }} className="px-3 py-2 text-xs text-[#5C4535]">Cancel</button>
      </div>
    </form> : <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#E5D7C5] text-xs">
        {[
          ['Full Legal Name', account.fullName], ['Email Address', account.email],
          ['Account Role', role], ['Jurisdiction', 'Republic of the Philippines'],
          ...(account.phone ? [['Contact Number', account.phone]] : []),
        ].map(([label, value]) => <div key={label} className="p-3 rounded-xl bg-[#E8DAC9]/50">
          <span className="text-[10px] uppercase font-bold text-[#7D6855] tracking-wider block">{label}</span>
          <span className="font-medium text-[#34150F] mt-1 block break-words">{value}</span>
        </div>)}
      </div>
      <button type="button" onClick={() => { setEditing(true); setMessage(''); }} className={accountButtonClass}>Edit profile</button>
    </>}
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    {message && <p role="status" className="text-xs text-[#5C4535]">{message}</p>}
  </div>;
}
