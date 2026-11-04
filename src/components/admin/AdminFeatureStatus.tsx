import Link from 'next/link';
import type { ReactNode } from 'react';

export function AdminFeatureStatus({ eyebrow, title, description, icon, items }: {
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
  items: string[];
}) {
  return <div className="mx-auto max-w-5xl space-y-8 p-6 sm:p-10 lg:p-12">
    <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#946525]">{eyebrow}</p><h1 className="mt-1 font-cormorant text-4xl font-semibold leading-tight sm:text-5xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#705C49]">{description}</p></div>
    <section className="rounded-3xl border border-[#E8DCCB] bg-[#EFE5D8] p-6 shadow-[6px_6px_16px_rgba(0,0,0,0.06),-6px_-6px_16px_rgba(255,255,255,0.85)] sm:p-8">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E5D7C5] text-[#946525]">{icon}</span>
      <h2 className="mt-5 font-cormorant text-2xl font-bold">Management tools are in development</h2>
      <p className="mt-2 text-sm text-[#705C49]">This page does not currently save changes to the platform. The planned tools include:</p>
      <ul className="mt-4 space-y-2 text-sm text-[#5C4535]">{items.map((item) => <li key={item} className="flex gap-2"><span aria-hidden="true" className="text-[#946525]">•</span>{item}</li>)}</ul>
      <Link href="/admin/dashboard" className="mt-6 inline-flex rounded-lg text-sm font-semibold text-[#946525] hover:text-[#6B4517] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#946525]">Back to overview →</Link>
    </section>
  </div>;
}
