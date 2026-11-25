'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { NeuAlert, NeuButton } from '@/components/shared/neu';
import {
  adminReinstateAccountAction,
  adminSuspendAccountAction,
  adminTerminateAccountAction,
  getAccountStandingAction,
  type AccountStandingView,
  type AdminSuspensionLength,
} from '@/app/actions/adminAccountActions';
import { CAPS } from '../table/kit';

/**
 * Account standing for one user (admin): current status, and suspend / reinstate / terminate.
 * Each action expands inline (like the password form in Settings) and asks for the reason the
 * user will see; terminating also asks for the admin's password. Used in the Users modal and the
 * lawyer dossier.
 */

const LENGTH_OPTIONS: Array<{ value: AdminSuspensionLength; label: string }> = [
  { value: 3, label: '3 days' },
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 0, label: 'Until reinstated' },
];

type Mode = 'suspend' | 'reinstate' | 'terminate' | null;

function formatUntil(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  // "Until reinstated" suspensions end years from now.
  if (d.getTime() - Date.now() > 3 * 365 * 86_400_000) return 'until an admin reinstates it';
  return `until ${d.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
}

function statusLine(standing: AccountStandingView): string {
  switch (standing.status) {
    case 'suspended':
      return `Suspended ${formatUntil(standing.suspendedUntil)}.`;
    case 'terminated':
      return 'Permanently terminated. The user cannot sign in.';
    case 'pending_deletion':
      return 'The owner asked to delete this account; it is scheduled for deletion.';
    default:
      return 'Active. The user can sign in and use Justicia.';
  }
}

export function AccountStandingPanel({ userId, onChanged }: { userId: string; onChanged?: () => void }) {
  const [standing, setStanding] = useState<AccountStandingView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [reason, setReason] = useState('');
  const [length, setLength] = useState<AdminSuspensionLength>(7);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const apply = useCallback((res: Awaited<ReturnType<typeof getAccountStandingAction>> | null) => {
    if (!res || !res.success) setLoadError(res?.error ?? 'The account standing could not be loaded.');
    else {
      setLoadError(null);
      setStanding(res.standing);
    }
  }, []);

  const load = useCallback(async () => {
    apply(await getAccountStandingAction(userId).catch(() => null));
  }, [userId, apply]);

  useEffect(() => {
    let cancelled = false;
    void getAccountStandingAction(userId)
      .catch(() => null)
      .then((res) => {
        if (!cancelled) apply(res);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, apply]);

  const close = () => {
    setMode(null);
    setReason('');
    setPassword('');
    setError(null);
  };

  const submit = async () => {
    if (!mode) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res =
        mode === 'suspend'
          ? await adminSuspendAccountAction({ userId, reason, length })
          : mode === 'reinstate'
            ? await adminReinstateAccountAction({ userId, reason })
            : await adminTerminateAccountAction({ userId, reason, password });
      if (!res.success) {
        setError(res.error);
        return;
      }
      // Reload first so the status line and the message change together.
      await load();
      setNotice(res.message);
      close();
      onChanged?.();
    } catch {
      setError('The change could not be saved. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <p className="font-inter text-[12px] text-[#9A3B2E]">{loadError}</p>
        <NeuButton size="sm" onClick={() => void load()}>
          Retry
        </NeuButton>
      </div>
    );
  }

  const isAdmin = standing?.role === 'admin';
  const canSuspend = standing && !isAdmin && (standing.status === 'active' || standing.status === 'suspended');
  const canReinstate = standing && !isAdmin && standing.status === 'suspended';
  const canTerminate = standing && !isAdmin && standing.status !== 'terminated' && standing.status !== 'pending_deletion';
  const reasonOk = reason.trim().length >= 10;
  const ready = mode === 'terminate' ? reasonOk && password.length > 0 : reasonOk;

  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-inter text-[13px] font-semibold text-[#341512]">Account standing</p>
          <p className="mt-0.5 font-inter text-[11.5px] leading-relaxed text-[#7D6855]">
            {standing ? statusLine(standing) : 'Loading…'}
            {standing && standing.suspensionCount > 0 && ` ${standing.suspensionCount} report-based suspension${standing.suspensionCount === 1 ? '' : 's'} on record.`}
            {isAdmin && ' Administrator accounts are managed by changing the role.'}
          </p>
        </div>
        {!mode && standing && !isAdmin && (
          <div className="flex flex-wrap gap-2">
            {canReinstate && (
              <NeuButton size="sm" onClick={() => setMode('reinstate')}>
                Reinstate
              </NeuButton>
            )}
            {canSuspend && (
              <NeuButton size="sm" onClick={() => setMode('suspend')}>
                {standing.status === 'suspended' ? 'Extend' : 'Suspend'}
              </NeuButton>
            )}
            {canTerminate && (
              <NeuButton size="sm" variant="danger" onClick={() => setMode('terminate')}>
                Terminate
              </NeuButton>
            )}
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {mode && (
          <motion.div
            key={mode}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 pt-4">
              {mode === 'suspend' && (
                <div className="flex flex-col gap-2">
                  <p className={`text-[10px] text-[#B07A34] ${CAPS}`}>Length</p>
                  <div role="radiogroup" aria-label="Suspension length" className="flex flex-wrap gap-2">
                    {LENGTH_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={length === opt.value}
                        onClick={() => setLength(opt.value)}
                        className={`h-8 rounded-[10px] px-3 font-inter text-[11.5px] font-semibold transition-colors ${
                          length === opt.value ? 'client-neu-thumb text-[#341512]' : 'neu-raised-sm bg-[#E5D8CB] text-[#341512]/70 hover:text-[#341512]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <label className="flex flex-col gap-2">
                <span className={`text-[10px] text-[#B07A34] ${CAPS}`}>
                  {mode === 'reinstate' ? 'Why is the suspension ending?' : 'Reason shown to the user'}
                </span>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={busy}
                  placeholder={mode === 'reinstate' ? 'e.g. Appeal reviewed; the report was not upheld.' : 'e.g. Repeated off-platform payment requests to clients.'}
                  className="lawyer-field min-h-[80px] w-full resize-y rounded-[12px] px-3.5 py-3 font-inter text-[12.5px] leading-relaxed text-[#341512] placeholder:text-[#9E8E7D] focus:outline-none"
                />
                <span className="font-inter text-[11px] text-[#7D6855]">At least 10 characters. Saved in the security audit log.</span>
              </label>
              {mode === 'terminate' && (
                <label className="flex flex-col gap-2">
                  <span className={`text-[10px] text-[#B07A34] ${CAPS}`}>Your password</span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={busy}
                    className="lawyer-field h-10 w-full rounded-[12px] px-3.5 font-inter text-[12.5px] text-[#341512] focus:outline-none"
                  />
                  <span className="font-inter text-[11px] text-[#7D6855]">Termination is permanent. Confirm it with your admin password.</span>
                </label>
              )}
              {error && <NeuAlert tone="error">{error}</NeuAlert>}
              <div className="flex flex-wrap gap-2.5">
                <NeuButton size="sm" variant={mode === 'terminate' ? 'danger' : 'dark'} loading={busy} disabled={!ready} onClick={() => void submit()}>
                  {mode === 'suspend' ? 'Suspend account' : mode === 'reinstate' ? 'Reinstate account' : 'Terminate account'}
                </NeuButton>
                <NeuButton size="sm" disabled={busy} onClick={close}>
                  Cancel
                </NeuButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {notice && !mode && (
        <div className="pt-3">
          <NeuAlert tone="success" onDismiss={() => setNotice(null)}>
            {notice}
          </NeuAlert>
        </div>
      )}
    </div>
  );
}
