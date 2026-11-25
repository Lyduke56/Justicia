'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { sendUserPasswordResetAction, updateUserRoleAction } from '@/app/actions/adminData';
import { ChevronRightIcon, NeuAlert, NeuButton, NeuModal } from '@/components/shared/neu';
import type { AdminUserAccount } from '@/types/admin';
import { stamp } from '../overview/activity';
import { CAPS } from '../table/kit';
import { ROLE_META, type UserRole } from './model';
import { AccountStandingPanel } from './AccountStandingPanel';

/**
 * Manage an account, in the shared neumorphic modal: its details, a role switch (the caramel
 * thumb glides to the chosen role; changing it asks for confirmation inside the dialog) and a
 * password reset email. Lawyers also get a link to their dossier.
 */

const ROLES: UserRole[] = ['client', 'lawyer', 'admin'];

const CONSEQUENCE: Record<UserRole, string> = {
  client: 'They will use the client portal and lose any lawyer or admin access.',
  lawyer: 'They will use the lawyer portal; they appear in Find a Lawyer only once their credentials are verified.',
  admin: 'They will get full access to this admin portal, including verification, accounts, reports and the audit log.',
};

const UserGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);

function Cell({ label, children, mono = false }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="admin-dossier-cell min-w-0 rounded-[14px] px-4 py-3">
      <dt className={`text-[9.5px] text-[#8A6A4C] ${CAPS}`}>{label}</dt>
      <dd className={`mt-1 text-[13.5px] font-semibold leading-snug text-[#341512] [overflow-wrap:anywhere] ${mono ? 'font-inter tabular-nums' : 'font-lora'}`}>{children}</dd>
    </div>
  );
}

export function UserAccountModal({ user, onClose, onRoleChanged }: { user: AdminUserAccount; onClose: () => void; onRoleChanged: () => Promise<void> }) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const changed = role !== user.role;
  const [now] = useState(() => Date.now());
  const joined = stamp(user.createdAt, now);
  const busy = saving || sending;

  const pick = (next: UserRole) => {
    setRole(next);
    setConfirming(false);
    setError(null);
    setNotice(null);
  };

  const saveRole = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await updateUserRoleAction(user.id, role);
      if (result.error) {
        setError(result.error);
        return;
      }
      await onRoleChanged();
      setConfirming(false);
      setNotice(`${user.fullName} is now ${role === 'admin' ? 'an administrator' : `a ${role}`}.`);
    } catch {
      setError('The role could not be changed. Please refresh and try again.');
    } finally {
      setSaving(false);
    }
  };

  const sendReset = async () => {
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const result = await sendUserPasswordResetAction(user.email);
      if (result.error) setError(result.error);
      else setNotice(`A password reset link was sent to ${user.email}.`);
    } catch {
      setError('The password reset email could not be sent.');
    } finally {
      setSending(false);
    }
  };

  return (
    <NeuModal
      onClose={onClose}
      dismissible={!busy}
      size="lg"
      title={user.fullName || 'Unnamed account'}
      subtitle={user.email}
      icon={<UserGlyph />}
      footer={
        confirming ? (
          <>
            <NeuButton onClick={() => setConfirming(false)} disabled={saving}>
              Back
            </NeuButton>
            <NeuButton variant="dark" loading={saving} onClick={saveRole}>
              {saving ? 'Changing…' : 'Confirm change'}
            </NeuButton>
          </>
        ) : (
          <>
            <NeuButton onClick={onClose} disabled={busy}>
              {changed ? 'Cancel' : 'Done'}
            </NeuButton>
            {changed && (
              <NeuButton variant="dark" disabled={busy} onClick={() => setConfirming(true)}>
                Change role
              </NeuButton>
            )}
          </>
        )
      }
    >
      <dl className="grid gap-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.3fr)]">
        <Cell label="Current role">
          <span className={`admin-pill ${ROLE_META[user.role].pill}`}>{ROLE_META[user.role].label}</span>
        </Cell>
        <Cell label="Joined" mono>
          {joined.date}, {joined.time}
        </Cell>
        <Cell label="Account ID" mono>
          <span className="text-[12px] font-medium">{user.id}</span>
        </Cell>
      </dl>

      <section aria-labelledby="user-role-label" className="flex flex-col gap-3">
        <p id="user-role-label" className={`text-[10px] text-[#B07A34] ${CAPS}`}>
          Role
        </p>
        <div role="radiogroup" aria-labelledby="user-role-label" className="client-neu-well grid grid-cols-3 gap-1 rounded-[14px] p-1">
          {ROLES.map((r) => {
            const active = role === r;
            return (
              <motion.button
                key={r}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={busy}
                onClick={() => pick(r)}
                whileTap={{ scale: 0.96 }}
                className={`relative isolate h-10 rounded-[11px] font-lora text-[13px] transition-colors disabled:cursor-not-allowed ${active ? 'font-bold text-[#341512]' : 'text-[#341512]/60 hover:text-[#341512]'}`}
              >
                {active && (
                  <motion.span
                    layoutId={`user-role-thumb-${user.id}`}
                    transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                    className="client-neu-thumb absolute inset-0 -z-10 rounded-[11px]"
                  />
                )}
                {ROLE_META[r].label}
                {r === user.role && <span className="sr-only"> (current)</span>}
              </motion.button>
            );
          })}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={role}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
            className="font-inter text-[12px] leading-relaxed text-[#5C4535]"
          >
            {ROLE_META[role].summary}
          </motion.p>
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {confirming && (
            <NeuAlert key="confirm" tone="warning" title={`Change ${user.fullName} from ${ROLE_META[user.role].label.toLowerCase()} to ${ROLE_META[role].label.toLowerCase()}?`}>
              {CONSEQUENCE[role]}
            </NeuAlert>
          )}
        </AnimatePresence>
      </section>

      <section aria-label="Account actions" className="neu-recessed divide-y divide-dotted divide-[#B8946E]/50 rounded-[18px]">
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <p className="font-inter text-[13px] font-semibold text-[#341512]">Password reset</p>
            <p className="mt-0.5 font-inter text-[11.5px] leading-relaxed text-[#7D6855]">Email a link to {user.email} so they can choose a new password.</p>
          </div>
          <NeuButton size="sm" loading={sending} disabled={saving} onClick={sendReset}>
            Send link
          </NeuButton>
        </div>
        {user.role !== 'admin' && <AccountStandingPanel userId={user.id} onChanged={() => void onRoleChanged()} />}
        {user.role === 'lawyer' && (
          <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-5">
            <div className="min-w-0">
              <p className="font-inter text-[13px] font-semibold text-[#341512]">Lawyer dossier</p>
              <p className="mt-0.5 font-inter text-[11.5px] leading-relaxed text-[#7D6855]">Credentials, rates and verification status.</p>
            </div>
            <Link
              href={`/admin/lawyers/${user.id}?from=users`}
              onClick={onClose}
              className="neu-raised-sm inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#E5D8CB] pl-4 pr-3 font-lora text-xs font-bold text-[#341512] transition-[translate,color] duration-200 hover:-translate-y-0.5 hover:text-[#A8742E]"
            >
              Open dossier
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </section>

      {(error || notice) && (
        <NeuAlert tone={error ? 'error' : 'success'} onDismiss={() => (error ? setError(null) : setNotice(null))}>
          {error ?? notice}
        </NeuAlert>
      )}
    </NeuModal>
  );
}

