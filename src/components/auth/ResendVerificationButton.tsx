'use client';

import { useState, useTransition } from 'react';
import { resendVerificationEmailAction } from '@/app/actions/auth';

/**
 * "Resend verification email". Sends to the signed-in user's own address, or to `email`, or to
 * the address remembered right after sign-up. The answer never reveals whether an account exists.
 */
export function ResendVerificationButton({
  email,
  className,
  messageClassName,
  label = 'Resend verification email',
}: {
  email?: string;
  className: string;
  messageClassName: string;
  label?: string;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        className={className}
        onClick={() =>
          start(async () => {
            const res = await resendVerificationEmailAction(email ? { email } : undefined);
            setMessage(res.success ? { ok: true, text: res.message } : { ok: false, text: res.error });
          })
        }
      >
        {pending ? 'Sending…' : label}
      </button>
      {message && (
        <span role={message.ok ? 'status' : 'alert'} className={messageClassName}>
          {message.text}
        </span>
      )}
    </span>
  );
}
