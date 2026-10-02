import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'My Profile' };

/**
 * Client Profile
 * View and edit personal account information.
 * TODO: Fetch user_accounts row (current user)
 * TODO: Edit: display name, contact info, preferred language
 * TODO: MFA settings (enable/disable TOTP)
 * TODO: Show account verification status
 * TODO: Danger zone: delete account
 */
export default function ProfilePage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">My Profile</h1>
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
        🚧 <code>src/app/(client)/profile/page.tsx</code>
        <br />TODO: Personal info form, MFA settings, account verification status
      </div>
    </main>
  );
}
