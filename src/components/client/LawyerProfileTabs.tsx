'use client';

import { useState } from 'react';
import type {
  LawyerProfileRow,
  LawyerPracticeAreaDetailRow,
  LawyerExperienceRow,
  LawyerServiceRow,
  LawyerEducationRow,
  LawyerCaseSummaryRow,
} from '@/types/database';

interface Props {
  profile: LawyerProfileRow;
  practiceAreas: LawyerPracticeAreaDetailRow[];
  experiences: LawyerExperienceRow[];
  services: LawyerServiceRow[];
  education: LawyerEducationRow[];
  caseSummaries: LawyerCaseSummaryRow[];
}

type Tab = 'about' | 'reviews' | 'availability' | 'cases';

export function LawyerProfileTabs({
  profile,
  practiceAreas,
  experiences,
  services,
  education,
  caseSummaries,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('about');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'about', label: 'About' },
    { id: 'reviews', label: 'Reviews' },
    { id: 'availability', label: 'Availability' },
    { id: 'cases', label: 'Cases Handled' },
  ];

  return (
    <div className="space-y-5">
      {/* Tab buttons */}
      <nav className="flex gap-1 sm:gap-2 border-b border-[#D8CAAD]" aria-label="Profile sections">
        {tabs.map(tab => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-[#C58B3C] text-[#C58B3C] bg-[#F5EDE2]'
                : 'border-transparent text-[#7D6855] hover:text-[#34150F] hover:bg-[#EFE5D8]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab panels */}
      <div role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
        {activeTab === 'about' && (
          <AboutTab
            profile={profile}
            practiceAreas={practiceAreas}
            experiences={experiences}
            services={services}
            education={education}
          />
        )}
        {activeTab === 'reviews' && <ComingSoonTab label="Reviews" />}
        {activeTab === 'availability' && <ComingSoonTab label="Availability" />}
        {activeTab === 'cases' && <CasesTab caseSummaries={caseSummaries} />}
      </div>
    </div>
  );
}

// ─── About Tab ────────────────────────────────────────────────────────────────
function AboutTab({
  profile,
  practiceAreas,
  experiences,
  services,
  education,
}: Omit<Props, 'caseSummaries'>) {
  return (
    <div className="space-y-6">
      {/* About + Rates */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* About text — 2/3 width */}
        <div className="md:col-span-2">
          {profile.about ? (
            <p className="text-sm text-[#34150F] leading-relaxed">{profile.about}</p>
          ) : (
            <p className="text-sm text-[#A69584] italic">No bio available.</p>
          )}
        </div>

        {/* Consultation Rates card */}
        <div
          className="rounded-2xl p-5 bg-[#EFE5D8] space-y-3 h-fit"
          style={{ boxShadow: '5px 5px 12px rgba(0,0,0,0.06),-5px -5px 12px rgba(255,255,255,0.9)' }}
        >
          <h2 className="font-cormorant text-lg font-bold text-[#34150F]">Consultation Rates:</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-baseline">
              <span className="text-[#5C4535]">Initial Consultation (30 mins)</span>
              {profile.fee_initial_30min ? (
                <span className="font-semibold text-[#34150F]">
                  ₱{profile.fee_initial_30min.toLocaleString()}
                  <span className="text-[#A69584] font-normal text-xs ml-1">/session</span>
                </span>
              ) : (
                <span className="text-[#A69584] text-xs">—</span>
              )}
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[#5C4535]">Standard Consultation (1 hr)</span>
              {profile.fee_standard_60min ? (
                <span className="font-semibold text-[#34150F]">
                  ₱{profile.fee_standard_60min.toLocaleString()}
                  <span className="text-[#A69584] font-normal text-xs ml-1">/hour</span>
                </span>
              ) : (
                <span className="text-[#A69584] text-xs">—</span>
              )}
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[#5C4535]">Extended Consultation (2 hrs)</span>
              {profile.fee_extended_120min ? (
                <span className="font-semibold text-[#34150F]">
                  ₱{profile.fee_extended_120min.toLocaleString()}
                  <span className="text-[#A69584] font-normal text-xs ml-1">/hour</span>
                </span>
              ) : (
                <span className="text-[#A69584] text-xs">—</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Professional Background */}
      {(practiceAreas.length > 0 || experiences.length > 0 || services.length > 0 || profile.bar_passer_year) && (
        <section className="space-y-4">
          <h2 className="font-cormorant text-xl font-bold text-[#34150F]">Professional Background</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Areas of Practice */}
            {practiceAreas.length > 0 && (
              <InfoCard title="Areas of Practice">
                <ul className="list-disc list-inside space-y-1 text-sm text-[#34150F]">
                  {practiceAreas.map(pa => (
                    <li key={pa.id}>{pa.area}{pa.description && `: ${pa.description}`}</li>
                  ))}
                </ul>
              </InfoCard>
            )}

            {/* Legal Experience */}
            {experiences.length > 0 && (
              <InfoCard title="Legal Experience">
                <ul className="list-disc list-inside space-y-1 text-sm text-[#34150F]">
                  {experiences.map(exp => (
                    <li key={exp.id}>
                      {exp.title}{exp.organization && ` — ${exp.organization}`}
                      {exp.years && <span className="text-[#7D6855] text-xs ml-1">({exp.years})</span>}
                      {exp.description && <p className="ml-4 text-xs text-[#5C4535] mt-0.5">{exp.description}</p>}
                    </li>
                  ))}
                </ul>
              </InfoCard>
            )}

            {/* Consultation Services */}
            {services.length > 0 && (
              <InfoCard title="Consultation Services">
                <ul className="list-disc list-inside space-y-1 text-sm text-[#34150F]">
                  {services.map(svc => (
                    <li key={svc.id}>
                      {svc.name}
                      {svc.description && <p className="ml-4 text-xs text-[#5C4535] mt-0.5">{svc.description}</p>}
                    </li>
                  ))}
                </ul>
              </InfoCard>
            )}

            {/* Philippine Bar Passer */}
            {profile.bar_passer_year && (
              <InfoCard title={`Philippine Bar Examination Passer (${profile.bar_passer_year})`}>
                <p className="text-sm text-[#34150F]">
                  Passed the Philippine Bar Examination in {profile.bar_passer_year}.
                </p>
              </InfoCard>
            )}
          </div>
        </section>
      )}

      {/* Educational Background */}
      {education.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-cormorant text-xl font-bold text-[#34150F]">Educational Background</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {education.map(edu => (
              <div
                key={edu.id}
                className="rounded-xl p-5 bg-[#EFE5D8] space-y-2"
                style={{ boxShadow: '4px 4px 10px rgba(0,0,0,0.05),-4px -4px 10px rgba(255,255,255,0.9)' }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#D4C1AB] flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-[#C58B3C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-[#34150F]">
                      {edu.degree}
                      {(edu.start_year || edu.end_year) && (
                        <span className="font-normal text-[#7D6855] ml-2 text-xs">
                          ({edu.start_year && edu.end_year ? `${edu.start_year} – ${edu.end_year}` : edu.start_year || edu.end_year})
                        </span>
                      )}
                    </h3>
                    {edu.school && <p className="text-xs text-[#7D6855]">{edu.school}</p>}
                  </div>
                </div>
                {edu.description && (
                  <ul className="list-disc list-inside space-y-0.5 text-xs text-[#34150F] ml-10">
                    {edu.description.split('\n').map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Cases Tab ─────────────────────────────────────────────────────────────────
function CasesTab({ caseSummaries }: { caseSummaries: LawyerCaseSummaryRow[] }) {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-[#F5EDE2] border border-[#E8DCCB] text-xs text-[#7D6855]">
        <strong>Confidentiality Notice:</strong> All case summaries below are anonymized. No client names, case numbers, or privileged information are disclosed. This is a summary of types of matters handled.
      </div>
      {caseSummaries.length === 0 ? (
        <p className="text-sm text-[#A69584] italic py-8 text-center">No case summaries available.</p>
      ) : (
        <div className="space-y-4">
          {caseSummaries.map(c => (
            <div
              key={c.id}
              className="rounded-xl p-5 bg-[#EFE5D8] space-y-2"
              style={{ boxShadow: '4px 4px 10px rgba(0,0,0,0.05),-4px -4px 10px rgba(255,255,255,0.9)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-sm text-[#34150F]">{c.title}</h3>
                <div className="flex gap-2 shrink-0">
                  {c.practice_area && (
                    <span className="px-2 py-0.5 rounded-full bg-[#C58B3C]/15 text-[#C58B3C] text-[10px] font-medium">{c.practice_area}</span>
                  )}
                  {c.year && (
                    <span className="px-2 py-0.5 rounded-full bg-[#D4C1AB] text-[#5C4535] text-[10px]">{c.year}</span>
                  )}
                </div>
              </div>
              <p className="text-xs text-[#5C4535] leading-relaxed">{c.anonymized_summary}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Coming Soon Tab ──────────────────────────────────────────────────────────
function ComingSoonTab({ label }: { label: string }) {
  return (
    <div className="py-16 text-center space-y-3">
      <div className="text-4xl">🚧</div>
      <p className="text-[#5C4535] font-medium">{label} — Coming Soon</p>
      <p className="text-[#A69584] text-sm">This feature is under development and will be available soon.</p>
    </div>
  );
}

// ─── Shared InfoCard ──────────────────────────────────────────────────────────
function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-5 bg-[#EFE5D8] space-y-2.5"
      style={{ boxShadow: '4px 4px 10px rgba(0,0,0,0.05),-4px -4px 10px rgba(255,255,255,0.9)' }}
    >
      <h3 className="font-semibold text-sm text-[#34150F]">{title}</h3>
      {children}
    </div>
  );
}
