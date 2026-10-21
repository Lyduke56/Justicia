import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Find a Lawyer',
  description: 'Search and connect with verified Philippine lawyers across specializations.',
};

/**
 * Thin page wrapper — actual UI is rendered by <ClientShell> view = 'lawyers'.
 * Exists for metadata + hard-refresh URL resolution only.
 */
export default function FindLawyerPage() {
  return null;
}
