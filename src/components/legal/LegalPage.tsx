import Link from 'next/link';
import type { ReactNode } from 'react';
import { LEGAL_DOCUMENTS, LEGAL_VERSION } from '@/lib/legal';
import { SUPPORT_EMAIL } from '@/lib/support';

/**
 * Shared layout for /terms, /privacy and /ai-disclaimer (public pages, parchment style).
 * The wording describes how Justicia works today; have the team and adviser review it before a
 * public release, and bump LEGAL_VERSION in src/lib/legal.ts when it changes.
 */
export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  const updated = new Date(`${LEGAL_VERSION}T00:00:00+08:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  return (
    <main className="min-h-screen bg-[#EFE5D8] py-12 px-4">
      <article className="max-w-3xl mx-auto space-y-8">
        <header className="space-y-3">
          <Link href="/" className="text-xs font-semibold uppercase tracking-wider text-[#C58B3C] hover:underline">
            Justicia
          </Link>
          <h1 className="font-cormorant text-4xl sm:text-5xl font-bold text-[#34150F]">{title}</h1>
          <p className="text-sm text-[#7D6855]">Last updated {updated}</p>
          <p className="text-[15px] leading-relaxed text-[#5C4535]">{intro}</p>
        </header>
        <div className="space-y-7 text-[15px] leading-relaxed text-[#5C4535] [&_h2]:font-cormorant [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-[#34150F] [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_strong]:text-[#34150F]">
          {children}
        </div>
        <footer className="border-t border-[#D8CAAD] pt-6 space-y-3 text-sm text-[#7D6855]">
          <p>
            Questions? Write to{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#C58B3C] hover:underline">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
          <nav aria-label="Legal documents" className="flex flex-wrap gap-4">
            {LEGAL_DOCUMENTS.map((doc) => (
              <Link key={doc.href} href={doc.href} className="font-semibold text-[#946525] hover:underline">
                {doc.title}
              </Link>
            ))}
          </nav>
        </footer>
      </article>
    </main>
  );
}
