'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { PublicLawyerProfile } from './LawyerGrid';
import type { ProfileContent } from '@/hooks/useLawyerProfileContent';
import type { LawyerCaseSummaryRow, ReviewRow } from '@/types/database';
import { DataState, Pagination } from '@/components/ui/PortalUI';

export function ProfileCases({ cases, loading, error, onRetry }: { cases: LawyerCaseSummaryRow[]; loading: boolean; error?: string; onRetry: () => void }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(cases.length / 4);
  const currentPage = Math.min(page, Math.max(1, totalPages));
  if (loading) return <DataState title="Loading case summaries" loading />;
  if (error) return <DataState title="Case summaries could not be loaded" onRetry={onRetry}>{error}</DataState>;
  if (!cases.length) return <DataState title="No case summaries published yet">Public, anonymized summaries will appear here when the lawyer adds them.</DataState>;
  return <div className="profile-cases">
    {cases.slice((currentPage - 1) * 4, currentPage * 4).map((item, index) => <article key={item.id} className={`profile-case ${index === 0 ? 'profile-case-featured' : ''}`}>
      <p className="portal-eyebrow">{[item.practice_area, item.year].filter(Boolean).join(' · ') || 'Case summary'}</p>
      <h2>{item.title}</h2>
      <p className="profile-case-copy">{item.anonymized_summary}</p>
    </article>)}
    <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} label="Cases" />
  </div>;
}

export function ProfileAbout({ lawyer, data, loading, error, onRetry }: { lawyer: PublicLawyerProfile; data: ProfileContent; loading: boolean; error?: boolean; onRetry: () => void }) {
  return <div className="profile-about">
    <div className="profile-about-top">
      <section className="portal-surface portal-surface-inset"><h2 className="portal-section-title">About {lawyer.fullName}</h2><p className="portal-copy whitespace-pre-line">{lawyer.about || 'This lawyer has not added a biography yet.'}</p></section>
      <section className="portal-surface portal-surface-highlight"><h2 className="portal-section-title">Consultation rates</h2>
        <dl className="profile-rates">{[['Initial · 30 minutes', lawyer.feeInitial30min], ['Standard · 60 minutes', lawyer.feeStandard60min], ['Extended · 120 minutes', lawyer.feeExtended120min]].map(([label, fee]) => <div key={String(label)}><dt>{label}</dt><dd>{typeof fee === 'number' ? `₱${fee.toLocaleString()}` : 'Not listed'}</dd></div>)}</dl>
      </section>
    </div>
    {loading ? <DataState title="Loading professional background" loading /> : error ? <DataState title="Some profile details could not be loaded" onRetry={onRetry} /> : <div className="profile-about-grid">
      <section className="portal-surface"><h2 className="portal-section-title">Practice areas & services</h2>
        {data.practiceAreas.length ? data.practiceAreas.map(area => <div className="profile-detail-entry" key={area.id}><h3>{area.area}</h3>{area.description && <p>{area.description}</p>}</div>) : <p className="portal-copy">{lawyer.practiceAreas.join(' · ') || 'No practice areas listed.'}</p>}
        {data.services.map(service => <div className="profile-detail-entry" key={service.id}><h3>{service.name}</h3><p>{service.description}</p></div>)}
      </section>
      <section className="portal-surface"><h2 className="portal-section-title">Professional background</h2>
        {data.experience.length ? data.experience.map(item => <div className="profile-detail-entry" key={item.id}><h3>{item.title}</h3><p>{[item.organization, item.years].filter(Boolean).join(' · ')}</p>{item.description && <p>{item.description}</p>}</div>) : <p className="portal-copy">No professional history listed yet.</p>}
      </section>
      <section className="portal-surface"><h2 className="portal-section-title">Education</h2>
        {data.education.length ? data.education.map(item => <div className="profile-detail-entry" key={item.id}><h3>{item.degree}</h3><p>{item.school}</p>{item.description && <p>{item.description}</p>}</div>) : <p className="portal-copy">No education details listed yet.</p>}
      </section>
      <section className="portal-surface"><h2 className="portal-section-title">Languages</h2><p className="portal-copy">{lawyer.languages.join(' · ') || 'No languages listed.'}</p></section>
    </div>}
  </div>;
}

