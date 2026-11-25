import { getPersonalAccountAction } from '@/app/actions/accountActions';
import { AdminAccountSettings } from '@/components/admin/settings/AdminAccountPages';

/** Admin Settings: loads the signed-in administrator's account for the settings page. */
export async function AdminSettingsView() {
  const account = await getPersonalAccountAction();
  if (!account.success) {
    return (
      <div className="lawyer-page mx-auto max-w-[1196px] px-4 pb-14 pt-6 sm:px-8 sm:pt-10 lg:px-12 lg:pt-12">
        <div className="neu-recessed space-y-2 rounded-[24px] bg-[#E5D8CB] p-8 text-center">
          <h1 className="font-lora text-xl font-bold text-[#341512]/80">Account Settings</h1>
          <p role="alert" className="font-inter text-sm text-[#341512]/70">
            {account.error}
          </p>
        </div>
      </div>
    );
  }
  return <AdminAccountSettings account={account.account} />;
}
