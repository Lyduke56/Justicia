import type { Metadata } from 'next';
import { getAdminUsersData } from '@/app/actions/adminData';
import { AdminUsersView } from '@/components/admin/views/AdminUsersView';

export const metadata: Metadata = {
  title: 'User Accounts | Justicia Admin',
  description: 'Manage registered clients, lawyers, and platform administrators.',
};

export default async function AdminUsersPage() {
  const users = await getAdminUsersData();
  return <AdminUsersView initialUsers={users} />;
}
