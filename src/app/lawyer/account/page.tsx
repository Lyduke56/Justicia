import type { Metadata } from 'next';
import { AccountPage } from '@/components/account/AccountPage';

export const metadata: Metadata = { title: 'My Profile' };

/**
 * Lawyer Portal → My Profile (account menu): the lawyer's personal profile, laid out like the
 * client's (photo, contact details, member since, completeness), plus their payment QR.
 * The public profile clients see stays at /lawyer/profile ("Lawyer Profile" in the sidebar).
 */
export default function LawyerAccountPage() {
  return <AccountPage mode="profile" />;
}
