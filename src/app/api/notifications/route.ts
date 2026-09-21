import { NextRequest, NextResponse } from 'next/server';

/**
 * Notifications API Route
 *
 * Creates and dispatches notifications (in-app and/or email).
 * This endpoint is called by other server-side code (not directly by the client).
 *
 * TODO: POST — create notification
 *   - Insert into notifications table (channel = 'in_app')
 *   - If channel includes 'email', call email.ts sendEmail()
 * TODO: PATCH [notificationId] — mark as read
 * TODO: GET — list unread notifications for current user
 */

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json();
  console.log('[/api/notifications] POST stub received:', body);
  return NextResponse.json({
    data: null,
    message: '[STUB] POST /api/notifications — not yet implemented',
  }, { status: 201 });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    data: [],
    message: '[STUB] GET /api/notifications — not yet implemented',
  });
}
