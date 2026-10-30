import type { Metadata } from 'next';
import { AdminSettingsView } from '@/components/admin/views/AdminSettingsView';

export const metadata: Metadata = {
  title: 'Administrator Accounts | Justicia Admin',
};

export default function AdminAccountsPage() {
  return <AdminSettingsView />;
}
