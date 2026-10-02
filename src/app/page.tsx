import type { Metadata } from 'next';
import { LandingPageClient } from '@/components/landing/LandingPageClient';

export const metadata: Metadata = {
  title: 'Justicia — AI-Powered Philippine Legal Guidance & Lawyer Consultation',
  description:
    'Understand Philippine laws and jurisprudence with AI-powered legal guidance, connect with verified licensed lawyers when you need professional counsel. Nemo est supra leges.',
};

export default function LandingPage() {
  return <LandingPageClient />;
}
