import type { Metadata } from 'next';
import { ClientSettingsView } from '@/components/client/ClientSettingsView';

export const metadata: Metadata = {
  title: 'Client Settings | Justicia',
  description: 'Manage notification alerts, legal confidentiality, and account security.',
};

export default function SettingsPage() {
  return <ClientSettingsView />;
}
