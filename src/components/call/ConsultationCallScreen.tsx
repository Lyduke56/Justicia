'use client';

/**
 * The in-app consultation call page (/call/<consultationId>), for the client and the lawyer.
 *
 *  - Lobby: camera / microphone preview and the Join Call button. Joining opens 1 hour before
 *    the scheduled start and closes at the end; before that the button shows when it opens.
 *  - In call: the other person's video (or their initials on an audio call), your own preview,
 *    and controls for microphone, camera, switching cameras and leaving.
 *  - After leaving: rejoin while the session is still open, or go back to Consultations.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePeopleAvatars } from '@/components/account/avatarStore';
import { NeuAlert, NeuButton, PhoneIcon, VideoIcon, ClockIcon, CalendarIcon } from '@/components/shared/neu';
import { formatCallDuration } from '@/lib/consultations/call';
import { joinOpensLabel, manilaClock } from '@/lib/consultations/extras';
import { useConsultationCall, type MediaIssue } from './useConsultationCall';
import type { CallPhase } from './callEngine';

// ─── Icons (same 24px stroke grid as the neu icon set) ─────────────────────────

function Svg({ className = 'w-5 h-5', children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
const MicIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0014 0M12 18v3" />
  </Svg>
);
const MicOffIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M15 9.5V6a3 3 0 00-5.7-1.3M9 9v2a3 3 0 004.8 2.4M5 11a7 7 0 0011.4 5.4M19 11a7 7 0 01-.5 2.6M12 18v3M3 3l18 18" />
  </Svg>
);
const VideoOffIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M10 6h3a2.5 2.5 0 012.5 2.5V12M15.5 15.5a2.5 2.5 0 01-2.5 2.5H5a2.5 2.5 0 01-2.5-2.5v-7A2.5 2.5 0 015 6M15.5 10.5l5-3v9l-3.2-1.9M3 3l18 18" />
  </Svg>
);
const HangUpIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M3.5 14.5l2.1 2.1 3.3-1.6-.4-2.6a11 11 0 017 0l-.4 2.6 3.3 1.6 2.1-2.1a2 2 0 000-2.8 14.8 14.8 0 00-17 0 2 2 0 000 2.8z" />
  </Svg>
);
const SwitchCameraIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M4 8.5A2.5 2.5 0 016.5 6h1.8l1.5-2h4.4l1.5 2h1.8A2.5 2.5 0 0120 8.5v9a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 014 17.5z" />
    <path d="M9.2 12.2a3 3 0 015.1-1.7l.7.7M14.8 14.3a3 3 0 01-5.1 1.2l-.7-.7M15 9.5v1.7h-1.7M9 17.2v-1.7h1.7" />
  </Svg>
);
const ScreenShareIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <rect x="2.5" y="4" width="19" height="13" rx="2.5" />
    <path d="M8 21h8M12 17v4M12 13.5V8M9.5 10.5L12 8l2.5 2.5" />
  </Svg>
);
const ArrowLeftIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </Svg>
);

// ─── Small pieces ──────────────────────────────────────────────────────────────

function initialsOf(name: string): string {
  const parts = name.replace(/^Atty\.\s*/i, '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

function Avatar({ name, photo, size = 'lg' }: { name: string; photo?: string | null; size?: 'lg' | 'sm' }) {
  const box = size === 'lg' ? 'size-24 sm:size-28 text-2xl sm:text-3xl' : 'size-12 text-sm';
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element -- signed avatar URLs, sized by CSS
    <img src={photo} alt="" className={`${box} rounded-full object-cover ring-4 ring-[#E5D8CB]/15`} />
  ) : (
    <span className={`${box} rounded-full bg-[#4A2E25] text-[#F3E6D6] font-lora font-bold flex items-center justify-center ring-4 ring-[#E5D8CB]/15`}>
      {initialsOf(name)}
    </span>
  );
}

function issueText(issue: MediaIssue, device: 'microphone' | 'camera'): string | null {
  switch (issue) {
    case 'denied':
      return `Your browser blocked the ${device}. Allow it from the lock icon in the address bar, then try again.`;
    case 'no_device':
      return `No ${device} was found on this device.`;
    case 'in_use':
      return `Your ${device} is being used by another app. Close that app, then try again.`;
    case 'insecure':
      return `The ${device} only works on a secure (https) page.`;
    case 'unsupported':
      return `This browser can't use the ${device}. Try the latest Chrome, Edge, Safari or Firefox.`;
    default:
      return null;
  }
}

