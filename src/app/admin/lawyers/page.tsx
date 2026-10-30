import type { Metadata } from 'next';
import { AdminLawyersView } from '@/components/admin/views/AdminLawyersView';

export const metadata: Metadata = {
  title: 'Lawyer Directory | Justicia Admin',
  description: 'Manage registered Philippine attorneys, verify Supreme Court credentials, and oversee roster availability.',
};

export default function AdminLawyersPage() {
  return <AdminLawyersView />;
}
