'use client';

import React from 'react';
import { BriefcaseFolderIcon } from '@/components/client/ClientIcons';

export function CasesView() {
  return (
    <div className="p-6 sm:p-10 lg:p-12 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="font-cormorant text-4xl sm:text-5xl font-medium text-[#34150F]">
          My Cases & <span className="text-[#C58B3C]">Documents</span>
        </h1>
        <p className="text-sm text-[#7D6855] mt-1">
          Secure storage for legal affidavits, contracts, pleadings, and court filings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="rounded-2xl p-5 bg-[#EFE5D8] shadow-[5px_5px_12px_rgba(0,0,0,0.06),-5px_-5px_12px_rgba(255,255,255,0.85)] border border-[#E8DCCB]/60 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E4D7C5] flex items-center justify-center text-[#C58B3C]">
              <BriefcaseFolderIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-cormorant font-bold text-base text-[#34150F]">
                Labor Grievance Review
              </h3>
              <p className="text-[10px] text-[#7D6855] uppercase tracking-wider">Case Ref: JUST-2026-081</p>
            </div>
          </div>
          <p className="text-xs text-[#695444] leading-relaxed">
            Status: Under Legal Assessment with Assigned Counsel.
          </p>
          <div className="pt-2 flex items-center justify-between text-[11px] text-[#A39282] border-t border-[#E5D7C5]">
            <span>3 files uploaded</span>
            <span className="text-[#C58B3C] font-semibold">Active</span>
          </div>
        </div>

        <div className="rounded-2xl p-8 bg-[#EAE0D2]/40 border border-dashed border-[#D9C7B2] flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-[#E5D7C5] flex items-center justify-center text-[#5C4535] text-lg font-light">
            +
          </div>
          <div>
            <h4 className="font-semibold text-sm text-[#34150F]">Upload Legal Document</h4>
            <p className="text-xs text-[#7A6756] mt-0.5">PDF, DOCX, or scanned contract files</p>
          </div>
        </div>
      </div>
    </div>
  );
}
