'use client';

import React, { useState } from 'react';

/**
 * DashboardCalendar — Neumorphic calendar widget matching Figma design.
 * Surface: #E5D8CB | Text: #341512 @ 80% | Highlight: #D39758
 */
export function DashboardCalendar() {
  const [currentDate] = useState(() => new Date());

  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEPT', 'OCT', 'NOV', 'DEC'];
  const daysOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const shortDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  const monthName = months[currentDate.getMonth()];
  const dayNumber = currentDate.getDate();
  const dayOfWeekName = daysOfWeek[currentDate.getDay()];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) calendarCells.push(null);
  for (let d = 1; d <= totalDays; d++) calendarCells.push(d);

  return (
    <div className="neu-raised bg-[#E5D8CB] w-full flex flex-col sm:flex-row items-center gap-5 sm:gap-6 lg:gap-5 rounded-[24px] px-5 py-5 sm:px-6 sm:py-5">
      {/* Left column: month, giant day number, weekday */}
      <div className="flex flex-col items-center justify-center sm:min-w-[110px] lg:min-w-[120px] shrink-0 select-none pl-1 sm:pl-2">
        <span className="font-lora text-sm sm:text-base lg:text-[28px] font-semibold tracking-wide text-[#341512]/80 uppercase">
          {monthName}
        </span>
        <span className="font-lora text-5xl sm:text-6xl mb-2 lg:text-[120px] font-semibold text-[#D39758] leading-none my-0.5 select-none">
          {String(dayNumber).padStart(2, '0')}
        </span>
        <span className="font-lora text-[11px] sm:text-[18px] font-semibold tracking-wider text-[#341512]/80 uppercase pt-1">
          {dayOfWeekName}
        </span>
      </div>

      {/* Right column: month grid */}
      <div className="flex-1 w-full min-w-0">
        <div className="grid grid-cols-7 justify-items-center mb-2">
          {shortDays.map((d) => (
            <span
              key={d}
              className="font-lora text-xs sm:text-[16px] font-semibold text-[#341512]/80 tracking-wide text-center"
            >
              {d}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 justify-items-center gap-y-1">
          {calendarCells.map((cell, idx) => {
            if (cell === null) {
              return <div key={`empty-${idx}`} className="size-7 sm:size-8 lg:size-8.5" />;
            }

            const isToday = cell === dayNumber;

            return (
              <div
                key={`day-${cell}`}
                className={`size-7 sm:size-8 lg:size-9 flex items-center justify-center rounded-full font-lora text-xs sm:text-[15px] select-none transition-all ${isToday
                  ? 'neu-raised-sm bg-[#E5D8CB] text-[#D39758] font-bold'
                  : 'text-[#341512]/80 hover:bg-[#DDCFC0]/60'
                  }`}
              >
                {String(cell).padStart(2, '0')}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}