/**
 * Shared (client + server) types for the conversation extras: replies, pins,
 * read receipts and attachments.
 *
 * Storage: these live in the existing `messages.citations` (jsonb) and
 * `messages.attachment_ids` (text[]) columns, which direct messages never used
 * (they were always null / []). No schema change and no change to the original
 * messaging actions — see `src/lib/messaging/server.ts`.
 */

export type AttachmentKind = 'image' | 'video' | 'audio' | 'file';

export interface MessageAttachment {
  /** public.documents id (the file lives in the private `case-documents` bucket). */
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: AttachmentKind;
  /** Voice messages: recorded length (browsers often report webm duration as Infinity). */
  durationSec?: number | null;
  /** Short-lived signed URL (added when loaded; never stored). */
  url?: string | null;
}

/** What the conversation view knows about one message beyond its text. */
export interface MessageExtras {
  replyToId?: string | null;
  attachments?: MessageAttachment[];
  /** The text was generated ("📎 file.pdf") because only attachments were sent; hide it in the bubble. */
  autoCaption?: boolean;
  pinned?: { byMe: boolean; at: string } | null;
  /** When the recipient saw this message (set on the newest message they have seen). */
  seenAt?: string | null;
}

export interface ThreadExtras {
  messages: Record<string, MessageExtras>;
}

/** Shape stored in messages.citations for direct messages. */
export interface StoredMessageMeta {
  kind: 'dm-meta';
  v: 1;
  replyToId?: string | null;
  attachments?: Array<Omit<MessageAttachment, 'url'>>;
  autoCaption?: boolean;
  pinnedBy?: string | null;
  pinnedAt?: string | null;
  seenAt?: string | null;
}

// ─── Attachment rules (checked in the browser and again on the server) ───────

/** Stays under next.config `serverActions.bodySizeLimit` (10mb) including multipart overhead. */
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_MESSAGE = 6;
export const MAX_VOICE_SECONDS = 5 * 60;

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
const VIDEO_EXT = ['mp4', 'webm', 'mov'];
const AUDIO_EXT = ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'weba'];
const FILE_EXT = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'ppt', 'pptx'];

export const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([...IMAGE_EXT, ...VIDEO_EXT, ...AUDIO_EXT, ...FILE_EXT]);

/** `accept` strings for the file pickers. */
export const ACCEPT_MEDIA = 'image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm,video/quicktime';
export const ACCEPT_DOCUMENTS = FILE_EXT.map((e) => `.${e}`).join(',') + ',' + AUDIO_EXT.map((e) => `.${e}`).join(',');

export function fileExt(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

export function attachmentKind(mimeType: string | null | undefined, name: string): AttachmentKind {
  const mime = (mimeType || '').toLowerCase();
  const ext = fileExt(name);
  if (mime.startsWith('image/') || IMAGE_EXT.includes(ext)) return 'image';
  // Recorded voice notes are audio/webm; a .webm file picked by the user is treated as video.
  if (mime.startsWith('audio/') || AUDIO_EXT.includes(ext)) return 'audio';
  if (mime.startsWith('video/') || VIDEO_EXT.includes(ext)) return 'video';
  return 'file';
}

/** Text saved as the message body when only attachments are sent (keeps previews/notifications readable). */
export function autoCaptionFor(attachments: Array<Pick<MessageAttachment, 'name' | 'kind'>>): string {
  if (attachments.length === 1) {
    const a = attachments[0];
    if (a.kind === 'audio' && a.name.startsWith('voice-message')) return '🎤 Voice message';
    if (a.kind === 'image') return '📷 Photo';
    if (a.kind === 'video') return '🎬 Video';
    return `📎 ${a.name}`;
  }
  return `📎 ${attachments.length} attachments`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(totalSeconds: number | null | undefined): string {
  const s = Math.max(0, Math.round(Number.isFinite(totalSeconds ?? NaN) ? (totalSeconds as number) : 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
