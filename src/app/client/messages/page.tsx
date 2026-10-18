import type { Metadata } from 'next';
import { MessagesIcon } from '@/components/client/ClientIcons';

export const metadata: Metadata = { title: 'Messages' };

export default function MessagesPage() {
  return (
    <div className="p-6 sm:p-10 lg:p-12 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="font-cormorant text-4xl sm:text-5xl font-medium text-[#34150F]">
          Attorney <span className="text-[#C58B3C]">Messages</span>
        </h1>
        <p className="text-sm text-[#7D6855] mt-1">
          Confidential attorney-client communication protected by privileged confidentiality.
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl p-5 bg-[#EFE5D8] shadow-[5px_5px_12px_rgba(0,0,0,0.06),-5px_-5px_12px_rgba(255,255,255,0.85)] border border-[#E8DCCB]/60 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-[#5C4535]/80 flex items-center justify-center text-[#5C4535]">
              <MessagesIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-cormorant font-bold text-base text-[#34150F]">
                Atty. Maria Elena Santos, LL.B.
              </h3>
              <p className="text-xs text-[#7D6855] mt-0.5 truncate max-w-md">
                I have reviewed your draft employment contract. Please see notes attached.
              </p>
            </div>
          </div>
          <span className="text-[10px] text-[#A39282] shrink-0">Today, 2:15 PM</span>
        </div>

        <div className="rounded-2xl p-8 text-center bg-[#EAE0D2]/50 border border-dashed border-[#D9C7B2] text-xs text-[#7A6756]">
          No further active conversations. Start a consultation with an attorney to open a thread.
        </div>
      </div>
    </div>
  );
}
