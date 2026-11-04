'use client';

import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion, type Variants } from 'motion/react';
import { DashboardCalendar } from '@/components/client/DashboardCalendar';
import { DashboardSearchInput } from '@/components/client/DashboardSearchInput';
import { LawyerGridSection } from '@/components/client/LawyerGridSection';
import type { LawyerItem } from '@/components/client/LawyerCard';
import { createClient } from '@/lib/supabase/client';

const FALLBACK_LAWYERS: LawyerItem[] = [
  { id: 'lawyer-1', name: 'Atty. Maria Elena Santos, LL.B.', rollNumber: '58942', chapter: 'MAKATI', specializations: ['Labor & Employment', 'Corporate', 'Civil Law'], isVerified: true },
  { id: 'lawyer-2', name: 'Atty. Maria Elena Santos, LL.B.', rollNumber: '58942', chapter: 'MAKATI', specializations: ['Labor & Employment', 'Corporate', 'Civil Law'], isVerified: true },
  { id: 'lawyer-3', name: 'Atty. Maria Elena Santos, LL.B.', rollNumber: '58942', chapter: 'MAKATI', specializations: ['Labor & Employment', 'Corporate', 'Civil Law'], isVerified: true },
  { id: 'lawyer-4', name: 'Atty. Maria Elena Santos, LL.B.', rollNumber: '58942', chapter: 'MAKATI', specializations: ['Labor & Employment', 'Corporate', 'Civil Law'], isVerified: true },
  { id: 'lawyer-5', name: 'Atty. Maria Elena Santos, LL.B.', rollNumber: '58942', chapter: 'MAKATI', specializations: ['Labor & Employment', 'Corporate', 'Civil Law'], isVerified: true },
  { id: 'lawyer-6', name: 'Atty. Maria Elena Santos, LL.B.', rollNumber: '58942', chapter: 'MAKATI', specializations: ['Labor & Employment', 'Corporate', 'Civil Law'], isVerified: true },
  { id: 'lawyer-7', name: 'Atty. Maria Elena Santos, LL.B.', rollNumber: '58942', chapter: 'MAKATI', specializations: ['Labor & Employment', 'Corporate', 'Civil Law'], isVerified: true },
  { id: 'lawyer-8', name: 'Atty. Maria Elena Santos, LL.B.', rollNumber: '58942', chapter: 'MAKATI', specializations: ['Labor & Employment', 'Corporate', 'Civil Law'], isVerified: true },
  { id: 'lawyer-9', name: 'Atty. Maria Elena Santos, LL.B.', rollNumber: '58942', chapter: 'MAKATI', specializations: ['Labor & Employment', 'Corporate', 'Civil Law'], isVerified: true },
  { id: 'lawyer-10', name: 'Atty. Juan Carlos Reyes, LL.M.', rollNumber: '61204', chapter: 'QUEZON CITY', specializations: ['Family Law', 'Criminal Defense', 'Litigation'], isVerified: true },
  { id: 'lawyer-11', name: 'Atty. Patricia Ann Lim, J.D.', rollNumber: '64910', chapter: 'MANILA', specializations: ['Intellectual Property', 'Tech & Privacy', 'Commercial'], isVerified: true },
  { id: 'lawyer-12', name: 'Atty. Rafael Vicente Cruz, LL.B.', rollNumber: '53188', chapter: 'CEBU', specializations: ['Real Estate', 'Agrarian Reform', 'Estate Planning'], isVerified: true },
];

// ─── Entrance animation ──────────────────────────────────────────────────────
// One sequence, in this order:
//   1. The headline comes into focus word by word (blurry -> sharp),
//      which matches the copy: "Let's make it make sense".
//   2. The calendar is revealed with a left-to-right wipe.
//   3. The search box and lawyer list simply fade in, so they stay quiet
//      and don't compete with the headline.

const EASE = [0.16, 1, 0.3, 1] as const;

