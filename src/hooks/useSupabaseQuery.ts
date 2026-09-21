import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Generic Supabase query hook for client components.
 * Accepts a query factory function that returns a Supabase query promise.
 *
 * Usage:
 *   const { data, loading } = useSupabaseQuery(
 *     (supabase) => supabase.from('consultations').select('*').eq('client_id', userId)
 *   );
 *
 * TODO: Add real-time subscription support via supabase.channel()
 */
export function useSupabaseQuery<T>(
  queryFactory: (supabase: ReturnType<typeof createClient>) => Promise<{ data: T | null; error: { message: string } | null }>,
  deps: unknown[] = []
): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({
    data: null,
    loading: true,
    error: null,
    refetch: () => {},
  });

  const execute = useCallback(() => {
    const supabase = createClient();
    setState((prev) => ({ ...prev, loading: true, error: null }));

    queryFactory(supabase).then(({ data, error }) => {
      setState((prev) => ({
        ...prev,
        data: data ?? null,
        loading: false,
        error: error?.message ?? null,
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    execute();
  }, [execute]);

  useEffect(() => {
    setState((prev) => ({ ...prev, refetch: execute }));
  }, [execute]);

  return state;
}
