import { createClient } from '@/lib/supabase/server';
import { getAdminDashboardData, getVerificationQueueData, getLawyerDirectoryData, getAdminUsersData, getAdminAuditLogsData } from '@/app/actions/adminData';

const loaders = {
  dashboard: getAdminDashboardData,
  queue: getVerificationQueueData,
  lawyers: getLawyerDirectoryData,
  users: getAdminUsersData,
  audit: getAdminAuditLogsData,
};

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  const resource = new URL(request.url).searchParams.get('resource');
  if (!resource || !Object.hasOwn(loaders, resource)) {
    return Response.json({ error: 'Unknown admin tab.' }, { status: 400, headers });
  }
  try {
    const client = await createClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return Response.json({ error: 'Sign in to continue.' }, { status: 401, headers });
    const { data: account } = await client.from('user_accounts').select('role').eq('id', user.id).single();
    if (account?.role !== 'admin') return Response.json({ error: 'Administrator access required.' }, { status: 403, headers });
    const data = await loaders[resource as keyof typeof loaders]();
    return Response.json({ data }, { headers });
  } catch {
    return Response.json({ error: 'Unable to load this admin tab. Please retry.' }, { status: 500, headers });
  }
}
