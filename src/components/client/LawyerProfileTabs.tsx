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
        {activeTab === 'reviews' && (
          <ReviewsTab lawyerId={profile.user_id} lawyerName={profile.full_name} />
        )}
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

// ─── Reviews Tab ────────────────────────────────────────────────────────────
interface ProfileReview {
  id: string;
  name: string;
  stars: number;
  date: string;
  content: string;
  helpfulCount: number;
  userVoted?: boolean;
  reply?: string;
}

function ReviewsTab({ lawyerId: _lawyerId, lawyerName }: { lawyerId: string; lawyerName: string }) {
  const [selectedStar, setSelectedStar] = useState<number | 'all'>('all');
  const [showWriteForm, setShowWriteForm] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newName, setNewName] = useState('');
  const [newFeedback, setNewFeedback] = useState('');
  const [submittedToast, setSubmittedToast] = useState(false);

  const [reviews, setReviews] = useState<ProfileReview[]>([
    {
      id: 'rev-p1',
      name: 'Maria Victoria Garcia',
      stars: 5,
      date: 'Oct 24, 2026',
      content:
        'Atty. is exceptionally thorough, patient, and knowledgeable about Philippine legal proceedings. Provided actionable advice right during our very first video consultation.',
      helpfulCount: 14,
      reply: 'Maraming salamat po, Ms. Garcia! Glad we could establish a clear path forward for your case.',
    },
    {
      id: 'rev-p2',
      name: 'Ramon De Jesus',
      stars: 5,
      date: 'Oct 12, 2026',
      content:
        'Highly recommended counsel. Handled our corporate documentation and contract review with utmost speed and attention to detail. Very fair professional fee.',
      helpfulCount: 8,
    },
    {
      id: 'rev-p3',
      name: 'Elena Santos',
      stars: 4,
      date: 'Sep 29, 2026',
      content:
        'Very helpful legal guidance regarding estate settlement. Straightforward advice and explained technical legal terms in simple terms we could easily understand.',
      helpfulCount: 5,
    },
    {
      id: 'rev-p4',
      name: 'Carlos Mendoza',
      stars: 5,
      date: 'Sep 15, 2026',
      content:
        'Professional, punctual, and very empathetic to our situation. Answered all follow-up questions promptly through the platform messaging.',
      helpfulCount: 9,
    },
  ]);

  const filteredReviews = reviews.filter((r) =>
    selectedStar === 'all' ? true : r.stars === selectedStar
  );

  const avgScore =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.stars, 0) / reviews.length
      : 5.0;

  const handleVoteHelpful = (id: string) => {
    setReviews((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const voted = !r.userVoted;
          return {
            ...r,
            userVoted: voted,
            helpfulCount: voted ? r.helpfulCount + 1 : r.helpfulCount - 1,
          };
        }
        return r;
      })
    );
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeedback.trim()) return;

    const newRev: ProfileReview = {
      id: `rev-${Date.now()}`,
      name: newName.trim() || 'Verified Client',
      stars: newRating,
      date: 'Just now',
      content: newFeedback.trim(),
      helpfulCount: 0,
    };

    setReviews((prev) => [newRev, ...prev]);
    setNewName('');
    setNewFeedback('');
    setShowWriteForm(false);
    setSubmittedToast(true);
    setTimeout(() => setSubmittedToast(false), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Top Rating Summary Card */}
      <div
        className="rounded-2xl p-6 bg-[#EFE5D8] flex flex-wrap items-center justify-between gap-5"
        style={{ boxShadow: '4px 4px 12px rgba(0,0,0,0.06),-4px -4px 12px rgba(255,255,255,0.9)' }}
      >
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="font-cormorant text-5xl font-bold text-[#34150F] leading-none">
            {avgScore.toFixed(1)}
          </span>
          <span className="text-xl font-semibold text-[#7D6855]">/ 5.0</span>
          <div className="flex items-center text-[#C58B3C] text-2xl ml-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <span key={s}>{s <= Math.round(avgScore) ? '★' : '☆'}</span>
            ))}
          </div>
          <span className="text-xs sm:text-sm text-[#7D6855] font-medium ml-2">
            ({reviews.length} Verified Reviews)
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowWriteForm((v) => !v)}
          className="px-4 py-2 rounded-xl bg-[#C58B3C] text-white text-xs font-semibold hover:bg-[#B07A2E] transition-colors shadow-sm"
        >
          {showWriteForm ? '✕ Close Form' : '★ Write a Review'}
        </button>
      </div>

      {/* Review Submission Form */}
      {showWriteForm && (
        <form
          onSubmit={handleSubmitReview}
          className="rounded-xl p-5 bg-[#F5EDE2] border border-[#E8DCCB] space-y-4"
          style={{ boxShadow: 'inset 1px 1px 4px rgba(0,0,0,0.04)' }}
        >
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm text-[#34150F]">
              Review your consultation with {lawyerName}
            </h4>
            <button
              type="button"
              onClick={() => setShowWriteForm(false)}
              className="text-[#7D6855] text-xs hover:text-[#34150F]"
            >
              Cancel
            </button>
          </div>

          <div>
            <label className="text-xs font-medium text-[#5C4535] block mb-1">Rating:</label>
            <div className="flex items-center gap-1.5 text-2xl text-[#C58B3C]">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setNewRating(star)}
                  className="transition-transform hover:scale-110 focus:outline-none"
                >
                  {star <= newRating ? '★' : '☆'}
                </button>
              ))}
              <span className="text-xs text-[#7D6855] ml-2">({newRating} of 5 stars)</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[#5C4535] block mb-1">Your Name:</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Maria Santos (or leave blank for Verified Client)"
              className="w-full px-3 py-2 rounded-lg text-xs bg-[#EFE5D8] border border-[#D8CAAD] text-[#34150F] placeholder-[#A69584] focus:outline-none focus:ring-1 focus:ring-[#C58B3C]"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[#5C4535] block mb-1">Feedback &amp; Experience:</label>
            <textarea
              rows={3}
              value={newFeedback}
              onChange={(e) => setNewFeedback(e.target.value)}
              placeholder="Share how counsel helped your legal inquiry, clarity of legal advice, punctuality..."
              required
              className="w-full px-3 py-2 rounded-lg text-xs bg-[#EFE5D8] border border-[#D8CAAD] text-[#34150F] placeholder-[#A69584] focus:outline-none focus:ring-1 focus:ring-[#C58B3C]"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowWriteForm(false)}
              className="px-4 py-1.5 rounded-lg text-xs text-[#5C4535] hover:text-[#34150F]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-[#C58B3C] text-white text-xs font-semibold hover:bg-[#B07A2E] transition-colors"
            >
              Submit Review
            </button>
          </div>
        </form>
      )}

      {/* Success Notice */}
      {submittedToast && (
        <div className="p-3.5 rounded-xl bg-[#D4C1AB]/40 border border-[#C58B3C]/50 text-xs text-[#34150F] flex items-center gap-2">
          <span>✓</span>
          <span className="font-medium">Thank you! Your review has been submitted successfully.</span>
        </div>
      )}

      {/* Star Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedStar('all')}
          className={`px-3.5 py-1 rounded-full text-xs font-medium transition-all ${
            selectedStar === 'all'
              ? 'bg-[#C58B3C] text-white shadow-sm'
              : 'bg-[#EFE5D8] text-[#5C4535] hover:bg-[#D4C1AB]'
          }`}
        >
          All ({reviews.length})
        </button>
        {[5, 4, 3, 2, 1].map((s) => {
          const count = reviews.filter((r) => r.stars === s).length;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSelectedStar(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                selectedStar === s
                  ? 'bg-[#C58B3C] text-white shadow-sm'
                  : 'bg-[#EFE5D8] text-[#5C4535] hover:bg-[#D4C1AB]'
              }`}
            >
              ★{s} ({count})
            </button>
          );
        })}
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {filteredReviews.map((rev) => (
          <div
            key={rev.id}
            className="rounded-xl p-5 bg-[#EFE5D8] space-y-3"
            style={{ boxShadow: '4px 4px 10px rgba(0,0,0,0.05),-4px -4px 10px rgba(255,255,255,0.9)' }}
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#D4C1AB] text-[#34150F] flex items-center justify-center font-bold text-xs">
                  {rev.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-semibold text-xs text-[#34150F]">{rev.name}</h4>
                  <p className="text-[10px] text-[#A69584]">{rev.date}</p>
                </div>
              </div>
              <div className="flex items-center text-[#C58B3C] text-xs">
                {'★'.repeat(rev.stars)}{'☆'.repeat(5 - rev.stars)}
              </div>
            </div>

            <p className="text-xs text-[#5C4535] leading-relaxed">{rev.content}</p>

            {rev.reply && (
              <div className="p-3 rounded-lg bg-[#F5EDE2] border border-[#E8DCCB] text-xs space-y-1">
                <p className="font-semibold text-[11px] text-[#34150F] flex items-center gap-1.5">
                  <span>⚖️</span> Response from {lawyerName}
                </p>
                <p className="text-[#5C4535] text-xs leading-relaxed">{rev.reply}</p>
              </div>
            )}

            <div className="pt-1 flex items-center gap-4 text-[11px] text-[#7D6855]">
              <button
                type="button"
                onClick={() => handleVoteHelpful(rev.id)}
                className={`flex items-center gap-1.5 hover:text-[#34150F] transition-colors ${
                  rev.userVoted ? 'text-[#C58B3C] font-semibold' : ''
                }`}
              >
                <span>👍</span>
                <span>Helpful ({rev.helpfulCount})</span>
              </button>
            </div>
          </div>
        ))}

        {filteredReviews.length === 0 && (
          <p className="text-center py-8 text-xs text-[#A69584]">
            No reviews match this star rating.
          </p>
        )}
      </div>
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
