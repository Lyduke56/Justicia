import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Calendar & Availability' };

/**
 * Lawyer Practice Calendar & Availability
 */
export default function LawyerCalendarPage() {
  return (
    <div className="p-6 sm:p-10 max-w-6xl mx-auto space-y-6">
      <div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#C58B3C]">
          Schedule Management
        </span>
        <h1 className="font-cormorant text-3xl sm:text-4xl font-bold text-[#34150F] mt-1">
          Practice Calendar & Availability
        </h1>
        <p className="text-xs sm:text-sm text-[#7D6855] mt-1">
          Configure available booking windows, consultation hours, and blackout dates.
        </p>
      </div>

      <div
        className="rounded-3xl p-6 sm:p-8 bg-[#EFE5D8] border border-[#E8DCCB]/80"
        style={{ boxShadow: '6px 6px 16px rgba(0,0,0,0.06), -6px -6px 16px rgba(255,255,255,0.85)' }}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#E5D7C5]">
          <div>
            <h2 className="font-cormorant text-2xl font-bold text-[#34150F]">Standard Weekly Availability</h2>
            <p className="text-xs text-[#7D6855]">Clients can book consultations during these recurring weekly slots.</p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-600/15 text-emerald-700 border border-emerald-600/20">
            ● Calendar Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {[
            { day: 'Monday', hours: '9:00 AM – 5:00 PM', active: true },
            { day: 'Tuesday', hours: '9:00 AM – 5:00 PM', active: true },
            { day: 'Wednesday', hours: '9:00 AM – 5:00 PM', active: true },
            { day: 'Thursday', hours: '9:00 AM – 5:00 PM', active: true },
            { day: 'Friday', hours: '9:00 AM – 4:00 PM', active: true },
            { day: 'Saturday', hours: '10:00 AM – 2:00 PM (By Request)', active: false },
            { day: 'Sunday', hours: 'Closed / Court Rest Day', active: false },
          ].map((item) => (
            <div
              key={item.day}
              className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                item.active
                  ? 'bg-[#EAE0D2] border-[#D8CAAD] text-[#34150F]'
                  : 'bg-[#E5D7C5]/50 border-[#DACAB2] text-[#8C7A6B]'
              }`}
            >
              <div className="space-y-0.5">
                <p className="font-semibold text-sm">{item.day}</p>
                <p className="text-xs text-[#7D6855]">{item.hours}</p>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  item.active ? 'bg-emerald-600/15 text-emerald-800' : 'bg-[#D4C1AB] text-[#5C4535]'
                }`}
              >
                {item.active ? 'Open' : 'Off'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
