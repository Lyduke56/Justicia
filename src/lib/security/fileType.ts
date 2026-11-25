/**
 * Checks that an uploaded file really is the type its extension claims, by reading its first
 * bytes ("magic numbers"). The browser-provided MIME type and the file name are both chosen by
 * the uploader, so neither is trusted on its own.
 */

export type SniffedKind =
  | 'pdf'
  | 'png'
  | 'jpeg'
  | 'gif'
  | 'webp'
  | 'zip' // docx, xlsx, pptx
  | 'ole' // legacy doc, xls, ppt
  | 'mp4' // mp4, mov, m4a, heic family (ISO base media)
  | 'webm' // webm, weba (Matroska)
  | 'ogg'
  | 'mp3'
  | 'wav'
  | 'aac'
  | 'text'
  | 'unknown';

const startsWith = (b: Uint8Array, sig: number[], offset = 0) =>
  b.length >= offset + sig.length && sig.every((v, i) => b[offset + i] === v);

/** Detects the container format from the first bytes of a file. */
export function sniffBytes(bytes: Uint8Array): SniffedKind {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'pdf'; // %PDF-
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return 'gif'; // GIF8
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'webp';
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x41, 0x56, 0x45], 8)) return 'wav';
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return 'zip';
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'ole';
  if (startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)) return 'mp4'; // ....ftyp
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return 'webm';
  if (startsWith(bytes, [0x4f, 0x67, 0x67, 0x53])) return 'ogg'; // OggS
  if (startsWith(bytes, [0x49, 0x44, 0x33])) return 'mp3'; // ID3
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    // MPEG audio frame sync; AAC ADTS uses 0xFFF1 / 0xFFF9.
    return (bytes[1] & 0xf6) === 0xf0 ? 'aac' : 'mp3';
  }
  if (looksLikeText(bytes)) return 'text';
  return 'unknown';
}

/** Plain text: no NUL bytes and mostly printable characters in the sample. */
function looksLikeText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  let printable = 0;
  for (const b of bytes) {
    if (b === 0) return false;
    if (b === 9 || b === 10 || b === 13 || (b >= 32 && b !== 127)) printable++;
  }
  return printable / bytes.length > 0.95;
}

/** The sniffed kinds that are acceptable for each file extension. */
const EXTENSION_KINDS: Record<string, SniffedKind[]> = {
  pdf: ['pdf'],
  png: ['png'],
  jpg: ['jpeg'],
  jpeg: ['jpeg'],
  gif: ['gif'],
  webp: ['webp'],
  docx: ['zip'],
  xlsx: ['zip'],
  pptx: ['zip'],
  doc: ['ole'],
  xls: ['ole'],
  ppt: ['ole'],
  mp4: ['mp4'],
  mov: ['mp4'],
  m4a: ['mp4'],
  webm: ['webm'],
  weba: ['webm'],
  ogg: ['ogg'],
  oga: ['ogg'],
  opus: ['ogg'],
  mp3: ['mp3'],
  wav: ['wav'],
  aac: ['aac', 'mp4'],
  txt: ['text'],
  csv: ['text'],
};

/** The MIME type to store for a verified file, by extension. */
const EXTENSION_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  doc: 'application/msword',
  xls: 'application/vnd.ms-excel',
  ppt: 'application/vnd.ms-powerpoint',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4a: 'audio/mp4',
  webm: 'video/webm',
  weba: 'audio/webm',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  aac: 'audio/aac',
  txt: 'text/plain',
  csv: 'text/csv',
};

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function mimeForExtension(ext: string): string {
  return EXTENSION_MIME[ext] ?? 'application/octet-stream';
}

/** True when the file's content matches what its extension claims. */
export function contentMatchesExtension(bytes: Uint8Array, ext: string): boolean {
  const allowed = EXTENSION_KINDS[ext.toLowerCase()];
  if (!allowed) return false;
  return allowed.includes(sniffBytes(bytes));
}

/** Reads the first bytes of a File/Blob and checks them against the extension. */
export async function fileMatchesExtension(file: Blob, ext: string): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 512).arrayBuffer());
  return contentMatchesExtension(head, ext);
}

export const FILE_CONTENT_MISMATCH =
  "This file's contents don't match its type. Please upload the original file (not renamed).";
