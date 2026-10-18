import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarBookingIcon } from '@/components/client/ClientIcons';

export const metadata: Metadata = { title: 'Consultation Booking' };

export default function ConsultationsPage() {
  return (
    <div className="p-6 sm:p-10 lg:p-12 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="font-cormorant text-4xl sm:text-5xl font-medium text-[#34150F]">
          Consultation <span className="text-[#C58B3C]">Bookings</span>
        </h1>
        <p className="text-sm text-[#7D6855] mt-1">
          Manage and schedule online or in-person legal consultations with verified attorneys.
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl p-6 bg-[#EFE5D8] shadow-[5px_5px_12px_rgba(0,0,0,0.06),-5px_-5px_12px_rgba(255,255,255,0.85)] border border-[#E8DCCB]/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#E4D7C5] flex items-center justify-center text-[#C58B3C] shrink-0">
              <CalendarBookingIcon className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#C58B3C]">
                Upcoming Video Session
              </span>
              <h3 className="font-cormorant font-bold text-lg text-[#34150F]">
                Legal Consultation with Atty. Maria Elena Santos
              </h3>
              <p className="text-xs text-[#7D6855] mt-0.5">
                Wednesday, Sept 23 • 3:00 PM – 4:00 PM PHT (via Secure Justicia Video)
              </p>
            </div>
          </div>
          <button
            type="button"
            className="px-5 py-2.5 rounded-xl bg-[#34150F] text-[#FAF6F0] text-xs font-semibold hover:bg-[#4A2016] transition-colors"
          >
            Join Meeting Room
          </button>
        </div>

        <div className="text-center pt-6">
          <Link
            href="/client/lawyers"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#C58B3C] hover:bg-[#B3792E] text-white text-xs font-semibold shadow-md transition-all"
          >
            + Book a New Consultation
          </Link>
        </div>
      </div>
    </div>
  );
}
