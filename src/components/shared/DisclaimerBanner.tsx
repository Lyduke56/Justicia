/**
 * DisclaimerBanner — Shared component
 *
 * Always rendered in the AI Legal Assistant chat and any screen displaying AI-generated content.
 * Must be visible and never dismissible per legal requirements.
 *
 * TODO: Add multi-language support (show disclaimer in user's preferred language)
 * TODO: Make the "Consult a Lawyer" link point to /lawyers page
 */

interface DisclaimerBannerProps {
  language?: 'en' | 'fil';
}

const DISCLAIMERS = {
  en: 'The information provided by the AI Legal Assistant is for general informational purposes only and does not constitute legal advice. Justicia is not a law firm and does not provide legal representation. Please consult a licensed Philippine attorney for advice specific to your situation.',
  fil: 'Ang impormasyong ibinibigay ng AI Legal Assistant ay para lamang sa pangkalahatang impormasyon at hindi bumubuo ng legal na payo. Hindi law firm ang Justicia at hindi nagbibigay ng legal na representasyon. Mangyaring kumonsulta sa isang lisensyadong abogado para sa payo na naaangkop sa iyong sitwasyon.',
};

export function DisclaimerBanner({ language = 'en' }: DisclaimerBannerProps) {
  return (
    <aside
      className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
      aria-label="Legal disclaimer"
      role="note"
    >
      <p>
        <strong>⚠️ Disclaimer: </strong>
        {DISCLAIMERS[language]}
      </p>
    </aside>
  );
}
