/**
 * Demo mode (the `?demo=client|lawyer` sample portals used for local design checks).
 *
 * It is a development convenience only: it never runs in a production build, and only when the
 * server-only env flag `JUSTICIA_DEMO=true` is set. A demo cookie never grants access to `/api/*`
 * or to the admin portal, and never implies a real role.
 */
export const DEMO_COOKIE = 'justicia_demo_session';

export type DemoRole = 'client' | 'lawyer';

export function isDemoEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.JUSTICIA_DEMO === 'true';
}

/** True when demo mode is on and the cookie value opens the given sample portal. */
export function isDemoFor(cookieValue: string | null | undefined, role: DemoRole): boolean {
  if (!isDemoEnabled() || !cookieValue) return false;
  return cookieValue === role || cookieValue === 'true';
}
