import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getAdminDashboardData } from '@/app/actions/adminData';
import { AdminDashboardView } from '@/components/admin/views/AdminDashboardView';

export const metadata: Metadata = {
  title: 'Platform Overview | Justicia Admin',
  description: 'Lawyer applications, registered accounts, and recent administrative activity.',
};

export default async function AdminDashboardPage() {
  await connection();
  const data = await getAdminDashboardData();
  return <AdminDashboardView {...data} />;
}
