import Link from 'next/link';
import type { ReactNode } from 'react';

export function AdminFeatureStatus({ title, description, icon }: {
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
  items: string[];
}) {
  return <div className="admin-page">
    <section className="admin-inset mx-auto max-w-xl p-6 sm:p-8">
      <div className="flex items-center gap-4">
        <span className="admin-plate flex h-12 w-12 shrink-0 items-center justify-center" aria-hidden="true">{icon}</span>
        <h1 className="admin-section-title">{title}</h1>
      </div>
      <p className="mt-5 text-sm leading-6 text-[#705C49]">{description}</p>
      <p className="mt-2 text-xs text-[#705C49]">In development. Changes cannot be saved here yet.</p>
      <Link href="/admin/dashboard" className="admin-control mt-6">Back to overview</Link>
    </section>
  </div>;
}
