'use client';

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="mx-auto max-w-3xl p-6 sm:p-10 lg:p-12">
    <div className="rounded-3xl border border-[#E8DCCB] bg-[#EFE5D8] p-7 shadow-[6px_6px_16px_rgba(0,0,0,0.06),-6px_-6px_16px_rgba(255,255,255,0.85)] sm:p-9">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#946525]">Administration</p>
      <h1 className="mt-2 font-cormorant text-3xl font-bold text-[#34150F] sm:text-4xl">This page could not load</h1>
      <p className="mt-3 text-sm leading-6 text-[#705C49]">The admin data is temporarily unavailable. Try again in a moment.</p>
      <button type="button" onClick={reset} className="mt-6 rounded-xl bg-[#C58B3C] px-5 py-3 text-sm font-semibold text-[#23150F] hover:bg-[#B37B2F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#946525]">Try again</button>
    </div>
  </div>;
}
