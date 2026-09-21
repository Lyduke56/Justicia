/**
 * Video / Audio Conferencing Client Stub
 *
 * All conferencing operations MUST be called server-side only.
 * Target integration: Daily.co, Whereby, or Twilio Video.
 *
 * TODO: Integrate conferencing provider once VIDEO_CONFERENCING_API_KEY is configured
 */

export type ConferencingMethod = 'video' | 'audio';

export interface ConferenceRoom {
  roomId: string;
  roomUrl: string;
  hostToken: string;
  participantToken: string;
  expiresAt: string;
}

/**
 * Creates a conferencing room for a consultation session.
 * TODO: Implement with real conferencing provider (e.g. Daily.co)
 */
export async function createConferenceRoom(
  consultationId: string,
  method: ConferencingMethod
): Promise<ConferenceRoom> {
  console.log('[Conferencing Stub] createConferenceRoom', { consultationId, method });
  // TODO: POST to conferencing provider API
  return {
    roomId: `stub_room_${consultationId}`,
    roomUrl: `https://stub.daily.co/${consultationId}`,
    hostToken: 'stub_host_token',
    participantToken: 'stub_participant_token',
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
  };
}

/**
 * Ends / destroys a conference room.
 * TODO: Implement with real conferencing provider
 */
export async function endConferenceRoom(roomId: string): Promise<void> {
  console.log('[Conferencing Stub] endConferenceRoom', roomId);
  // TODO: DELETE room from provider
}
