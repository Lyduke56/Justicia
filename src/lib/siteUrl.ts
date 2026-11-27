/**
 * The public address of the site, for links that leave the app: buttons and links in emails,
 * and the redirect addresses Supabase puts in password-reset links.
 *
 * Read from NEXT_PUBLIC_APP_URL, then NEXT_PUBLIC_SITE_URL. A pasted value is cleaned up first:
 * "[https://site](https://site)" (copied from a chat as a Markdown link), quotes, spaces or a
 * trailing slash would otherwise end up inside every href and make the email's buttons dead.
 * Only the origin is kept (scheme + host + port), so paths are always appended to a clean base.
 */

export const DEFAULT_SITE_URL = 'https://justicia-chi.vercel.app';

/** The origin of the first http(s) URL in `raw`, or null when there is none. */
export function cleanSiteUrl(raw: string | null | undefined): string | null {
  const candidate = raw?.match(/https?:\/\/[^\s"'<>()[\]]+/i)?.[0];
  if (!candidate) return null;
  try {
    return new URL(candidate).origin;
  } catch {
    return null;
  }
}

/** e.g. "https://justicia-chi.vercel.app" (never a trailing slash). */
export function publicSiteUrl(): string {
  // Literal process.env.NEXT_PUBLIC_* reads, so Next.js can inline them in any bundle.
  return (
    cleanSiteUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    cleanSiteUrl(process.env.NEXT_PUBLIC_SITE_URL) ??
    DEFAULT_SITE_URL
  );
}
