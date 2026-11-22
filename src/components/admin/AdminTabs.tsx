'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useViewActive } from '@/components/live/LiveProvider';
import { ADMIN_REFRESH_EVENT } from '@/lib/live/adminRefresh';
import type { DashboardData, LawyerDirectoryRow, LawyerQueueRow } from '@/app/actions/adminData';
import type { AdminUserAccount, AdminAuditEntry } from '@/types/admin';
import { AdminDashboardView } from './views/AdminDashboardView';
import { AdminLawyersView } from './views/AdminLawyersView';
import { AdminVerificationQueueView } from './views/AdminVerificationQueueView';
import { AdminUsersView } from './views/AdminUsersView';
import { AdminSecurityAuditView } from './views/AdminSecurityAuditView';

interface Resources {
  dashboard: DashboardData;
  lawyers: LawyerDirectoryRow[];
  queue: LawyerQueueRow[];
  users: AdminUserAccount[];
  audit: AdminAuditEntry[];
}

function AdminTab<K extends keyof Resources>({ resource, children }: {
  resource: K;
  children: (data: Resources[K]) => ReactNode;
}) {
  const active = useViewActive();
  const [data, setData] = useState<Resources[K] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastLoaded = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    try {
      const response = await fetch('/api/admin/tabs?resource=' + resource, {
        cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
      });
      if (response.status === 401 || response.status === 403) {
        window.location.reload();
        return;
      }
      if (response.redirected || !response.headers.get('content-type')?.includes('application/json')) {
        throw new Error('The admin data request returned a page instead of data. Please reload and try again.');
      }
      if (!response.ok) throw new Error('Unable to refresh this tab. Please retry.');
      const result = await response.json() as { data: Resources[K] };
      if (controller.signal.aborted) return;
      setData(result.data);
      setError(null);
      lastLoaded.current = Date.now();
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load this tab.');
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  }, [resource]);

  useEffect(() => {
    // Starts a network request; state updates when the response settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return () => pending.current?.abort();
  }, [load]);

  useEffect(() => {
    const refresh = () => {
      if (active && document.visibilityState === 'visible' && Date.now() - lastLoaded.current > 30_000 && !pending.current) void load();
    };
    const invalidate = () => {
      lastLoaded.current = 0;
      pending.current?.abort();
      pending.current = null;
      if (active) void load();
    };
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener(ADMIN_REFRESH_EVENT, invalidate);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener(ADMIN_REFRESH_EVENT, invalidate);
    };
  }, [active, load]);

  return <>
    {error && <div className="admin-page" role="alert"><p>{error}</p><button className="admin-control mt-3" onClick={() => void load()}>Retry</button></div>}
    {data !== null ? children(data) : !error && <div className="admin-page" role="status" aria-busy="true"><div className="admin-inset p-6">Loading administration page...</div></div>}
  </>;
}

export const adminTabViews: Record<string, () => ReactNode> = {
  '/admin/dashboard': () => <AdminTab resource="dashboard">{data => <AdminDashboardView {...data} />}</AdminTab>,
  '/admin/lawyers/verification-queue': () => <AdminTab resource="queue">{data => <AdminVerificationQueueView lawyers={data} />}</AdminTab>,
  '/admin/lawyers': () => <AdminTab resource="lawyers">{data => <AdminLawyersView lawyers={data} />}</AdminTab>,
  '/admin/users': () => <AdminTab resource="users">{data => <AdminUsersView initialUsers={data} />}</AdminTab>,
  '/admin/settings/security-audit-log': () => <AdminTab resource="audit">{data => <AdminSecurityAuditView initialLogs={data} />}</AdminTab>,
};
