'use client';

import React, { useState } from 'react';

/**
 * DashboardCalendar — Neumorphic calendar widget matching Figma design.
 * Displays current month, large day highlight in gold, and interactive mini calendar grid.
 */
export function DashboardCalendar() {
  const [currentDate] = useState(() => new Date());

  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEPT', 'OCT', 'NOV', 'DEC'];
  const daysOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const shortDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  const monthName = months[currentDate.getMonth()];
  const dayNumber = currentDate.getDate();
  const dayOfWeekName = daysOfWeek[currentDate.getDay()];

  // Generate calendar days for the current month
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Build grid items (padding before first day + days)
  const calendarCells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= totalDays; d++) {
    calendarCells.push(d);
  }

  return (
    <div className="w-full bg-[#EFE5D8] rounded-3xl p-5 sm:p-6 shadow-[6px_6px_16px_rgba(0,0,0,0.06),-6px_-6px_16px_rgba(255,255,255,0.9)] border border-[#E8DCCB]/60 flex flex-col sm:flex-row items-center gap-6">
      {/* Left Column: Month, Giant Day Number, Weekday */}
      <div className="flex flex-col items-center justify-center sm:border-r border-[#D9C7B2]/70 sm:pr-8 sm:min-w-[130px]">
        <span className="font-sans text-xs font-bold tracking-[0.2em] text-[#7D6855] uppercase">
          {monthName}
        </span>
        <span className="font-cormorant text-5xl sm:text-6xl font-bold text-[#C58B3C] leading-none my-1.5 select-none">
          {String(dayNumber).padStart(2, '0')}
        </span>
        <span className="font-sans text-[10px] font-semibold tracking-[0.2em] text-[#7D6855] uppercase">
          {dayOfWeekName}
        </span>
      </div>

      {/* Right Column: Mini Calendar Month Grid */}
      <div className="flex-1 w-full">
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {shortDays.map((d) => (
            <span key={d} className="text-[10px] font-bold text-[#4A3528] tracking-wider">
              {d}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1.5 gap-x-1 text-center text-xs">
          {calendarCells.map((cell, idx) => {
            if (cell === null) {
              return <div key={`empty-${idx}`} className="h-7 w-7" />;
            }

            const isToday = cell === dayNumber;

            return (
              <div key={`day-${cell}`} className="flex items-center justify-center">
                <span
                  className={`w-7 h-7 flex items-center justify-center rounded-full text-[11px] transition-all select-none ${
                    isToday
                      ? 'bg-[#E5D5C1] text-[#34150F] font-bold ring-2 ring-[#C58B3C]/50 shadow-[2px_2px_5px_rgba(0,0,0,0.08),-2px_-2px_5px_rgba(255,255,255,0.8)]'
                      : 'text-[#695444] hover:bg-[#E8D9C7]'
                  }`}
                >
                  {String(cell).padStart(2, '0')}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
