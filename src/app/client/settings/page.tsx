import type { Metadata } from 'next';
import { AccountPage } from '@/components/account/AccountPage';

export const metadata: Metadata = { title: 'Settings' };

export default function Page() {
  return <AccountPage mode="settings" />;
}
