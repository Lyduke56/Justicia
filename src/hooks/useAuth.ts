'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to access the current authenticated Supabase user.
 * Subscribes to auth state changes for real-time session updates.
 *
 * Usage:
 *   const { user, loading } = useAuth();
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const supabase = createClient();

    // Get initial session
    supabase.auth.getUser().then(({ data, error }) => {
      setState({
        user: data.user ?? null,
        loading: false,
        error: error?.message ?? null,
      });
    });

    // Subscribe to auth changes
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((prev) => ({
        ...prev,
        user: session?.user ?? null,
        loading: false,
      }));
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  return state;
}
