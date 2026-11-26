/**
 * The account type chosen in the role-selection modal. It travels to the sign-up screen in the
 * URL (`/register?role=lawyer`), becomes the form's hidden `role` field, and signUpAction
 * validates it again on the server.
 *
 * Plain module (no 'use client') so the /register server page can call parseSignUpRole.
 */
export type SignUpRole = 'client' | 'lawyer';

export const SIGN_UP_ROLE_LABEL: Record<SignUpRole, string> = { client: 'Client', lawyer: 'Lawyer' };

/** The role from a search param, or null when it's missing or not a known role. */
export function parseSignUpRole(value: string | string[] | undefined): SignUpRole | null {
  return value === 'client' || value === 'lawyer' ? value : null;
}

export function signUpHref(role: SignUpRole): string {
  return `/register?role=${role}`;
}
