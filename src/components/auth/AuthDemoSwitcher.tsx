'use client';

import React from 'react';
import Link from 'next/link';

export function AuthDemoSwitcher() {
  return (
    <div className="mt-6 pt-5 border-t border-[#D29D54]/30 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#7A604D]">
          ⚡ Developer & QA Quick Role Preview
        </span>
        <span className="text-[10px] text-[#99431E] font-semibold">Instant Access</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Link
          href="/client/dashboard?demo=client"
          className="neu-btn-peach py-2 px-2 rounded-xl text-center flex flex-col items-center justify-center transition-all hover:scale-[1.02]"
        >
          <span className="text-xs">👤</span>
          <span className="text-[10px] font-bold text-[#34150F] mt-0.5">Client Role</span>
          <span className="text-[8px] text-[#7A604D]">Juan Dela Cruz</span>
        </Link>

        <Link
          href="/lawyer/dashboard?demo=lawyer"
          className="neu-btn-peach py-2 px-2 rounded-xl text-center flex flex-col items-center justify-center transition-all hover:scale-[1.02]"
        >
          <span className="text-xs">⚖</span>
          <span className="text-[10px] font-bold text-[#34150F] mt-0.5">Lawyer Role</span>
          <span className="text-[8px] text-[#7A604D]">Atty. Santos</span>
        </Link>

        <Link
          href="/admin/dashboard?demo=admin"
          className="neu-btn-peach py-2 px-2 rounded-xl text-center flex flex-col items-center justify-center transition-all hover:scale-[1.02]"
        >
          <span className="text-xs">🛡</span>
          <span className="text-[10px] font-bold text-[#34150F] mt-0.5">Admin Role</span>
          <span className="text-[8px] text-[#7A604D]">Atty. Mendoza</span>
        </Link>
      </div>

      <p className="text-[10px] text-center text-[#7A604D]/80">
        Click any role above to test profiles, settings, and dashboards immediately without needing live credentials.
      </p>
    </div>
  );
}
