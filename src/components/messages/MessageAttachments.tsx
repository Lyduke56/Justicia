'use client';

/* eslint-disable @next/next/no-img-element -- signed / blob URLs from private storage, not static assets */

import React, { useRef, useState } from 'react';
import { getDocumentAccessUrlAction } from '@/app/actions/consultationActions';
import { ChevronRightIcon, CloseIcon, FileIcon, FolderIcon, Spinner } from '@/components/shared/neu';
import { attachmentKind, formatBytes, formatDuration, type AttachmentKind, type MessageAttachment, type SharedFolder } from '@/lib/messaging/types';
import { MicIcon, PauseIcon, PlayIcon } from './MessageIcons';

/** Opens a file in a new tab, asking the server for a fresh link when we don't have one. */
async function openAttachment(a: MessageAttachment) {
  // Local previews (your own just-sent files) open directly.
  if (a.url?.startsWith('blob:')) {
    window.open(a.url, '_blank', 'noopener,noreferrer');
    return;
  }
  // Open the tab synchronously so popup blockers allow it, then point it at a fresh signed link.
  // ("noopener" would make window.open return null, so the opener is cleared by hand.)
  const win = window.open('about:blank', '_blank');
  if (win) win.opener = null;
  const res = await getDocumentAccessUrlAction(a.id);
  const url = ('url' in res && res.url) || a.url || null;
  if (url && win) win.location.href = url;
  else if (url) window.open(url, '_blank', 'noopener,noreferrer');
  else win?.close();
}

const ImageOffIcon = () => (
  <svg className="w-5 h-5 text-[#A89685]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M3 3l18 18" />
  </svg>
);

// ─── Voice player ────────────────────────────────────────────────────────────

/** Fixed pseudo-random bar heights so each voice note keeps the same "waveform". */
function waveform(seed: string, bars = 28): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return Array.from({ length: bars }, (_, i) => {
    h = (h * 1103515245 + 12345 + i) >>> 0;
    return 0.28 + ((h >>> 8) % 1000) / 1400;
  });
}

export function VoicePlayer({ attachment, mine }: { attachment: MessageAttachment; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [mediaDuration, setMediaDuration] = useState<number | null>(null);
  const duration = attachment.durationSec || mediaDuration || 0;
  const bars = waveform(attachment.id);
  const progress = duration > 0 ? Math.min(1, current / duration) : 0;

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => setPlaying(false));
    else el.pause();
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const el = audioRef.current;
    if (!el || !duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    el.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration;
  };

  return (
    <div className="flex items-center gap-3 w-[230px] sm:w-[260px] max-w-full py-0.5">
      <button
        type="button"
        onClick={toggle}
        disabled={!attachment.url}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        className={`size-9 shrink-0 rounded-full flex items-center justify-center cursor-pointer transition active:scale-90 disabled:opacity-50 ${
          mine ? 'bg-[#E5D8CB] text-[#34150F] hover:bg-[#F0E6DA]' : 'neu-btn-caramel text-[#341512]'
        }`}
      >
        {playing ? <PauseIcon className="w-3.5 h-3.5" /> : <PlayIcon className="w-3.5 h-3.5 ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div
          role="slider"
          tabIndex={-1}
          aria-label="Voice message position"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(current)}
          onClick={seek}
          className="h-7 flex items-center gap-[2px] cursor-pointer"
        >
          {bars.map((b, i) => {
            const filled = (i + 0.5) / bars.length <= progress;
            return (
              <span
                key={i}
                className={`flex-1 rounded-full transition-colors ${
                  mine ? (filled ? 'bg-[#E8B877]' : 'bg-[#FAF6F0]/35') : filled ? 'bg-[#C58B3C]' : 'bg-[#341512]/20'
                }`}
                style={{ height: `${Math.round(b * 100)}%` }}
              />
            );
          })}
        </div>
        <div className={`flex items-center gap-1.5 mt-0.5 font-inter text-[10.5px] ${mine ? 'text-[#FAF6F0]/70' : 'text-[#7D6855]'}`}>
          <MicIcon className="w-3 h-3" />
          <span>{formatDuration(playing || current > 0 ? current : duration)}</span>
        </div>
      </div>
      {attachment.url && (
        <audio
          ref={audioRef}
          src={attachment.url}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setCurrent(0);
          }}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setMediaDuration(d);
          }}
          className="hidden"
        />
      )}
    </div>
  );
}

