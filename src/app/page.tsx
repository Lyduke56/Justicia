import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Justicia — AI-Powered Philippine Legal Assistance',
  description:
    'Access Philippine legal information, consult licensed lawyers, and get AI-powered legal guidance — all in one platform.',
};

/**
 * Public Landing Page
 *
 * This is the entry point for unauthenticated users.
 * TODO: Build out full marketing landing page with:
 *   - Hero section with CTA
 *   - Features overview (AI Assistant, Lawyer Discovery, Document Management)
 *   - How it works (3-step flow)
 *   - Featured lawyers / testimonials
 *   - FAQ
 *   - Footer with legal disclaimers
 */
export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">
          Justicia
        </h1>
        <p className="text-lg text-muted-foreground">
          AI-Powered Philippine Legal Assistance &amp; Lawyer Consultation Platform
        </p>
        <p className="text-sm text-muted-foreground border rounded-lg p-4 bg-muted">
          🚧 <strong>Scaffold placeholder.</strong> This is the public landing page.{' '}
          <code>src/app/page.tsx</code>
          <br />
          TODO: Replace with full marketing page (hero, features, CTAs, testimonials).
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="px-6 py-2 rounded-lg border font-medium hover:bg-muted transition"
          >
            Create Account
          </Link>
        </div>
      </div>
    </main>
  );
}
