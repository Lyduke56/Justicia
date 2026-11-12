'use client';

import { useEffect, useState, type SetStateAction } from 'react';
import { getLawyerReviewsAction, type SerializedReview } from '@/app/actions/reviewActions';

type ReviewState = { lawyerId?: string; reviews: SerializedReview[]; error: string };

/** Always load persisted reviews; never merge browser caches or sample data. */
export function useLawyerReviews(lawyerId?: string) {
  const [state, setState] = useState<ReviewState | null>(null);
  useEffect(() => {
    let active = true;
    getLawyerReviewsAction(lawyerId).then(result => {
      if (!active) return;
      setState({ lawyerId, reviews: result.success ? result.reviews : [], error: result.error || '' });
    }).catch(() => {
      if (active) setState({ lawyerId, reviews: [], error: 'Unable to load reviews. Please refresh to try again.' });
    });
    return () => { active = false; };
  }, [lawyerId]);
  const current = state?.lawyerId === lawyerId ? state : null;
  const setReviews = (update: SetStateAction<SerializedReview[]>) => setState(previous => {
    if (!previous || previous.lawyerId !== lawyerId) return previous;
    return { ...previous, reviews: typeof update === 'function' ? update(previous.reviews) : update };
  });
  return { reviews: current?.reviews || [], setReviews, loading: !current, error: current?.error || '' };
}
