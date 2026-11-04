import type { Metadata } from 'next';
import { getAdminUsersData } from '@/app/actions/adminData';
import { AdminUsersView } from '@/components/admin/views/AdminUsersView';

export const metadata: Metadata = { title: 'User account | Justicia Admin' };

export default async function AdminUserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const users = await getAdminUsersData();
  return <AdminUsersView initialUsers={users} initialSelectedId={userId} />;
}
