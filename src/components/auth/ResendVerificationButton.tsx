'use client';

import { useEffect, useState, useTransition } from 'react';
import { resendVerificationEmailAction } from '@/app/actions/auth';

/**
 * "Resend verification email". Sends to the signed-in user's own address, or to `email`, or to
 * the address remembered right after sign-up. The answer never reveals whether an account exists.
 *
 * With `cooldownSeconds`, the button waits that long after a successful send before it can be
 * used again (the server also rate-limits; this just says so up front).
 */
export function ResendVerificationButton({
  email,
  className,
  messageClassName,
  label = 'Resend verification email',
  cooldownSeconds = 0,
}: {
  email?: string;
  className: string;
  messageClassName: string;
  label?: string;
  cooldownSeconds?: number;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(0);
  const remaining = cooldownUntil > now ? Math.ceil((cooldownUntil - now) / 1000) : 0;

  useEffect(() => {
    if (!cooldownUntil) return;
    const tick = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= cooldownUntil) clearInterval(tick);
    }, 1000);
    return () => clearInterval(tick);
  }, [cooldownUntil]);

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending || remaining > 0}
        className={className}
        onClick={() =>
          start(async () => {
            const res = await resendVerificationEmailAction(email ? { email } : undefined);
            setMessage(res.success ? { ok: true, text: res.message } : { ok: false, text: res.error });
            if (res.success && cooldownSeconds > 0) {
              const t = Date.now();
              setNow(t);
              setCooldownUntil(t + cooldownSeconds * 1000);
            }
          })
        }
      >
        {pending ? 'Sending…' : remaining > 0 ? `Resend in ${remaining}s` : label}
      </button>
      {message && (
        <span role={message.ok ? 'status' : 'alert'} className={messageClassName} data-tone={message.ok ? 'ok' : 'error'}>
          {message.text}
        </span>
      )}
    </span>
  );
}