const HEADLINE_WORDS = ["Let's", 'make', 'it', 'make', 'sense,'];

// Parent: only controls timing. Children pick their own animation.
const page: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.18, delayChildren: 0.1 } },
};

// Headline: each word slides up from behind a mask and sharpens.
const headline: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};

const word: Variants = {
  hidden: { y: '105%', opacity: 0, filter: 'blur(10px)' },
  show: {
    y: '0%',
    opacity: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.8, ease: EASE },
  },
};

// Calendar: wipes open from the left edge.
// The negative values (-60px) make the clip area bigger than the calendar,
// so its box-shadow isn't cut off. If your shadow is larger than 60px,
// raise these numbers.
const wipe: Variants = {
  hidden: { clipPath: 'inset(-60px 100% -60px 0px)', opacity: 0.6 },
  show: {
    clipPath: 'inset(-60px -60px -60px -60px)',
    opacity: 1,
    transition: { duration: 1, ease: EASE },
  },
};

// Everything else: plain fade, nothing fancy.
const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.6, ease: 'easeOut' } },
};

interface DashboardViewProps {
  firstName: string;
}

export function DashboardView({ firstName }: DashboardViewProps) {
  const [lawyers, setLawyers] = useState<LawyerItem[]>(FALLBACK_LAWYERS);
  // If the user has "reduce motion" turned on in their device, skip the animation.
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('lawyer_profiles')
      .select('lawyer_id, practice_areas, hourly_rate')
      .limit(9)
      .then(({ data }) => {
        if (data && data.length > 0) {
          // Live data available but mapping kept simple for now
        }
      });
  }, []);

  return (
    <motion.div
      variants={page}
      initial={reduceMotion ? false : 'hidden'}
      animate="show"
      className="px-8 sm:px-12 lg:px-16 xl:px-20 py-6 sm:py-12 max-w-[1300px] mx-auto space-y-7 sm:space-y-8 bg-[#E5D8CB]"
    >
      {/* ─── Top Split Section: Greeting + Search Input & Calendar Card ─────── */}
      <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-12">
        {/* Left Column: takes all the space the calendar doesn't use */}
        <div className="w-full lg:flex-1 min-w-0 space-y-4 sm:space-y-5">
          <motion.h1
            variants={headline}
            className="font-lora text-2xl sm:text-3xl lg:text-[36px] xl:text-[42px] font-medium text-[#34150F] tracking-tight leading-[1.2]"
          >
            {HEADLINE_WORDS.map((w, i) => (
              // The outer span is the "mask" that hides the word before it slides up.
              // The small padding keeps letters like "g" and "y" from being clipped.
              <span
                key={`${w}-${i}`}
                className="inline-block overflow-hidden align-bottom pb-[0.12em] -mb-[0.12em] mr-[0.25em]"
              >
                <motion.span variants={word} className="inline-block will-change-transform">
                  {w}
                </motion.span>
              </span>
            ))}
            <span className="inline-block overflow-hidden align-bottom pb-[0.12em] -mb-[0.12em]">
              <motion.span
                variants={word}
                className="inline-block text-[#C58B3C] font-semibold will-change-transform"
              >
                {firstName}.
              </motion.span>
            </span>
          </motion.h1>

          <motion.div variants={fade} className="w-full">
            <DashboardSearchInput />
          </motion.div>
        </div>

        {/* Right Column: Calendar Widget. Change lg:w-[720px] to resize it;
            the left column adjusts automatically. */}
        <motion.div
          variants={wipe}
          className="w-full lg:w-[700px] lg:shrink-0 flex justify-center lg:justify-end"
        >
          <DashboardCalendar />
        </motion.div>
      </div>

      {/* ─── Recommended Lawyers ─────────────────────────────────────────────── */}
      <motion.div variants={fade} className="pt-1">
        <LawyerGridSection initialLawyers={lawyers} />
      </motion.div>
    </motion.div>
  );
}