export function ProfileReviews({ lawyerId, reviews, loading, error, onRetry }: { lawyerId: string; reviews: ReviewRow[]; loading: boolean; error?: string; onRetry: () => void }) {
  const [filter, setFilter] = useState(0);
  const [page, setPage] = useState(1);
  const [writing, setWriting] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const filtered = reviews.filter(review => !filter || review.rating === filter);
  const totalPages = Math.ceil(filtered.length / 4);
  const currentPage = Math.min(page, Math.max(1, totalPages));
  const average = reviews.length ? reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length : null;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true); setNotice('');
    try {
      const client = createClient();
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error('Please sign in to leave a review.');
      const { data: completed, error: lookupError } = await client.from('consultations').select('id').eq('client_id', user.id).eq('lawyer_id', lawyerId).eq('status', 'completed').limit(1);
      if (lookupError) throw new Error('We could not verify your completed consultation. Please try again.');
      if (!completed?.length) throw new Error('You can leave a review after a completed consultation with this lawyer.');
      const { error: insertError } = await client.from('reviews').insert({ lawyer_id: lawyerId, client_id: user.id, rating, comment: comment.trim() });
      if (insertError) throw new Error('Your review could not be saved. Please try again.');
      setComment(''); setWriting(false); setNotice('Your review has been published.'); onRetry();
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : 'Unable to save your review.'); }
    finally { setSaving(false); }
  }
  if (loading) return <DataState title="Loading reviews" loading />;
  if (error) return <DataState title="Reviews could not be loaded" onRetry={onRetry}>{error}</DataState>;
  return <div className="profile-reviews">
    <section className="portal-surface">
      <div className="profile-review-heading"><div><strong className="profile-rating">{average === null ? '—' : average.toFixed(1)}<small>/5</small></strong><span className="portal-copy">{reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</span></div><button type="button" className="portal-button portal-button-secondary" onClick={() => setWriting(!writing)}>{writing ? 'Cancel' : 'Write a review'}</button></div>
      <div className="portal-filters" aria-label="Filter reviews">{[0, 5, 4, 3, 2, 1].map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(1); }}>{value ? `★ ${value}` : 'All reviews'}</button>)}</div>
      {notice && <p role="status" className="portal-notice">{notice}</p>}
      {writing && <form onSubmit={submit} className="profile-review-form">
        <label htmlFor="review-rating">Rating</label><select id="review-rating" className="portal-field" value={rating} onChange={event => setRating(Number(event.target.value))}>{[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} stars</option>)}</select>
        <label htmlFor="review-comment">Your experience</label><textarea id="review-comment" className="portal-field" rows={4} required maxLength={3000} value={comment} onChange={event => setComment(event.target.value)} />
        <button type="submit" className="portal-button" disabled={saving} aria-busy={saving}>{saving ? 'Publishing…' : 'Publish review'}</button>
      </form>}
      {!filtered.length ? <DataState title={reviews.length ? 'No reviews with this rating' : 'No reviews yet'}>Feedback from clients will appear here after their consultations.</DataState> : <div className="profile-review-list">{filtered.slice((currentPage - 1) * 4, currentPage * 4).map(review => <article className="portal-surface portal-surface-highlight" key={review.id}>
        <div className="flex items-center justify-between gap-3"><h3>Client review</h3><time className="portal-copy" dateTime={review.created_at}>{new Date(review.created_at).toLocaleDateString('en-PH', { dateStyle: 'medium' })}</time></div>
        <p className="profile-review-stars" aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</p><p className="portal-copy whitespace-pre-line">{review.comment || 'This client left a rating without a comment.'}</p>
      </article>)}</div>}
    </section>
    <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} label="Reviews" />
  </div>;
}
