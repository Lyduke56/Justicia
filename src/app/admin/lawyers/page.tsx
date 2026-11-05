import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getLawyerDirectoryData } from '@/app/actions/adminData';
import { AdminLawyersView } from '@/components/admin/views/AdminLawyersView';

export const metadata: Metadata = {
  title: 'Lawyer Directory | Justicia Admin',
  description: 'Registered lawyer profiles and their verification status.',
};

export default async function AdminLawyersPage() {
  await connection();
  const lawyers = await getLawyerDirectoryData();
  return <AdminLawyersView lawyers={lawyers} />;
}
