'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/types/database';
import { useAuth } from './useAuth';

interface RoleState {
  role: UserRole | null;
  loading: boolean;
}

/**
 * Hook to access the current user's role from the user_accounts table.
 * Role is the source of truth for RBAC — not just Auth metadata.
 *
 * Usage:
 *   const { role, loading } = useRole();
 */
export function useRole(): RoleState {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<RoleState>({ role: null, loading: true });

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setState({ role: null, loading: false });
      return;
    }

    const supabase = createClient();
    supabase
      .from('user_accounts')
      .select('role')
      .eq('id', user.id)
      .single()
      .then(({ data, error }: { data: { role: string } | null; error: { message: string } | null }) => {
        if (error || !data) {
          console.error('[useRole] Failed to fetch role:', error?.message);
          setState({ role: null, loading: false });
        } else {
          setState({ role: data.role as UserRole, loading: false });
        }
      });
  }, [user, authLoading]);

  return state;
}
