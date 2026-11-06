'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { LawyerCaseSummaryRow, LawyerEducationRow, LawyerExperienceRow, LawyerPracticeAreaDetailRow, LawyerServiceRow, ReviewRow } from '@/types/database';

export interface ProfileContent {
  cases: LawyerCaseSummaryRow[];
  reviews: ReviewRow[];
  experience: LawyerExperienceRow[];
  education: LawyerEducationRow[];
  services: LawyerServiceRow[];
  practiceAreas: LawyerPracticeAreaDetailRow[];
}
const empty: ProfileContent = { cases: [], reviews: [], experience: [], education: [], services: [], practiceAreas: [] };

export function useLawyerProfileContent(lawyerId: string) {
  const [result, setResult] = useState<{ id: string; data: ProfileContent; errors: Partial<Record<keyof ProfileContent, string>> } | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const client = createClient();
    async function load() {
      const queries = [
        client.from('lawyer_case_summaries').select('*').eq('lawyer_id', lawyerId).order('sort_order'),
        client.from('reviews').select('*').eq('lawyer_id', lawyerId).order('created_at', { ascending: false }),
        client.from('lawyer_experience').select('*').eq('lawyer_id', lawyerId).order('sort_order'),
        client.from('lawyer_education').select('*').eq('lawyer_id', lawyerId).order('sort_order'),
        client.from('lawyer_services').select('*').eq('lawyer_id', lawyerId).order('sort_order'),
        client.from('lawyer_practice_areas_detail').select('*').eq('lawyer_id', lawyerId).order('sort_order'),
      ];
      const keys = ['cases', 'reviews', 'experience', 'education', 'services', 'practiceAreas'] as const;
      const responses = await Promise.allSettled(queries);
      const data = { ...empty };
      const errors: Partial<Record<keyof ProfileContent, string>> = {};
      responses.forEach((response, index) => {
        const key = keys[index];
        if (response.status === 'rejected' || response.value.error) errors[key] = 'Unable to load this section. Please try again.';
        else Object.assign(data, { [key]: response.value.data ?? [] });
      });
      if (active) setResult({ id: lawyerId, data, errors });
    }
    void load();
    return () => { active = false; };
  }, [lawyerId, revision]);
  const loading = result?.id !== lawyerId;
  return { data: loading ? empty : result.data, errors: loading ? {} : result.errors, loading, reload: () => { setResult(null); setRevision(value => value + 1); } };
}
