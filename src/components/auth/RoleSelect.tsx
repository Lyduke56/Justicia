'use client';

/**
 * The "How would you like to join Justicia?" step that comes before the sign-up screen.
 *
 *  - RoleSelectPanel: the header and the two account types. Each option is a link to
 *    /register?role=…, so the choice travels to the sign-up screen in the URL.
 *  - RoleSelectModal: the panel in an AuthDialog (navbar "Sign up", /login, and /register when
 *    it's opened without a role). The landing page's sign-in dialog shows the panel in place.
 */
import React from 'react';
import Link, { useLinkStatus } from 'next/link';
import { AuthDialog, AuthPanelHeader } from './AuthPanel';
import { ArrowRightIcon, AuthPanelHeaderIcon, authFormFooterClass, authLinkClass } from './AuthFields';
import { SIGN_UP_ROLE_LABEL, signUpHref, type SignUpRole } from './signUpRole';

const ROLE_OPTIONS: { value: SignUpRole; description: string; icon: React.ReactNode }[] = [
  {
    value: 'client',
    description: 'For individuals seeking legal assistance, consultations, and access to qualified lawyers.',
    icon: (
      // A person with a speech bubble: someone looking for help.
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="9" cy="9" r="3.4" />
        <path d="M2.5 20.5c0-3.5 2.9-5.9 6.5-5.9s6.5 2.4 6.5 5.9" />
        <path d="M15 3h5.5A1.5 1.5 0 0 1 22 4.5v3A1.5 1.5 0 0 1 20.5 9H19l-2 1.8V9h-2a1.5 1.5 0 0 1-1.5-1.5v-3A1.5 1.5 0 0 1 15 3Z" />
      </svg>
    ),
  },
  {
    value: 'lawyer',
    description: 'For legal professionals who want to offer their services, manage consultations, and connect with potential clients.',
    icon: (
      // The scales of justice.
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0L5 7Zm14 0-3 7a3 3 0 0 0 6 0l-3-7Z" />
      </svg>
    ),
  },
];

/** Arrow at the end of an option; a spinner while its page is loading. */
function OptionArrow() {
  const { pending } = useLinkStatus();
  return pending ? (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ) : (
    <ArrowRightIcon className="h-4 w-4" />
  );
}

export interface RoleSelectPanelProps {
  titleId: string;
  /** Replace the history entry instead of adding one (when already on /register). */
  replace?: boolean;
  /** "Sign in" in the footer: a callback (e.g. switch the dialog's view); by default a link to /login. */
  onSignIn?: () => void;
}

export function RoleSelectPanel({ titleId, replace = false, onSignIn }: RoleSelectPanelProps) {
  return (
    <>
      <AuthPanelHeader
        titleId={titleId}
        icon={<AuthPanelHeaderIcon kind="join" />}
        title="How would you like to join Justicia?"
        subtitle="Choose the account type that best describes how you intend to use our platform."
      />

      <ul className="mt-7 flex flex-col gap-3.5" aria-label="Account types">
        {ROLE_OPTIONS.map((r) => {
          const label = SIGN_UP_ROLE_LABEL[r.value];
          const descId = `${titleId}-${r.value}-desc`;
          return (
            <li key={r.value}>
              {/* Recessed at rest; rises with the caramel tint on hover, like the portal's cards. */}
              <Link
                href={signUpHref(r.value)}
                replace={replace}
                aria-label={`Sign up as a ${label}`}
                aria-describedby={descId}
                className="neu-card-recessed-to-rise group flex items-center gap-4 rounded-[18px] p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#C58B3C]/70 sm:px-5"
              >
                <span className="neu-raised-sm grid size-12 shrink-0 place-items-center rounded-[14px] text-[#B9833C] transition-colors duration-300 group-hover:bg-[#431407]! group-hover:text-[#F3E6D6] group-focus-visible:bg-[#431407]! group-focus-visible:text-[#F3E6D6]">
                  {r.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-lora text-[17px] font-semibold leading-tight text-[#34150F]">{label}</span>
                  <span id={descId} className="mt-1 block text-pretty font-inter text-[12.5px] leading-snug text-[#6E5545]">
                    {r.description}
                  </span>
                </span>
                <span className="shrink-0 text-[#9A8270] transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:text-[#431407]">
                  <OptionArrow />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className={`mt-7 ${authFormFooterClass}`}>
        Already have an account?{' '}
        {onSignIn ? (
          <button type="button" onClick={onSignIn} className={authLinkClass}>
            Sign in
          </button>
        ) : (
          <Link href="/login" className={authLinkClass}>
            Sign in
          </Link>
        )}
      </p>
    </>
  );
}

const TITLE_ID = 'role-select-dialog-title';

export interface RoleSelectModalProps extends Omit<RoleSelectPanelProps, 'titleId'> {
  open: boolean;
  onClose: () => void;
}

export function RoleSelectModal({ open, onClose, ...panel }: RoleSelectModalProps) {
  return (
    <AuthDialog open={open} onClose={onClose} labelledBy={TITLE_ID}>
      <RoleSelectPanel titleId={TITLE_ID} {...panel} />
    </AuthDialog>
  );
}
