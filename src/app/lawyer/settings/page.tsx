import type { Metadata } from 'next';
import { LawyerSettingsView } from '@/components/lawyer/views/LawyerSettingsView';

export const metadata: Metadata = {
  title: 'Counsel Practice Settings | Justicia Counsel',
  description: 'Manage availability, consultation payouts, and client intake parameters.',
};

export default function LawyerSettingsPage() {
  return <LawyerSettingsView />;
}
