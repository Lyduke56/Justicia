'use client';

import type { ReactNode } from 'react';

export function DataState({ title, children, loading = false, onRetry }: {
  title: string; children?: ReactNode; loading?: boolean; onRetry?: () => void;
}) {
  return <div className="portal-state" role={onRetry ? 'alert' : 'status'} aria-busy={loading}>
    {loading && <span className="portal-loading-dot" aria-hidden="true" />}
    <h3>{title}</h3>
    {children && <p>{children}</p>}
    {onRetry && <button type="button" className="portal-button portal-button-secondary" onClick={onRetry}>Try again</button>}
  </div>;
}

export function Pagination({ page, totalPages, onChange, label = 'Results' }: {
  page: number; totalPages: number; onChange: (page: number) => void; label?: string;
}) {
  if (totalPages <= 1) return null;
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);
  return <nav className="portal-pagination" aria-label={`${label} pages`}>
    <button type="button" className="portal-page-arrow" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label={`Previous ${label.toLowerCase()} page`}>
      <span aria-hidden="true">‹</span>
    </button>
    {pages.map(number => <button type="button" key={number} className="portal-page-dot" aria-current={number === page ? 'page' : undefined} aria-label={`${label} page ${number}`} onClick={() => onChange(number)}><span /></button>)}
    <span className="sr-only">Page {page} of {totalPages}</span>
    <button type="button" className="portal-page-arrow" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label={`Next ${label.toLowerCase()} page`}>
      <span aria-hidden="true">›</span>
    </button>
  </nav>;
}

export type ProfileTab = 'about' | 'reviews' | 'booking' | 'cases';
const profileTabs: { id: ProfileTab; label: string }[] = [
  { id: 'about', label: 'About' }, { id: 'reviews', label: 'Reviews' },
  { id: 'booking', label: 'Consultation Booking' }, { id: 'cases', label: 'Cases Handled' },
];

export function ProfileTabList({ active, onChange }: { active: ProfileTab; onChange: (tab: ProfileTab) => void }) {
  return <div className="portal-tabs" role="tablist" aria-label="Lawyer profile">
    {profileTabs.map(({ id, label }, index) => <button key={id} id={`profile-tab-${id}`} type="button" role="tab" aria-controls={`profile-panel-${id}`} aria-selected={active === id} tabIndex={active === id ? 0 : -1} onClick={() => onChange(id)} onKeyDown={event => {
      let next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % profileTabs.length;
      else if (event.key === 'ArrowLeft') next = (index + profileTabs.length - 1) % profileTabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = profileTabs.length - 1;
      else return;
      event.preventDefault();
      onChange(profileTabs[next].id);
      document.getElementById(`profile-tab-${profileTabs[next].id}`)?.focus();
    }}>{label}</button>)}
  </div>;
}
