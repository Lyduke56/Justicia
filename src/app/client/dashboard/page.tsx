import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * ClientDashboardPage
 *
 * This route exists for two purposes only:
 * 1. SEO metadata / <title> tag for hard refreshes at this URL.
 * 2. Ensuring Next.js App Router recognises this as a valid page segment.
 *
 * The actual dashboard UI is rendered by <ClientShell> (view = 'dashboard')
 * which is already mounted in the parent layout. On a soft navigation the
 * shell swaps views in-place without triggering this page at all.
 */
export default function ClientDashboardPage() {
  // Shell handles rendering — this is a no-op for in-shell navigation.
  return null;
}
