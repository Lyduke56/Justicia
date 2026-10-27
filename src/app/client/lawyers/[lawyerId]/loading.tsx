import React from 'react';
import { LawyerDetailSkeleton } from '@/components/skeletons';

export default function LawyerDetailLoading() {
  return (
    <div className="p-4 sm:p-8">
      <LawyerDetailSkeleton />
    </div>
  );
}
