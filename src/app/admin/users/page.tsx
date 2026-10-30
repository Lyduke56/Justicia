import type { Metadata } from 'next';
import { AdminUsersView } from '@/components/admin/views/AdminUsersView';

export const metadata: Metadata = {
  title: 'User Accounts | Justicia Admin',
  description: 'Manage registered clients, lawyers, and platform administrators.',
};

export default function AdminUsersPage() {
  return <AdminUsersView />;
}
