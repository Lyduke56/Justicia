import type { Metadata } from 'next';
import { AdminSettingsView } from '@/components/admin/AdminSettingsView';

export const metadata: Metadata = {
  title: 'System Settings | Justicia Admin',
  description: 'Global system configuration, maintenance mode, AI legal model parameters, and policies.',
};

export default function AdminSettingsPage() {
  return <AdminSettingsView />;
}
