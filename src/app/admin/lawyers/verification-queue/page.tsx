import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getVerificationQueueData } from '@/app/actions/adminData';
import { AdminVerificationQueueView } from '@/components/admin/views/AdminVerificationQueueView';

export const metadata: Metadata = {
  title: 'Lawyer Verification Queue | Justicia Admin',
  description: 'Review pending lawyer applications.',
};

export default async function AdminVerificationQueuePage() {
  await connection();
  const lawyers = await getVerificationQueueData();
  return <AdminVerificationQueueView lawyers={lawyers} />;
}
