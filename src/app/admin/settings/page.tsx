import type { Metadata } from 'next';
import { AdminSettingsView } from '@/components/admin/views/AdminSettingsView';

export const metadata: Metadata = {
  title: 'Platform Settings & Governance | Justicia Admin',
  description: 'Manage platform settings, economic safeguards, maintenance mode, and administrator accounts.',
};

export default function AdminSettingsPage() {
  return <AdminSettingsView />;
}
