'use client';

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="admin-page">
    <div className="admin-card p-7 sm:p-9">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#946525]">Administration</p>
      <h1 className="mt-2 font-lora text-3xl font-bold text-[#34150F] sm:text-4xl">This page could not load</h1>
      <p className="mt-3 text-sm leading-6 text-[#705C49]">The admin data is temporarily unavailable. Try again in a moment.</p>
      <button type="button" onClick={reset} className="admin-button admin-button-primary mt-6 px-5 py-3 text-sm font-semibold">Try again</button>
    </div>
  </div>;
}
