import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getPersonalAccountAction } from '@/app/actions/accountActions';
import { AdminProfile } from '@/components/admin/settings/AdminAccountPages';

export const metadata: Metadata = { title: 'My Profile' };

/** The administrator's own profile, in the same design as the admin Settings page. */
export default async function AdminProfilePage() {
  // Per-user page: opt out of prerendering before the loader.
  await connection();
  const account = await getPersonalAccountAction();
  if (!account.success) {
    return (
      <div className="lawyer-page mx-auto max-w-[1196px] px-4 pb-14 pt-6 sm:px-8 sm:pt-10 lg:px-12 lg:pt-12">
        <div className="neu-recessed space-y-2 rounded-[24px] bg-[#E5D8CB] p-8 text-center">
          <h1 className="font-lora text-xl font-bold text-[#341512]/80">My Profile</h1>
          <p role="alert" className="font-inter text-sm text-[#341512]/70">
            {account.error}
          </p>
        </div>
      </div>
    );
  }
  return <AdminProfile account={account.account} />;
}
