import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getLawyerConsultationsAction,
  getLawyerEarningsAction,
} from '@/app/actions/consultationActions';
import {
  buildDashboardStats,
  buildSchedule,
  parseDateRange,
  MAX_RANGE_DAYS,
} from '@/lib/lawyer/dashboardSchedule';

/**
 * GET /api/live/lawyer-dashboard?view=schedule&from=YYYY-MM-DD&to=YYYY-MM-DD
 *   → the signed-in lawyer's scheduled consultations between two Manila dates (inclusive),
 *     earliest first, plus a per-date count of every scheduled consultation for the date picker.
 *
 * GET /api/live/lawyer-dashboard?view=stats
 *   → the dashboard's KPI figures (today, pending requests, this month's earnings, rating).
 *
 * Read-only. Reuses the existing consultation and earnings loaders (each resolves the session
 * lawyer itself), so it lives under /api/live like the other tab loaders and adds no new queries
 * on consultations. Responds 401 with no session so the demo preview can fall back to samples.
 */
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const view = params.get('view');

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

    // rating_avg / rating_count exist in the live schema but not in the generated types. If that
    // select ever fails, still confirm the lawyer and just leave the rating out.
    type ProfileRow = { rating_avg: number | string | null; rating_count: number | null };
    const withRating = await supabase
      .from('lawyer_profiles')
      .select('user_id, rating_avg, rating_count')
      .eq('user_id', user.id)
      .maybeSingle();
    let profile = withRating.data as unknown as ProfileRow | null;
    if (withRating.error) {
      const { data } = await supabase.from('lawyer_profiles').select('user_id').eq('user_id', user.id).maybeSingle();
      profile = data ? { rating_avg: null, rating_count: null } : null;
    }
    if (!profile) {
      return NextResponse.json({ error: 'Only registered attorneys can view this dashboard.' }, { status: 403, headers: NO_STORE });
    }

    if (view === 'schedule') {
      const range = parseDateRange(params.get('from'), params.get('to'));
      if (!range) {
        return NextResponse.json(
          { error: `Provide from and to as YYYY-MM-DD, from ≤ to, at most ${MAX_RANGE_DAYS} days apart.` },
          { status: 400, headers: NO_STORE }
        );
      }
      const consultations = await getLawyerConsultationsAction();
      return NextResponse.json({ data: buildSchedule(consultations, range) }, { headers: NO_STORE });
    }

    if (view === 'stats') {
      const [consultations, earnings] = await Promise.all([
        getLawyerConsultationsAction(),
        getLawyerEarningsAction(),
      ]);
      const avg = profile.rating_avg == null ? NaN : Number(profile.rating_avg);
      const data = buildDashboardStats({
        consultations,
        earnings: 'success' in earnings && earnings.success ? earnings.data : null,
        rating: { avg: Number.isFinite(avg) ? avg : null, count: Number(profile.rating_count ?? 0) || 0 },
      });
      return NextResponse.json({ data }, { headers: NO_STORE });
    }

    return NextResponse.json({ error: 'Unknown view.' }, { status: 400, headers: NO_STORE });
  } catch (err) {
    console.error('[api/live/lawyer-dashboard]', view, err);
    return NextResponse.json({ error: 'Could not load the dashboard.' }, { status: 500, headers: NO_STORE });
  }
}
