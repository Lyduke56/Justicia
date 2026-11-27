import { getPersonalAccountAction } from '@/app/actions/accountActions';
import { getProfileExtrasAction } from '@/app/actions/profileExtrasActions';
import { getMyAvatarUrl } from '@/lib/account/avatar';
import { getLawyerProfileSummary } from '@/lib/account/lawyerSummary';
import { PersonalProfileCard } from './PersonalProfileCard';
import { AccountSettings } from './AccountSettings';
import { ClientAccountSettings } from './ClientAccountSettings';
import { ClientProfileView } from './ClientProfileView';
import { PaymentQrCard } from './PaymentQrCard';

/**
 * Settings and My Profile for the client and lawyer portals. Both roles get the same redesigned
 * neumorphic pages (ClientAccountSettings / ClientProfileView adapt their wording, links and the
 * lawyer's Payment QR to the role), so the two portals look like one system. Admins have their
 * own account pages; the plain layout at the bottom is only a fallback for any other role.
 */
export async function AccountPage({ mode }: { mode: 'profile' | 'settings' }) {
  const result = await getPersonalAccountAction();
  const role = result.success ? result.account.role : null;
  const portalRole = role === 'client' || role === 'lawyer';

  if (mode === 'settings' && result.success && portalRole) {
    return <ClientAccountSettings account={result.account} />;
  }
  // Profiles also show photo, location, contact preferences and their Justicia summary (a
  // lawyer's summary is counted from their side: clients served).
  let extras = mode === 'profile' && portalRole ? await getProfileExtrasAction() : null;
  if (extras?.success && role === 'lawyer') {
    const summary = await getLawyerProfileSummary();
    if (summary) extras = { ...extras, summary };
  }
  // Every role can change their photo here; it shows in the top bar, Messages and consultations.
  const avatarUrl = result.success ? await getMyAvatarUrl() : null;
  if (mode === 'profile' && result.success && portalRole) {
    return <ClientProfileView account={result.account} extras={extras && extras.success ? extras : null} avatarUrl={avatarUrl} />;
  }
  return <div className="p-6 sm:p-10 lg:p-12 max-w-4xl mx-auto space-y-8">
    <div>
      <h1 className="font-cormorant text-4xl sm:text-5xl font-medium text-[#34150F]">
        {mode === 'profile' && result.success ? result.account.role[0].toUpperCase() + result.account.role.slice(1) : 'Account'}{' '}
        <span className="text-[#C58B3C]">{mode === 'profile' ? 'Profile' : 'Settings'}</span>
      </h1>
      <p className="text-sm text-[#7D6855] mt-1">{mode === 'profile'
        ? 'Personal identification and contact details for consultation records.'
        : 'Preferences, notification settings, and privacy controls.'}</p>
    </div>
    {!result.success ? <p role="alert" className="text-sm text-red-700">{result.error}</p> : <>
      {(mode === 'profile' || result.account.role === 'lawyer') && (
        <PersonalProfileCard account={result.account} extras={extras && extras.success ? extras : null} avatarUrl={avatarUrl} />
      )}
      {mode === 'profile' && result.account.role === 'lawyer' && <PaymentQrCard />}
      {mode === 'settings' && <AccountSettings account={result.account} />}
    </>}
  </div>;
}
