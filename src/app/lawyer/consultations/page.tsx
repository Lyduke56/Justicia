import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Consultations Management',
};

/**
 * LawyerConsultationsPage
 *
 * Thin wrapper — rendered by LawyerShell view = 'consultations'.
 * The actual consultations management UI is rendered by <LawyerShell> which mounts
 * <LawyerConsultationsView>. On soft navigation the shell swaps views in-place.
 */
export default function LawyerConsultationsPage() {
  return null;
}
