import { NextRequest, NextResponse } from 'next/server';

/**
 * Moderation API Route
 *
 * Handles content/user reports submitted by clients and lawyers.
 *
 * TODO: POST — create a report
 *   - Verify auth (any authenticated user can report)
 *   - Validate target_type (user | review | message | consultation)
 *   - Insert into reports table with status = 'open'
 *   - Notify admin via notifications table
 * TODO: PATCH [reportId] — resolve a report (admin only)
 *   - Update status, resolution_notes
 *   - Log to audit_log_entries
 */

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json();
  console.log('[/api/moderation] POST stub received:', body);
  return NextResponse.json({
    data: null,
    message: '[STUB] POST /api/moderation — report submitted (stub)',
  }, { status: 201 });
}
