import { getPersonalAccountAction } from '@/app/actions/accountActions';
import { PersonalProfileCard } from './PersonalProfileCard';
import { AccountSettings } from './AccountSettings';
import { ClientAccountSettings } from './ClientAccountSettings';

/** Reuses the existing client page layout without changing either portal's shell. */
export async function AccountPage({ mode }: { mode: 'profile' | 'settings' }) {
  const result = await getPersonalAccountAction();
  // Client settings use the redesigned neumorphic page; lawyer/admin keep the shared layout below.
  if (mode === 'settings' && result.success && result.account.role === 'client') {
    return <ClientAccountSettings account={result.account} />;
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
      {(mode === 'profile' || result.account.role === 'lawyer') && <PersonalProfileCard account={result.account} />}
      {mode === 'settings' && <AccountSettings account={result.account} />}
    </>}
  </div>;
}
