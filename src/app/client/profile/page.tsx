import type { Metadata } from 'next';
import { AccountPage } from '@/components/account/AccountPage';

export const metadata: Metadata = { title: 'My Profile' };

export default function Page() {
  return <AccountPage mode="profile" />;
}
