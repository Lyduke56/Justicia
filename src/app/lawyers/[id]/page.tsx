import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { LawyerProfileTabs } from '@/components/client/LawyerProfileTabs';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('lawyer_profiles')
    .select('full_name, ibp_chapter, practice_areas')
    .eq('user_id', id)
    .eq('verification_status', 'approved')
    .eq('is_visible', true)
    .single();

  if (!data) return { title: 'Lawyer Not Found' };

  return {
    title: data.full_name,
    description: `View the profile of ${data.full_name}, a verified lawyer${data.ibp_chapter ? ` from IBP ${data.ibp_chapter}` : ''} specializing in ${(data.practice_areas ?? []).slice(0, 3).join(', ')}.`,
  };
}

export default async function PublicLawyerProfilePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch profile — only approved + visible
  const { data: profile } = await supabase
    .from('lawyer_profiles')
    .select('*')
    .eq('user_id', id)
    .eq('verification_status', 'approved')
    .eq('is_visible', true)
    .single();

  if (!profile) notFound();

  // Fetch child tables in parallel
  const [
    { data: practiceAreas },
    { data: experiences },
    { data: services },
    { data: education },
    { data: caseSummaries },
  ] = await Promise.all([
    supabase.from('lawyer_practice_areas_detail').select('*').eq('lawyer_id', id).order('sort_order'),
    supabase.from('lawyer_experience').select('*').eq('lawyer_id', id).order('sort_order'),
    supabase.from('lawyer_services').select('*').eq('lawyer_id', id).order('sort_order'),
    supabase.from('lawyer_education').select('*').eq('lawyer_id', id).order('sort_order'),
    supabase.from('lawyer_case_summaries').select('*').eq('lawyer_id', id).order('sort_order'),
  ]);

  return (
    <div className="max-w-5xl mx-auto p-5 sm:p-8 space-y-6">
      {/* ─── Header Card ──────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6 bg-[#EFE5D8] flex flex-col sm:flex-row gap-5 items-start"
        style={{ boxShadow: '5px 5px 15px rgba(0,0,0,0.07),-5px -5px 15px rgba(255,255,255,0.9)' }}
      >
        {/* Avatar */}
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-[#5C4535]/60 flex items-center justify-center shrink-0 overflow-hidden bg-[#D4C1AB]">
          {profile.photo_url ? (
            <Image src={profile.photo_url} alt={profile.full_name} width={96} height={96} className="object-cover w-full h-full" />
          ) : (
            <svg className="w-12 h-12 text-[#5C4535]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="8" r="4" />
              <path d="M6 20v-1a6 6 0 0 1 12 0v1" />
            </svg>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 space-y-1">
          <h1 className="font-cormorant text-2xl sm:text-3xl font-bold text-[#34150F]">{profile.full_name}</h1>
          <p className="text-sm text-[#7D6855]">
            Roll No. {profile.roll_number}{profile.ibp_chapter && ` | IBP ${profile.ibp_chapter}`}
          </p>
          <p className="text-xs text-[#A69584] flex items-center gap-3 flex-wrap">
            {profile.experience_years && (
              <span>● {profile.experience_years} years of practice</span>
            )}
            {profile.bar_passer_year && (
              <span>● Bar Passer {profile.bar_passer_year}</span>
            )}
          </p>
          <p className="text-xs text-[#695444] mt-1">
            {(profile.practice_areas ?? []).join(' • ')}
          </p>
        </div>

        {/* Rate + Book button */}
        <div className="sm:text-right space-y-3 shrink-0">
          {profile.fee_standard_60min && (
            <div>
              <span className="text-2xl font-bold text-[#34150F]">₱{profile.fee_standard_60min.toLocaleString()}</span>
              <span className="text-sm text-[#7D6855] ml-1">/per hour</span>
            </div>
          )}
          <Link
            href="#book"
            id="book-consultation-btn"
            className="inline-block px-5 py-2.5 rounded-xl bg-[#C58B3C] text-white text-sm font-semibold hover:bg-[#B07A2E] transition-colors shadow-md"
            aria-label="Book a consultation with this lawyer"
          >
            Book Consultation
          </Link>
          <p className="text-[10px] text-[#A69584]" id="book">Coming soon — booking is in development</p>
        </div>
      </div>

      {/* ─── Profile Tabs ─────────────────────────────────────────────────── */}
      <LawyerProfileTabs
        profile={profile}
        practiceAreas={practiceAreas ?? []}
        experiences={experiences ?? []}
        services={services ?? []}
        education={education ?? []}
        caseSummaries={caseSummaries ?? []}
      />
    </div>
  );
}
