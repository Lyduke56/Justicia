/**
 * Where to send someone after they sign in: the page they were trying to open (e.g. the link
 * in an email, which the proxy turns into /login?redirectTo=/client/messages?thread=…).
 *
 * Only a path on this site that the signed-in role may open is accepted. Anything else
 * (another site, "//evil.example", a page of another role, the auth pages) gives null, and the
 * caller falls back to the role's dashboard.
 */
import { isAuthorizedForRoute, type UserRole } from '@/lib/utils/rbac';

const BASE = 'http://justicia.invalid';

export function safeReturnPath(raw: unknown, role: UserRole): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 1024) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null;
  if (/[\u0000-\u001f\\]/.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE) return null;
  if (!isAuthorizedForRoute(role, url.pathname)) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