// ─── Attachments inside a message bubble ─────────────────────────────────────

function FileChip({ attachment, mine }: { attachment: MessageAttachment; mine: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void openAttachment(attachment);
      }}
      className={`w-full max-w-[280px] flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-left cursor-pointer transition ${
        mine ? 'bg-[#FAF6F0]/10 hover:bg-[#FAF6F0]/15' : 'neu-recessed hover:brightness-[1.02]'
      }`}
    >
      <span
        className={`size-9 shrink-0 rounded-[10px] flex items-center justify-center ${
          mine ? 'bg-[#E5D8CB] text-[#34150F]' : 'neu-raised-sm text-[#C58B3C]'
        }`}
      >
        <FileIcon className="w-4 h-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-inter text-[12.5px] font-semibold truncate ${mine ? 'text-[#FAF6F0]' : 'text-[#341512]'}`}>
          {attachment.name}
        </span>
        <span className={`block font-inter text-[10.5px] mt-0.5 ${mine ? 'text-[#FAF6F0]/65' : 'text-[#7D6855]'}`}>
          {formatBytes(attachment.size)} · Open
        </span>
      </span>
    </button>
  );
}

export function MessageAttachments({ attachments, mine }: { attachments: MessageAttachment[]; mine: boolean }) {
  const images = attachments.filter((a) => a.kind === 'image');
  const others = attachments.filter((a) => a.kind !== 'image');
  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className={`grid gap-1.5 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {images.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void openAttachment(img);
              }}
              className={`relative overflow-hidden rounded-[14px] bg-[#341512]/10 cursor-zoom-in ${
                images.length === 1 ? 'w-[240px] sm:w-[280px] max-w-full' : 'w-[130px] sm:w-[150px]'
              }`}
              aria-label={`Open ${img.name}`}
            >
              {img.url ? (
                <img
                  src={img.url}
                  alt={img.name}
                  loading="lazy"
                  className={`w-full object-cover ${images.length === 1 ? 'max-h-72' : 'aspect-square'}`}
                />
              ) : (
                <span className="flex flex-col items-center justify-center gap-1.5 aspect-[4/3] px-3 text-center font-inter text-[11px] text-[#7D6855]">
                  <ImageOffIcon />
                  Image unavailable
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {others.map((a) =>
        a.kind === 'audio' ? (
          <VoicePlayer key={a.id} attachment={a} mine={mine} />
        ) : a.kind === 'video' && a.url ? (
          <video
            key={a.id}
            src={a.url}
            controls
            preload="metadata"
            onClick={(e) => e.stopPropagation()}
            className="w-[240px] sm:w-[280px] max-w-full rounded-[14px] bg-black/80"
          />
        ) : (
          <FileChip key={a.id} attachment={a} mine={mine} />
        )
      )}
    </div>
  );
}

// ─── A shared My Documents folder ────────────────────────────────────────────

/**
 * A folder shared in the conversation: its name and file count, opening into the list of its
 * files (each opens in a new tab; the recipient has view-only access).
 */
export function SharedFolderCard({ folder, mine }: { folder: SharedFolder; mine: boolean }) {
  const [open, setOpen] = useState(false);
  const count = folder.files.length;
  const totalBytes = folder.files.reduce((sum, f) => sum + (f.size || 0), 0);
  return (
    <div className="w-[260px] sm:w-[300px] max-w-full space-y-1.5">
      <button
        type="button"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`w-full flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-left cursor-pointer transition ${
          mine ? 'bg-[#FAF6F0]/10 hover:bg-[#FAF6F0]/15' : 'neu-recessed hover:brightness-[1.02]'
        }`}
      >
        <span
          className={`size-9 shrink-0 rounded-[10px] flex items-center justify-center ${
            mine ? 'bg-[#E5D8CB] text-[#34150F]' : 'neu-raised-sm text-[#C58B3C]'
          }`}
        >
          <FolderIcon className="w-4 h-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block font-inter text-[12.5px] font-semibold truncate ${mine ? 'text-[#FAF6F0]' : 'text-[#341512]'}`}>
            {folder.name}
          </span>
          <span className={`block font-inter text-[10.5px] mt-0.5 ${mine ? 'text-[#FAF6F0]/65' : 'text-[#7D6855]'}`}>
            Shared folder · {count} file{count === 1 ? '' : 's'} · {formatBytes(totalBytes)}
          </span>
        </span>
        <ChevronRightIcon
          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''} ${mine ? 'text-[#FAF6F0]/70' : 'text-[#7D6855]'}`}
        />
      </button>
      {open && (
        <ul className="space-y-1.5 pl-2" aria-label={`Files in ${folder.name}`}>
          {folder.files.map((f) => (
            <li key={f.id}>
              <FileChip
                attachment={{ id: f.id, name: f.name, mimeType: f.mimeType, size: f.size, kind: attachmentKind(f.mimeType, f.name), url: null }}
                mine={mine}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Composer: files waiting to be sent ──────────────────────────────────────

export interface PendingAttachment {
  localId: string;
  name: string;
  size: number;
  kind: AttachmentKind;
  previewUrl?: string;
  durationSec?: number | null;
  status: 'uploading' | 'ready' | 'error';
  attachment?: MessageAttachment;
  error?: string;
}

export function PendingAttachmentChip({ item, onRemove }: { item: PendingAttachment; onRemove: () => void }) {
  const isImage = item.kind === 'image' && item.previewUrl;
  const label =
    item.kind === 'audio' && item.name.startsWith('voice-message')
      ? `Voice message · ${formatDuration(item.durationSec)}`
      : item.name;

  return (
    <div
      className={`relative shrink-0 ${
        isImage
          ? 'size-16 rounded-[14px] overflow-hidden neu-raised-sm'
          : 'h-12 max-w-[220px] neu-raised-sm rounded-[14px] pl-2.5 pr-9 flex items-center gap-2.5'
      } ${item.status === 'error' ? 'ring-2 ring-[#B42318]/50' : ''}`}
      title={item.error || item.name}
    >
      {isImage ? (
        <img src={item.previewUrl} alt={item.name} className="w-full h-full object-cover" />
      ) : (
        <>
          <span className="size-8 shrink-0 rounded-[10px] neu-recessed flex items-center justify-center text-[#C58B3C]">
            {item.kind === 'audio' ? <MicIcon className="w-4 h-4" /> : <FileIcon className="w-4 h-4" />}
          </span>
          <span className="min-w-0">
            <span className="block font-inter text-[11.5px] font-semibold text-[#341512] truncate">{label}</span>
            <span className={`block font-inter text-[10px] ${item.status === 'error' ? 'text-[#B42318]' : 'text-[#7D6855]'}`}>
              {item.status === 'error' ? 'Upload failed' : item.status === 'uploading' ? 'Uploading…' : formatBytes(item.size)}
            </span>
          </span>
        </>
      )}

      {item.status === 'uploading' && isImage && (
        <span className="absolute inset-0 bg-[#341512]/35 flex items-center justify-center text-white">
          <Spinner className="w-5 h-5" />
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${item.name}`}
        className={`absolute ${isImage ? 'top-1 right-1 size-5 bg-[#341512]/75 text-white' : 'top-1/2 -translate-y-1/2 right-2 size-6 text-[#7D6855] hover:text-[#341512]'} rounded-full flex items-center justify-center cursor-pointer`}
      >
        <CloseIcon className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}
