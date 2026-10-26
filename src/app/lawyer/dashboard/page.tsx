import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Lawyer Dashboard',
};

/**
 * LawyerDashboardPage
 *
 * Thin wrapper — rendered by LawyerShell view = 'dashboard'.
 * The actual dashboard UI is rendered by <LawyerShell> which mounts
 * <LawyerDashboardView>. On soft navigation the shell swaps views in-place.
 */
export default function LawyerDashboardPage() {
  return null;
}
