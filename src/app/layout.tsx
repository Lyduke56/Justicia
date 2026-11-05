import type { Metadata } from 'next';
import {
  Geist,
  Geist_Mono,
  Cinzel,
  Cormorant_Garamond,
  Lora,
  Inter,
  Cormorant_Unicase,
} from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const cinzel = Cinzel({
  variable: '--font-cinzel',
  subsets: ['latin'],
});

const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin'],
});

const cormorantUnicase = Cormorant_Unicase({
  variable: '--font-cormorant-unicase',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

const lora = Lora({
  variable: '--font-lora',
  subsets: ['latin'],
  display: 'swap',
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    template: '%s | Justicia',
    default: 'Justicia — AI-Powered Philippine Legal Assistance',
  },
  description:
    'Justicia connects Filipinos with licensed lawyers and an AI-powered legal assistant for accessible, affordable legal guidance.',
  keywords: ['Philippine law', 'legal assistance', 'lawyer consultation', 'AI legal', 'Justicia'],
  openGraph: {
    title: 'Justicia — AI-Powered Philippine Legal Assistance',
    description: 'Connect with licensed Philippine lawyers and get AI-powered legal guidance.',
    type: 'website',
    locale: 'en_PH',
  },
};

/**
 * Root Layout
 *
 * Wraps the entire app with:
 * - Google Fonts (Geist family, Cinzel, Cormorant Garamond, Cormorant Unicase, Lora, Inter)
 * - Global CSS
 *
 * TODO: Add i18n context provider (locale detection & dictionary)
 * TODO: Add Supabase session provider if using client-side context
 * TODO: Add toast/notification provider
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable} ${cormorant.variable} ${cormorantUnicase.variable} ${lora.variable} ${inter.variable} h-full antialiased scroll-smooth`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {/* TODO: <I18nProvider> */}
        {/* TODO: <ToastProvider> */}
        {children}
        {/* TODO: </ToastProvider> */}
        {/* TODO: </I18nProvider> */}
      </body>
    </html>
  );
}
