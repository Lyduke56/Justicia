'use client';

import React, { useState } from 'react';
import { addReviewReplyAction } from '@/app/actions/reviewActions';
import { useLawyerReviews } from '@/components/client/useLawyerReviews';

interface LawyerReviewItem {
  id: string;
  clientName: string;
  category: string;
  stars: number;
  date: string;
  feedback: string;
  reply?: string;
  flagged?: boolean;
}

export function LawyerReviewsView() {
  const { reviews: savedReviews, setReviews: setSavedReviews, loading, error } = useLawyerReviews();
  const reviews: LawyerReviewItem[] = savedReviews.map(r => ({
    id: r.id, clientName: r.name, category: 'Legal Consultation', stars: r.stars,
    date: r.date, feedback: r.content, reply: r.reply,
  }));
  const [selectedFilter, setSelectedFilter] = useState<'all' | '5' | '4' | 'needs_reply'>('all');
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [flagToast, setFlagToast] = useState<string | null>(null);

  const filteredReviews = reviews.filter((r) => {
    if (selectedFilter === '5') return r.stars === 5;
    if (selectedFilter === '4') return r.stars === 4;
    if (selectedFilter === 'needs_reply') return !r.reply;
    return true;
  });

  const handlePostReply = async (id: string) => {
    if (!replyDraft.trim()) return;
    const cleanReply = replyDraft.trim();
    const result = await addReviewReplyAction({ reviewId: id, replyText: cleanReply });
    if (!result.success) { setFlagToast(result.error || 'Unable to save reply.'); return; }
    setSavedReviews(prev => prev.map(r => r.id === id ? { ...r, reply: cleanReply } : r));

    setReplyingId(null);
    setReplyDraft('');
  };

  const handleFlagReview = () => {
    setFlagToast('Please contact support to report a review.');
    setTimeout(() => setFlagToast(null), 4000);
  };

  return (
    <div className="p-6 sm:p-10 lg:p-12 max-w-7xl mx-auto space-y-7">
      {loading && <p role="status">Loading reviews…</p>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {/* ── Top Header Title ────────────────────────────────────────────────── */}
      <div className="space-y-1">
        <h1 className="font-cormorant text-3xl sm:text-4xl font-bold text-[#34150F]">
          Client Reviews &amp; Ratings
        </h1>
        <p className="text-xs sm:text-sm text-[#5C4535]">
          Track client feedback, satisfaction metrics, and reply to client testimonials.
        </p>
      </div>

      {/* ── 4 KPI Cards (Matching Figma Layout) ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="neu-card-md rounded-[28px] p-5 flex flex-col justify-between">
          <h3 className="font-cormorant text-base sm:text-lg font-bold text-[#34150F]">
            Overall Rating
          </h3>
          <div className="neu-plate rounded-2xl p-4 mt-3 flex flex-col justify-between min-h-[92px]">
            <div className="flex items-center gap-3">
              <span className="text-2xl text-[#C58B3C]">★</span>
              <span className="font-cormorant text-3xl sm:text-4xl font-bold text-[#34150F] leading-none">
                {reviews.length ? (reviews.reduce((sum, r) => sum + r.stars, 0) / reviews.length).toFixed(2) : '0.00'}
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-[#5C4535] mt-2 font-medium leading-tight">
              Based on {reviews.length} verified client reviews
            </p>
          </div>
        </div>

        <div className="neu-card-md rounded-[28px] p-5 flex flex-col justify-between">
          <h3 className="font-cormorant text-base sm:text-lg font-bold text-[#34150F]">
            5-Star Satisfaction
          </h3>
          <div className="neu-plate rounded-2xl p-4 mt-3 flex flex-col justify-between min-h-[92px]">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏆</span>
              <span className="font-cormorant text-3xl sm:text-4xl font-bold text-[#34150F] leading-none">
                {reviews.length ? Math.round(reviews.filter(r => r.stars === 5).length / reviews.length * 100) : 0}%
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-[#5C4535] mt-2 font-medium leading-tight">
              {reviews.filter(r => r.stars === 5).length} of {reviews.length} clients gave top marks
            </p>
          </div>
        </div>

        <div className="neu-card-md rounded-[28px] p-5 flex flex-col justify-between">
          <h3 className="font-cormorant text-base sm:text-lg font-bold text-[#34150F]">
            Response Rate
          </h3>
          <div className="neu-plate rounded-2xl p-4 mt-3 flex flex-col justify-between min-h-[92px]">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💬</span>
              <span className="font-cormorant text-3xl sm:text-4xl font-bold text-[#34150F] leading-none">
                {reviews.length ? Math.round(reviews.filter(r => r.reply).length / reviews.length * 100) : 0}%
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-[#5C4535] mt-2 font-medium leading-tight">
              Reviews with a counsel reply
            </p>
          </div>
        </div>

        <div className="neu-card-md rounded-[28px] p-5 flex flex-col justify-between">
          <h3 className="font-cormorant text-base sm:text-lg font-bold text-[#34150F]">
            Pending Replies
          </h3>
          <div className="neu-plate rounded-2xl p-4 mt-3 flex flex-col justify-between min-h-[92px]">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏳</span>
              <span className="font-cormorant text-3xl sm:text-4xl font-bold text-[#34150F] leading-none">
                {reviews.filter((r) => !r.reply).length}
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-[#5C4535] mt-2 font-medium leading-tight">
              Reviews awaiting counsel response
            </p>
          </div>
        </div>
      </div>

      {/* ── Section Divider ─────────────────────────────────────────────────── */}
      <hr className="border-[#C8B59E]/40" />

      {/* Flag Toast Notification */}
      {flagToast && (
        <div className="p-4 rounded-2xl bg-[#DFC5A4] border border-[#C58B3C]/60 text-xs text-[#23150F] flex items-center justify-between">
          <span>✓ {flagToast}</span>
          <button type="button" onClick={() => setFlagToast(null)} className="font-bold">✕</button>
        </div>
      )}

      {/* ── Filter Controls ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="neu-plate rounded-full px-6 py-2.5 text-sm font-bold text-[#34150F] inline-flex items-center self-start">
          Client Feedback Feed
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedFilter('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              selectedFilter === 'all'
                ? 'neu-inset-sm text-[#34150F] font-bold'
                : 'neu-plate-sm text-[#5C4535] hover:text-[#34150F]'
            }`}
          >
            All ({reviews.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('5')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              selectedFilter === '5'
                ? 'neu-inset-sm text-[#34150F] font-bold'
                : 'neu-plate-sm text-[#5C4535] hover:text-[#34150F]'
            }`}
          >
            ★ 5 Stars ({reviews.filter((r) => r.stars === 5).length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('4')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              selectedFilter === '4'
                ? 'neu-inset-sm text-[#34150F] font-bold'
                : 'neu-plate-sm text-[#5C4535] hover:text-[#34150F]'
            }`}
          >
            ★ 4 Stars ({reviews.filter((r) => r.stars === 4).length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('needs_reply')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              selectedFilter === 'needs_reply'
                ? 'neu-inset-sm text-[#34150F] font-bold'
                : 'neu-plate-sm text-[#5C4535] hover:text-[#34150F]'
            }`}
          >
            Needs Response ({reviews.filter((r) => !r.reply).length})
          </button>
        </div>
      </div>

      {/* ── Review Cards List ───────────────────────────────────────────────── */}
      <div className="space-y-4">
        {filteredReviews.map((rev) => (
          <div
            key={rev.id}
            className="neu-card-md rounded-[28px] p-6 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-cormorant text-xl font-bold text-[#34150F]">
                    {rev.clientName}
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#C58B3C]/15 text-[#C58B3C] text-[10px] font-semibold">
                    {rev.category}
                  </span>
                  {rev.flagged && (
                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-semibold">
                      Under Review
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center text-[#C58B3C] text-sm">
                    {'★'.repeat(rev.stars)}{'☆'.repeat(5 - rev.stars)}
                  </div>
                  <span className="text-[11px] text-[#7D6855] font-medium">
                    {rev.date}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 self-start sm:self-center">
                {!rev.reply && (
                  <button
                    type="button"
                    onClick={() => {
                      setReplyingId(replyingId === rev.id ? null : rev.id);
                      setReplyDraft('');
                    }}
                    className="px-4 py-1.5 rounded-full bg-[#C58B3C] hover:bg-[#B3792E] text-white text-xs font-semibold shadow-sm transition-all"
                  >
                    Respond
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleFlagReview()}
                  disabled={rev.flagged}
                  className="px-3 py-1.5 rounded-full text-xs text-[#7D6855] hover:text-red-700 disabled:opacity-40 transition-colors"
                  title="Flag inappropriate review"
                >
                  Flag
                </button>
              </div>
            </div>

            <p className="text-xs sm:text-[13px] text-[#34150F] leading-relaxed">
              {rev.feedback}
            </p>

            {/* Counsel response bubble */}
            {rev.reply && (
              <div className="neu-plate rounded-2xl p-4 text-xs space-y-1">
                <div className="flex items-center gap-2 font-semibold text-[#34150F]">
                  <span>⚖️</span>
                  <span>Your Response:</span>
                </div>
                <p className="text-[#5C4535] leading-relaxed">{rev.reply}</p>
              </div>
            )}

            {/* Inline reply editor */}
            {replyingId === rev.id && (
              <div className="neu-plate rounded-2xl p-4 space-y-3">
                <label className="text-xs font-semibold text-[#34150F] block">
                  Write public response to {rev.clientName}:
                </label>
                <textarea
                  rows={2}
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  placeholder="Thank the client or clarify the case outcome..."
                  className="w-full p-3 rounded-xl text-xs bg-[#ECE1D2] border border-[#D5C2AB] text-[#23150F] focus:outline-none focus:ring-1 focus:ring-[#C58B3C]"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReplyingId(null);
                      setReplyDraft('');
                    }}
                    className="px-3 py-1 text-xs text-[#5C4535] hover:text-[#23150F]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePostReply(rev.id)}
                    className="px-4 py-1.5 rounded-full bg-[#C58B3C] hover:bg-[#B3792E] text-white text-xs font-semibold shadow-sm"
                  >
                    Post Response
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {filteredReviews.length === 0 && (
          <div className="py-12 text-center text-xs text-[#7D6855]">
            {loading ? 'Loading reviews…' : error ? 'Reviews are currently unavailable.' : reviews.length === 0 ? 'No consultation reviews yet.' : 'No reviews match this filter.'}
          </div>
        )}
      </div>
    </div>
  );
}

export default LawyerReviewsView;