function phaseLabel(phase: CallPhase, counterpart: string, signalling: boolean): string {
  if (!signalling && phase !== 'connected') return 'Reconnecting to Justicia…';
  switch (phase) {
    case 'joining':
      return 'Joining…';
    case 'waiting':
      return `Waiting for ${counterpart} to join`;
    case 'connecting':
      return `Connecting to ${counterpart}…`;
    case 'reconnecting':
      return 'Connection lost. Reconnecting…';
    default:
      return '';
  }
}

/** Round control on the call bar. */
function ControlButton({
  label,
  onClick,
  active = true,
  tone = 'default',
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  tone?: 'default' | 'danger';
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const look =
    tone === 'danger'
      ? 'bg-[#B42318] text-white hover:bg-[#9A1D14]'
      : active
        ? 'bg-[#F3E6D6]/12 text-[#F3E6D6] hover:bg-[#F3E6D6]/20'
        : 'bg-[#F3E6D6] text-[#341512] hover:bg-white';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={tone === 'danger' ? undefined : !active}
      className={`size-12 sm:size-13 rounded-full flex items-center justify-center transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D49E56] ${look} ${tone === 'danger' ? 'w-16 sm:w-18' : ''}`}
    >
      {children}
    </button>
  );
}

function VideoTile({ stream, version, mirrored, muted, className, onAutoplayBlocked }: {
  stream: MediaStream | null;
  version?: number;
  mirrored?: boolean;
  muted?: boolean;
  className?: string;
  onAutoplayBlocked?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    if (stream) {
      el.play().catch((err: unknown) => {
        if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'NotAllowedError') onAutoplayBlocked?.();
      });
    }
  }, [stream, version, onAutoplayBlocked]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={`${className ?? ''} ${mirrored ? '-scale-x-100' : ''}`}
    />
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export function ConsultationCallScreen({ consultationId }: { consultationId: string }) {
  const call = useConsultationCall(consultationId);
  const { details } = call;
  const photos = usePeopleAvatars(details ? [details.counterpart.userId, details.me.userId] : []);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const onSoundBlocked = useCallback(() => setSoundBlocked(true), []);
  const { phase, slowConnect } = call;

  const remoteHasVideo = !!call.remoteStream?.getVideoTracks().length && call.remoteMedia.cam;
  const counterpart = details?.counterpart.name ?? 'the other participant';
  const counterpartPhoto = details ? photos[details.counterpart.userId] ?? null : null;
  const myPhoto = details ? photos[details.me.userId] ?? null : null;
  const backHref = details?.backHref ?? '/';
  const KindIcon = call.isVideo ? VideoIcon : PhoneIcon;
  const title = details ? `${call.isVideo ? 'Video consultation' : 'Audio call'} with ${counterpart}` : 'Consultation call';

  // ─── In call ────────────────────────────────────────────────────────────────
  if (call.stage === 'in_call' && details) {
    const status = phase === 'connected' && call.connectedAt ? formatCallDuration(call.now - call.connectedAt) : phaseLabel(phase, counterpart, call.signalling);
    return (
      <main className="fixed inset-0 bg-[#1F1410] text-[#F3E6D6] flex flex-col">
        {/* Top bar */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 pt-[max(env(safe-area-inset-top),0.875rem)] pb-3">
          <div className="min-w-0">
            <p className="font-lora font-bold text-sm sm:text-base truncate">{counterpart}</p>
            <p className="font-inter text-[11.5px] sm:text-xs text-[#F3E6D6]/70 truncate" aria-live="polite">
              {status}
              {phase === 'connected' && call.route === 'relay' ? ' · via relay' : ''}
            </p>
          </div>
          {call.endsAt && (
            <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[#F3E6D6]/10 px-3 py-1.5 font-inter text-[11px] sm:text-xs">
              <ClockIcon className="w-3.5 h-3.5" />
              {call.overTime ? 'Scheduled time is over' : `Ends ${manilaClock(new Date(call.endsAt).toISOString())}`}
            </span>
          )}
        </div>

        {/* Stage */}
        <div className="relative flex-1 min-h-0 mx-2 sm:mx-4 rounded-[24px] overflow-hidden bg-[#2B1B15]">
          {call.isVideo ? (
            <VideoTile
              stream={call.remoteStream}
              className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${remoteHasVideo ? 'opacity-100' : 'opacity-0'}`}
              onAutoplayBlocked={onSoundBlocked}
            />
          ) : (
            <AudioSink stream={call.remoteStream} onAutoplayBlocked={onSoundBlocked} />
          )}

          {!remoteHasVideo && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <Avatar name={counterpart} photo={counterpartPhoto} />
              <div className="space-y-1">
                <p className="font-lora font-bold text-base sm:text-lg">{counterpart}</p>
                <p className="font-inter text-xs sm:text-sm text-[#F3E6D6]/70">
                  {phase === 'connected'
                    ? call.isVideo
                      ? 'Camera is off'
                      : 'Audio call in progress'
                    : phaseLabel(phase, counterpart, call.signalling)}
                </p>
              </div>
            </div>
          )}

          {phase === 'connected' && !call.remoteMedia.mic && (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 font-inter text-[11px]">
              <MicOffIcon className="w-3.5 h-3.5" /> {counterpart} is muted
            </span>
          )}

          {soundBlocked && (
            <button
              type="button"
              onClick={() => {
                setSoundBlocked(false);
                document.querySelectorAll('video, audio').forEach((el) => void (el as HTMLMediaElement).play().catch(() => undefined));
              }}
              className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-[#D49E56] px-4 py-2 font-lora text-xs font-bold text-[#341512] cursor-pointer"
            >
              Tap to turn on sound
            </button>
          )}

          {/* Your preview */}
          <div className="absolute bottom-3 right-3 w-28 sm:w-44 aspect-[3/4] sm:aspect-video rounded-2xl overflow-hidden bg-[#3A261E] ring-1 ring-[#F3E6D6]/15 shadow-lg">
            {call.isVideo && call.camOn ? (
              <VideoTile stream={call.localStream} version={call.localVersion} mirrored muted className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <Avatar name={details.me.name} photo={myPhoto} size="sm" />
              </div>
            )}
            {call.sharing && (
              <span className="absolute inset-x-1.5 top-1.5 rounded-full bg-[#D49E56] px-2 py-0.5 text-center font-inter text-[10px] font-semibold text-[#341512]">
                Sharing your screen
              </span>
            )}
            {!call.micOn && (
              <span className="absolute left-1.5 bottom-1.5 rounded-full bg-black/55 p-1" aria-label="You are muted">
                <MicOffIcon className="w-3.5 h-3.5" />
              </span>
            )}
          </div>
        </div>

        {(slowConnect || call.overTime) && (
          <p className="shrink-0 mx-4 mt-3 text-center font-inter text-[11.5px] sm:text-xs text-[#F3E6D6]/75" role="status">
            {slowConnect
              ? call.relayConfigured
                ? 'Still connecting. Check your internet connection, or try moving to a stronger Wi-Fi or mobile signal.'
                : 'Still connecting. Your network may block direct calls; try another Wi-Fi or switch between Wi-Fi and mobile data.'
              : 'The scheduled time has ended. You can finish up and leave when you are done.'}
          </p>
        )}

        {/* Controls */}
        <div className="shrink-0 flex items-center justify-center gap-3 sm:gap-4 px-4 pt-4 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
          <ControlButton label={call.micOn ? 'Mute microphone' : 'Unmute microphone'} active={call.micOn} onClick={() => void call.toggleMic()}>
            {call.micOn ? <MicIcon className="w-5 h-5" /> : <MicOffIcon className="w-5 h-5" />}
          </ControlButton>
          {call.isVideo && (
            <ControlButton
              label={call.sharing ? 'Stop sharing your screen to change the camera' : call.camOn ? 'Turn camera off' : 'Turn camera on'}
              active={call.camOn}
              disabled={call.sharing}
              onClick={() => void call.toggleCam()}
            >
              {call.camOn ? <VideoIcon className="w-5 h-5" /> : <VideoOffIcon className="w-5 h-5" />}
            </ControlButton>
          )}
          {call.canShareScreen && (
            <ControlButton label={call.sharing ? 'Stop sharing your screen' : 'Share your screen'} active={!call.sharing} onClick={() => void call.toggleScreenShare()}>
              <ScreenShareIcon className="w-5 h-5" />
            </ControlButton>
          )}
          {call.canSwitchCamera && (
            <ControlButton label="Switch camera" onClick={() => void call.switchCamera()}>
              <SwitchCameraIcon className="w-5 h-5" />
            </ControlButton>
          )}
          <ControlButton label="Leave call" tone="danger" onClick={() => void call.leave()}>
            <HangUpIcon className="w-6 h-6" />
          </ControlButton>
        </div>
      </main>
    );
  }

  // ─── Lobby, left, replaced, unavailable ───────────────────────────────────────
  const micText = issueText(call.micIssue, 'microphone');
  const camText = call.isVideo ? issueText(call.camIssue, 'camera') : null;
  const opensLabel = details?.joinOpensAt ? joinOpensLabel(details.joinOpensAt, call.now) : null;

  let unavailable: { title: string; text: string } | null = null;
  if (call.stage === 'unavailable' || (details && call.availability && !['open', 'not_yet'].includes(call.availability) && call.stage === 'lobby')) {
    unavailable =
      !details
        ? { title: 'This call is not available', text: call.loadError ?? 'We could not find this consultation.' }
        : call.availability === 'ended'
          ? { title: 'This consultation has ended', text: 'The scheduled time is over, so the call can no longer be joined.' }
          : call.availability === 'closed'
            ? { title: 'This consultation was cancelled', text: 'There is no call to join for this booking.' }
            : { title: 'Not confirmed yet', text: 'The call opens once the booking is confirmed and paid, from 1 hour before the start.' };
  }

  return (
    <main className="min-h-dvh bg-[#E5D8CB] text-[#341512]">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-5 sm:py-8 flex flex-col gap-5 sm:gap-6">
        <Link
          href={backHref}
          className="self-start inline-flex items-center gap-2 rounded-full px-2 py-1 font-lora text-xs font-bold text-[#5C4535] hover:text-[#A8742E] transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" /> Back to Consultations
        </Link>

        {call.stage === 'loading' ? (
          <div className="neu-recessed rounded-[28px] h-72 flex items-center justify-center font-inter text-sm text-[#5C4535]" role="status">
            Opening your consultation…
          </div>
        ) : unavailable ? (
          <div className="neu-raised rounded-[28px] p-6 sm:p-10 flex flex-col items-center gap-5 text-center">
            <span className="neu-raised-sm size-14 rounded-full flex items-center justify-center text-[#C58B3C]">
              <KindIcon className="w-6 h-6" />
            </span>
            <div className="space-y-2 max-w-md">
              <h1 className="font-lora text-lg sm:text-xl font-bold">{unavailable.title}</h1>
              <p className="font-inter text-[13px] sm:text-sm text-[#5C4535] leading-relaxed">{unavailable.text}</p>
            </div>
            <Link href={backHref} className="neu-btn-caramel rounded-[14px] px-6 py-2.5 font-lora text-sm font-bold text-[#341512]">
              Back to Consultations
            </Link>
          </div>
        ) : details && (call.stage === 'left' || call.stage === 'replaced') ? (
          <div className="neu-raised rounded-[28px] p-6 sm:p-10 flex flex-col items-center gap-5 text-center">
            <span className="neu-raised-sm size-14 rounded-full flex items-center justify-center text-[#C58B3C]">
              <KindIcon className="w-6 h-6" />
            </span>
            <div className="space-y-2 max-w-md">
              <h1 className="font-lora text-lg sm:text-xl font-bold">
                {call.stage === 'replaced' ? 'This call is open in another window' : 'You left the call'}
              </h1>
              <p className="font-inter text-[13px] sm:text-sm text-[#5C4535] leading-relaxed">
                {call.stage === 'replaced'
                  ? 'You joined this consultation from another tab or device, so this window was disconnected.'
                  : call.availability === 'open'
                    ? `You can rejoin until ${call.endsAt ? manilaClock(new Date(call.endsAt).toISOString()) : 'the session ends'}.`
                    : 'The scheduled time is over.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href={backHref} className="neu-raised-sm rounded-[14px] bg-[#E5D8CB] px-6 py-2.5 font-lora text-sm font-bold text-[#341512] hover:text-[#A8742E]">
                Back to Consultations
              </Link>
              {call.availability === 'open' && (
                <NeuButton variant="primary" icon={<KindIcon className="w-4 h-4" />} onClick={call.backToLobby}>
                  {call.stage === 'replaced' ? 'Use this window' : 'Rejoin'}
                </NeuButton>
              )}
            </div>
          </div>
        ) : details ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
            {/* Preview */}
            <div className="space-y-4">
              <div className="relative aspect-video w-full rounded-[28px] overflow-hidden bg-[#2B1B15] text-[#F3E6D6]">
                {call.isVideo && call.camOn && call.localStream ? (
                  <VideoTile stream={call.localStream} version={call.localVersion} mirrored muted className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <Avatar name={details.me.name} photo={myPhoto} />
                    <p className="font-inter text-xs text-[#F3E6D6]/70">
                      {!call.mediaReady ? 'Starting your camera and microphone…' : call.isVideo ? 'Your camera is off' : 'Audio only'}
                    </p>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 p-4">
                  <ControlButton label={call.micOn ? 'Mute microphone' : 'Unmute microphone'} active={call.micOn} onClick={() => void call.toggleMic()} disabled={!call.mediaReady}>
                    {call.micOn ? <MicIcon className="w-5 h-5" /> : <MicOffIcon className="w-5 h-5" />}
                  </ControlButton>
                  {call.isVideo && (
                    <ControlButton label={call.camOn ? 'Turn camera off' : 'Turn camera on'} active={call.camOn} onClick={() => void call.toggleCam()} disabled={!call.mediaReady}>
                      {call.camOn ? <VideoIcon className="w-5 h-5" /> : <VideoOffIcon className="w-5 h-5" />}
                    </ControlButton>
                  )}
                </div>
              </div>
              {(micText || camText) && (
                <NeuAlert tone="warning" title="Check your devices">
                  {[micText, camText].filter(Boolean).join(' ')}
                </NeuAlert>
              )}
            </div>

            {/* Join card */}
            <div className="neu-raised rounded-[28px] p-5 sm:p-7 flex flex-col gap-5">
              <div className="flex items-center gap-4 min-w-0">
                <Avatar name={counterpart} photo={counterpartPhoto} size="sm" />
                <div className="min-w-0">
                  <p className="font-lora text-[10.5px] font-bold uppercase tracking-wider text-[#7A6756]">
                    {details.side === 'client' ? 'Your attorney' : 'Your client'}
                  </p>
                  <h1 className="font-lora text-base sm:text-lg font-bold leading-snug break-words">{counterpart}</h1>
                </div>
              </div>

              <div className="neu-recessed rounded-[20px] p-4 space-y-3">
                <p className="flex items-start gap-2.5 font-inter text-[12.5px] sm:text-[13px] text-[#3E2A1E]">
                  <KindIcon className="w-4 h-4 mt-0.5 shrink-0 text-[#C58B3C]" />
                  <span>{title}</span>
                </p>
                <p className="flex items-start gap-2.5 font-inter text-[12.5px] sm:text-[13px] text-[#3E2A1E]">
                  <CalendarIcon className="w-4 h-4 mt-0.5 shrink-0 text-[#C58B3C]" />
                  <span>{details.scheduleLabel}</span>
                </p>
                <p className="font-inter text-[12px] text-[#5C4535] line-clamp-2">{details.subject}</p>
              </div>

              {call.joinError && (
                <NeuAlert tone="error" title="Could not join">
                  {call.joinError}
                </NeuAlert>
              )}

              {call.availability === 'not_yet' && opensLabel ? (
                <NeuAlert tone="warning" title={`Join opens ${opensLabel.includes(' at ') ? 'on ' : 'at '}${opensLabel}`}>
                  You can enter the call from 1 hour before the scheduled start
                  {call.joinOpensIn !== null && call.joinOpensIn < 6 * 60 * 60 * 1000 ? ` (in ${formatCallDuration(call.joinOpensIn)})` : ''}. Keep this page
                  open and the button turns on by itself.
                </NeuAlert>
              ) : (
                <p className="font-inter text-[12.5px] text-[#5C4535] leading-relaxed">
                  Find a quiet, private place. Joining records your attendance for this consultation.
                </p>
              )}

              <NeuButton
                variant="primary"
                icon={<KindIcon className="w-4 h-4" />}
                loading={call.stage === 'joining'}
                disabled={call.availability !== 'open' || call.stage === 'joining'}
                onClick={() => void call.join()}
                className="w-full h-12"
              >
                {call.stage === 'joining' ? 'Joining…' : 'Join Call'}
              </NeuButton>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

/** Plays the other person's audio on audio-only calls. */
function AudioSink({ stream, onAutoplayBlocked }: { stream: MediaStream | null; onAutoplayBlocked: () => void }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    if (stream) {
      el.play().catch((err: unknown) => {
        if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'NotAllowedError') onAutoplayBlocked();
      });
    }
  }, [stream, onAutoplayBlocked]);
  return <audio ref={ref} autoPlay />;
}

export default ConsultationCallScreen;
