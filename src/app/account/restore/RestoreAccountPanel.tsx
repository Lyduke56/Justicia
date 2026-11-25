'use client';

import { useState, useTransition } from 'react';
import { restoreAccountAction } from '@/app/actions/accountPrivacyActions';
import { signOutAction } from '@/app/actions/auth';

export function RestoreAccountPanel({ email, dueAt }: { email: string; dueAt: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const when = new Date(dueAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'long', timeStyle: 'short' });

  return (
    <div className="min-h-screen bg-[#EFE5D8] py-16 px-4">
      <div
        className="max-w-lg mx-auto rounded-2xl p-6 sm:p-8 bg-[#EFE5D8] space-y-5"
        style={{ boxShadow: '8px 8px 20px rgba(0,0,0,0.07),-8px -8px 20px rgba(255,255,255,0.95)' }}
      >
        <h1 className="font-cormorant text-3xl font-bold text-[#34150F]">Your account is scheduled for deletion</h1>
        <p className="text-sm text-[#5C4535] leading-relaxed">
          You asked us to delete the Justicia account for <strong className="text-[#34150F]">{email}</strong>. Your personal data
          will be erased on <strong className="text-[#34150F]">{when} (PHT)</strong>.
        </p>
        <p className="text-sm text-[#5C4535] leading-relaxed">
          Restore it now to keep using Justicia with everything as it was. If you do nothing, the deletion goes ahead.
        </p>
        {error && <p role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap gap-3 pt-1">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError('');
                const res = await restoreAccountAction();
                if (!res.success) setError(res.error);
                else window.location.assign(res.redirectTo);
              })
            }
            className="px-6 py-2.5 rounded-xl bg-[#34150F] text-white text-sm font-semibold hover:bg-[#23150F] transition-colors disabled:opacity-60 shadow-md"
          >
            {pending ? 'Restoring…' : 'Restore my account'}
          </button>
          <form action={signOutAction}>
            <button
              type="submit"
              disabled={pending}
              className="px-5 py-2.5 rounded-xl border border-[#D8CAAD] text-[#5C4535] text-sm font-medium hover:bg-[#E5D7C5] transition-colors"
            >
              Keep it deleted and sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
