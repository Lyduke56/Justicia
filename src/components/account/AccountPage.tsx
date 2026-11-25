import { getPersonalAccountAction } from '@/app/actions/accountActions';
import { getProfileExtrasAction } from '@/app/actions/profileExtrasActions';
import { getMyAvatarUrl } from '@/lib/account/avatar';
import { getLawyerProfileSummary } from '@/lib/account/lawyerSummary';
import { PersonalProfileCard } from './PersonalProfileCard';
import { AccountSettings } from './AccountSettings';
import { ClientAccountSettings } from './ClientAccountSettings';
import { PaymentQrCard } from './PaymentQrCard';

/** Reuses the existing client page layout without changing either portal's shell. */
export async function AccountPage({ mode }: { mode: 'profile' | 'settings' }) {
  const result = await getPersonalAccountAction();
  // Client settings use the redesigned neumorphic page; lawyer/admin keep the shared layout below.
  if (mode === 'settings' && result.success && result.account.role === 'client') {
    return <ClientAccountSettings account={result.account} />;
  }
  const role = result.success ? result.account.role : null;
  // Client and lawyer profiles also show photo, location, contact preferences and their Justicia
  // summary (a lawyer's summary is counted from their side: clients served).
  let extras = mode === 'profile' && (role === 'client' || role === 'lawyer') ? await getProfileExtrasAction() : null;
  if (extras?.success && role === 'lawyer') {
    const summary = await getLawyerProfileSummary();
    if (summary) extras = { ...extras, summary };
  }
  // Every role can change their photo here; it shows in the top bar, Messages and consultations.
  const avatarUrl = result.success ? await getMyAvatarUrl() : null;
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
      {/* Lawyers: the QR code clients scan to pay for an approved consultation. */}
      {mode === 'profile' && result.account.role === 'lawyer' && <PaymentQrCard />}
      {mode === 'settings' && <AccountSettings account={result.account} />}
    </>}
  </div>;
}
