/**
 * Where the lawyer dossier was opened from (`?from=` on its URL), so its back button returns
 * there. Shared by the server page (which reads the param) and the client view (which renders
 * the button), so it lives outside the 'use client' module.
 */
export const DOSSIER_BACK = {
  directory: { label: 'Lawyer directory', href: '/admin/lawyers' },
  queue: { label: 'Verification queue', href: '/admin/lawyers/verification-queue' },
  overview: { label: 'Overview', href: '/admin/dashboard' },
  users: { label: 'User accounts', href: '/admin/users' },
  audit: { label: 'Audit log', href: '/admin/settings/security-audit-log' },
} as const;

export type DossierOrigin = keyof typeof DOSSIER_BACK;

/** The origin named by `?from=`, or the lawyer directory when it is missing or unknown. */
export const dossierOrigin = (from: string | undefined): DossierOrigin =>
  from && Object.hasOwn(DOSSIER_BACK, from) ? (from as DossierOrigin) : 'directory';
