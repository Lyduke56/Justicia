import type { Metadata } from 'next';
import { AdminSettingsView } from '@/components/admin/views/AdminSettingsView';

export const metadata: Metadata = {
  title: 'Platform Settings & Governance | Justicia Admin',
  description: 'Available administration tools and planned platform controls.',
};

export default function AdminSettingsPage() {
  return <AdminSettingsView />;
}
