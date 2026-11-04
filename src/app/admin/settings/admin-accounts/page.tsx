import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getAdminUsersData } from '@/app/actions/adminData';
import { AdminUsersView } from '@/components/admin/views/AdminUsersView';

export const metadata: Metadata = {
  title: 'Administrator Accounts | Justicia Admin',
};

export default async function AdminAccountsPage() {
  await connection();
  const users = await getAdminUsersData();
  return <AdminUsersView initialUsers={users} initialRole="admin" />;
}
