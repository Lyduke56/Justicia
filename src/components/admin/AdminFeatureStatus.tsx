import Link from 'next/link';
import type { ReactNode } from 'react';

export function AdminFeatureStatus({ eyebrow, title, description, icon, items }: {
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
  items: string[];
}) {
  return <div className="admin-page">
    <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#946525]">{eyebrow}</p><h1 className="mt-1 font-lora text-4xl font-semibold leading-tight sm:text-5xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#705C49]">{description}</p></div>
    <section className="admin-card p-6 sm:p-8">
      <span className="admin-plate flex h-11 w-11 items-center justify-center text-[#946525]">{icon}</span>
      <h2 className="mt-5 font-lora text-2xl font-bold">Management tools are in development</h2>
      <p className="mt-2 text-sm text-[#705C49]">This page does not currently save changes to the platform. The planned tools include:</p>
      <ul className="mt-4 space-y-2 text-sm text-[#5C4535]">{items.map((item) => <li key={item} className="flex gap-2"><span aria-hidden="true" className="text-[#946525]">•</span>{item}</li>)}</ul>
      <Link href="/admin/dashboard" className="admin-button mt-6 inline-flex text-sm font-semibold">Back to overview →</Link>
    </section>
  </div>;
}
