import { useEffect, useState, useCallback, useRef } from 'react';
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
 */
export function useSupabaseQuery<T>(
  queryFactory: (supabase: ReturnType<typeof createClient>) => Promise<{ data: T | null; error: { message: string } | null }>,
  deps: unknown[] = []
): QueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryFactoryRef = useRef(queryFactory);
  useEffect(() => {
    queryFactoryRef.current = queryFactory;
  }, [queryFactory]);

  const execute = useCallback(() => {
    const supabase = createClient();
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
    });

    queryFactoryRef.current(supabase).then(({ data: resData, error: resError }) => {
      setData(resData ?? null);
      setLoading(false);
      setError(resError?.message ?? null);
    });
  }, []);

  const depsKey = JSON.stringify(deps);
  useEffect(() => {
    execute();
  }, [execute, depsKey]);

  return {
    data,
    loading,
    error,
    refetch: execute,
  };
}
