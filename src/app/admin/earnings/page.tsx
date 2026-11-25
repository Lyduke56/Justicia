import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getAdminEarningsData } from '@/app/actions/adminEarningsActions';
import { AdminEarningsView } from '@/components/admin/views/AdminEarningsView';

export const metadata: Metadata = {
  title: 'Earnings | Justicia Admin',
  description: 'Platform convenience fees from every consultation payment, by month, with refunds and an exportable report.',
};

export default async function AdminEarningsPage() {
  await connection();
  const res = await getAdminEarningsData();
  return res.success ? <AdminEarningsView initialData={res.data} /> : <AdminEarningsView initialData={null} initialError={res.error} />;
}
