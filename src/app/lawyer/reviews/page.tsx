import type { Metadata } from 'next';
import { LawyerReviewsView } from '@/components/lawyer/views/LawyerReviewsView';

export const metadata: Metadata = { title: 'My Reviews | Justicia Counsel Portal' };

export default function ReviewsPage() {
  return <LawyerReviewsView />;
}

