'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getConsultationCallAction, joinConsultationCallAction } from '@/app/actions/consultationCallActions';
import { callAvailability, type CallAvailability, type ConsultationCallDetails } from '@/lib/consultations/call';
import { CallEngine, type CallPhase, type RemoteMediaState } from './callEngine';

/**
 * Everything the call page needs: the consultation's call details, a clock in server time, the
 * local camera / microphone, and the connection (CallEngine) once the user joins.
 *
 * Stages: loading → lobby (preview + Join) → in call → left. Media is requested in the lobby so
 * permission prompts happen before joining; joining itself goes through the server, which
 * checks the join window and records attendance.
 */

export type CallStage = 'loading' | 'unavailable' | 'lobby' | 'joining' | 'in_call' | 'left' | 'replaced';

export type MediaIssue =
  | 'denied'
  | 'no_device'
  | 'in_use'
  | 'insecure'
  | 'unsupported'
  | null;

const AUDIO_CONSTRAINTS: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
const VIDEO_CONSTRAINTS: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 }, facingMode: 'user' };

function mediaIssueOf(err: unknown): MediaIssue {
  const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: unknown }).name) : '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'denied';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'no_device';
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'in_use';
  return 'unsupported';
}

async function getTrack(kind: 'audio' | 'video', deviceId?: string): Promise<MediaStreamTrack> {
  const constraints: MediaStreamConstraints =
    kind === 'audio'
      ? { audio: deviceId ? { ...AUDIO_CONSTRAINTS, deviceId: { exact: deviceId } } : AUDIO_CONSTRAINTS, video: false }
      : { audio: false, video: deviceId ? { ...VIDEO_CONSTRAINTS, facingMode: undefined, deviceId: { exact: deviceId } } : VIDEO_CONSTRAINTS };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  const track = kind === 'audio' ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];
  if (!track) throw Object.assign(new Error('No track'), { name: 'NotFoundError' });
  return track;
}

export function useConsultationCall(consultationId: string) {
  const [details, setDetails] = useState<ConsultationCallDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stage, setStage] = useState<CallStage>('loading');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [phase, setPhase] = useState<CallPhase>('joining');
  const [phaseSince, setPhaseSince] = useState(() => Date.now());
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remoteMedia, setRemoteMedia] = useState<RemoteMediaState>({ mic: true, cam: true });
  const [signalling, setSignalling] = useState(true);
  const [route, setRoute] = useState<'direct' | 'relay' | null>(null);
  const [relayConfigured, setRelayConfigured] = useState(true);

  // Local media. One stable MediaStream whose tracks change (the engine keeps a reference).
  const localStreamRef = useRef<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localVersion, setLocalVersion] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [micIssue, setMicIssue] = useState<MediaIssue>(null);
  const [camIssue, setCamIssue] = useState<MediaIssue>(null);
  const [mediaReady, setMediaReady] = useState(false);
  const [cameraCount, setCameraCount] = useState(0);
  const videoDeviceRef = useRef<string | null>(null);
  // Screen sharing (computers): the shared screen replaces the outgoing camera video.
  const [sharing, setSharing] = useState(false);
  const [canShareScreen, setCanShareScreen] = useState(false);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);

  // Clock in server time (the device clock may be off).
  const offsetRef = useRef(0);
  const [now, setNow] = useState(() => Date.now());

  const engineRef = useRef<CallEngine | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  const isVideo = details?.method !== 'audio';

  // ─── Details ───────────────────────────────────────────────────────────────

  const loadDetails = useCallback(async () => {
    try {
      const res = await getConsultationCallAction(consultationId);
      if ('error' in res) {
        setLoadError(res.error);
        setStage('unavailable');
        return null;
      }
      offsetRef.current = res.call.serverNow - Date.now();
      setNow(Date.now() + offsetRef.current);
      setDetails(res.call);
      setStage((s) => (s === 'loading' ? (res.call.availability === 'open' || res.call.availability === 'not_yet' ? 'lobby' : 'unavailable') : s));
      return res.call;
    } catch {
      setLoadError('We could not open this call. Check your connection and try again.');
      setStage('unavailable');
      return null;
    }
  }, [consultationId]);

  useEffect(() => {
    // First load; loadDetails only sets state after the server answers.
    const timer = setTimeout(() => void loadDetails(), 0);
    return () => clearTimeout(timer);
  }, [loadDetails]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + offsetRef.current), 1000);
    return () => clearInterval(timer);
  }, []);

  /** Availability by the (server-corrected) clock, so the Join button opens on time. */
  const availability: CallAvailability | null = details
    ? details.availability === 'open' || details.availability === 'not_yet' || details.availability === 'ended'
      ? callAvailability('confirmed', details.startsAt && details.endsAt ? { start: Date.parse(details.startsAt), end: Date.parse(details.endsAt) } : null, now)
      : details.availability
    : null;

  // ─── Local media ───────────────────────────────────────────────────────────

  const bumpLocal = () => setLocalVersion((v) => v + 1);

  const refreshCameraCount = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCameraCount(devices.filter((d) => d.kind === 'videoinput').length);
    } catch {
      setCameraCount(0);
    }
    // Phones and tablets can't share their screen from a browser.
    const touchOnly = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches && !window.matchMedia?.('(pointer: fine)').matches;
    setCanShareScreen(!!navigator.mediaDevices?.getDisplayMedia && !touchOnly);
  }, []);

  /** Asks for the microphone (and camera for video calls) once, in the lobby. */
  const startMedia = useCallback(async (video: boolean) => {
    if (localStreamRef.current) return;
    const stream = new MediaStream();
    localStreamRef.current = stream;
    setLocalStream(stream);
    setMicIssue(null);
    setCamIssue(null);
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setMicIssue('insecure');
      if (video) setCamIssue('insecure');
      setMicOn(false);
      setCamOn(false);
      setMediaReady(true);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicIssue('unsupported');
      if (video) setCamIssue('unsupported');
      setMicOn(false);
      setCamOn(false);
      setMediaReady(true);
      return;
    }
    // One prompt for both when possible; fall back to each device on its own.
    try {
      const both = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS, video: video ? VIDEO_CONSTRAINTS : false });
      both.getTracks().forEach((t) => stream.addTrack(t));
    } catch (err) {
      try {
        stream.addTrack(await getTrack('audio'));
      } catch (audioErr) {
        setMicIssue(mediaIssueOf(audioErr));
      }
      if (video) {
        try {
          stream.addTrack(await getTrack('video'));
        } catch (videoErr) {
          setCamIssue(mediaIssueOf(videoErr ?? err));
        }
      }
    }
    setMicOn(stream.getAudioTracks().length > 0);
    setCamOn(video && stream.getVideoTracks().length > 0);
    videoDeviceRef.current = stream.getVideoTracks()[0]?.getSettings().deviceId ?? null;
    setMediaReady(true);
    bumpLocal();
    void refreshCameraCount();
  }, [refreshCameraCount]);

  useEffect(() => {
    if (stage === 'lobby' && details && !localStreamRef.current) void startMedia(details.method !== 'audio');
  }, [stage, details, startMedia]);

  const stopMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setMediaReady(false);
    bumpLocal();
  }, []);

  // Stop the camera and microphone when leaving the page.
  useEffect(() => () => stopMedia(), [stopMedia]);

  const toggleMic = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (!track) {
      // No microphone yet (it failed or was denied): try again.
      try {
        const fresh = await getTrack('audio');
        stream.addTrack(fresh);
        setMicIssue(null);
        setMicOn(true);
        await engineRef.current?.replaceTrack('audio', fresh);
        engineRef.current?.setMediaState({ mic: true, cam: camOn });
        bumpLocal();
      } catch (err) {
        setMicIssue(mediaIssueOf(err));
      }
      return;
    }
    const next = !track.enabled;
    track.enabled = next;
    setMicOn(next);
    engineRef.current?.setMediaState({ mic: next, cam: camOn });
  }, [camOn]);

  const toggleCam = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream || !isVideo || screenTrackRef.current) return;
    const current = stream.getVideoTracks()[0];
    if (current) {
      // Off: stop the camera (its light goes out) and send nothing.
      current.stop();
      stream.removeTrack(current);
      setCamOn(false);
      bumpLocal();
      await engineRef.current?.replaceTrack('video', null);
      engineRef.current?.setMediaState({ mic: micOn, cam: false });
      return;
    }
    try {
      const track = await getTrack('video', videoDeviceRef.current ?? undefined).catch(() => getTrack('video'));
      stream.addTrack(track);
      videoDeviceRef.current = track.getSettings().deviceId ?? null;
      setCamIssue(null);
      setCamOn(true);
      bumpLocal();
      await engineRef.current?.replaceTrack('video', track);
      engineRef.current?.setMediaState({ mic: micOn, cam: true });
      void refreshCameraCount();
    } catch (err) {
      setCamIssue(mediaIssueOf(err));
    }
  }, [isVideo, micOn, refreshCameraCount]);

  /** Next camera (front / back on phones). */
  const switchCamera = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream || !camOn) return;
    try {
      const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
      if (cams.length < 2) return;
      const at = cams.findIndex((c) => c.deviceId === videoDeviceRef.current);
      const next = cams[(at + 1) % cams.length];
      const old = stream.getVideoTracks()[0];
      old?.stop(); // some phones can't open two cameras at once
      if (old) stream.removeTrack(old);
      const track = await getTrack('video', next.deviceId);
      stream.addTrack(track);
      videoDeviceRef.current = track.getSettings().deviceId ?? next.deviceId;
      bumpLocal();
      await engineRef.current?.replaceTrack('video', track);
    } catch (err) {
      setCamIssue(mediaIssueOf(err));
      setCamOn(!!stream.getVideoTracks()[0]);
      bumpLocal();
    }
  }, [camOn]);

  /** Stops sharing and sends the camera again (or nothing, if the camera is off). */
  const stopScreenShare = useCallback(async () => {
    const screen = screenTrackRef.current;
    if (!screen) return;
    screenTrackRef.current = null;
    screen.onended = null;
    screen.stop();
    setSharing(false);
    const camera = localStreamRef.current?.getVideoTracks()[0] ?? null;
    await engineRef.current?.replaceTrack('video', camera);
    engineRef.current?.setMediaState({ mic: localStreamRef.current?.getAudioTracks()[0]?.enabled ?? false, cam: !!camera });
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (screenTrackRef.current) {
      await stopScreenShare();
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 30 } }, audio: false });
      const track = display.getVideoTracks()[0];
      if (!track) return;
      try {
        track.contentHint = 'detail';
      } catch {
        // Optional hint.
      }
      screenTrackRef.current = track;
      // The browser's own "Stop sharing" button ends the track.
      track.onended = () => void stopScreenShare();
      setSharing(true);
      await engineRef.current?.replaceTrack('video', track);
      engineRef.current?.setMediaState({ mic: micOn, cam: true });
    } catch {
      // Cancelled in the picker, or not allowed: nothing changes.
    }
  }, [micOn, stopScreenShare]);

  // ─── Joining and leaving ───────────────────────────────────────────────────

  const releaseWakeLock = useCallback(() => {
    void wakeLockRef.current?.release().catch(() => undefined);
    wakeLockRef.current = null;
  }, []);

  const join = useCallback(async () => {
    if (!details || stage === 'joining' || stage === 'in_call') return;
    setJoinError(null);
    setStage('joining');
    try {
      const res = await joinConsultationCallAction(consultationId);
      if ('error' in res) {
        setJoinError(res.error);
        setStage('lobby');
        void loadDetails();
        return;
      }
      offsetRef.current = res.serverNow - Date.now();
      setRelayConfigured(res.relay);
      let stream = localStreamRef.current;
      if (!stream) {
        stream = new MediaStream();
        localStreamRef.current = stream;
        setLocalStream(stream);
      }
      const engine = new CallEngine({
        supabase: createClient(),
        topic: res.topic,
        iceServers: res.iceServers,
        side: details.side,
        localStream: stream,
        media: { mic: micOn, cam: camOn },
        onPhase: (p) => {
          setPhase(p);
          setPhaseSince(Date.now() + offsetRef.current);
          if (p === 'connected') setConnectedAt((at) => at ?? Date.now());
          if (p === 'waiting') setConnectedAt(null);
          if (p === 'replaced') {
            engineRef.current = null;
            setStage('replaced');
            releaseWakeLock();
            stopMedia();
          }
        },
        onRemoteStream: setRemoteStream,
        onRemoteMedia: setRemoteMedia,
        onSignalling: setSignalling,
        onRoute: setRoute,
        onDebug: (event, detail) => {
          if (process.env.NODE_ENV !== 'production') console.debug('[call]', event, detail ?? '');
        },
      });
      engineRef.current = engine;
      if (process.env.NODE_ENV !== 'production') (window as unknown as { __justiciaCall?: CallEngine }).__justiciaCall = engine;
      engine.start();
      setPhase('joining');
      setPhaseSince(Date.now() + offsetRef.current);
      setStage('in_call');
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } };
        wakeLockRef.current = (await nav.wakeLock?.request('screen')) ?? null;
      } catch {
        // Not supported or not allowed; the call works without it.
      }
    } catch {
      setJoinError('We could not join the call. Check your connection and try again.');
      setStage('lobby');
    }
  }, [details, stage, consultationId, micOn, camOn, loadDetails, releaseWakeLock, stopMedia]);

  const leave = useCallback(async () => {
    const engine = engineRef.current;
    engineRef.current = null;
    if (screenTrackRef.current) {
      screenTrackRef.current.onended = null;
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
      setSharing(false);
    }
    releaseWakeLock();
    setStage('left');
    setRemoteStream(null);
    setConnectedAt(null);
    await engine?.stop('left');
    stopMedia();
  }, [releaseWakeLock, stopMedia]);

  /** Back to the lobby after leaving; the camera and microphone are asked for again. */
  const backToLobby = useCallback(() => {
    setPhase('joining');
    setJoinError(null);
    setStage('lobby');
    void loadDetails();
  }, [loadDetails]);

  // Hang up when the tab closes or the page unmounts.
  useEffect(() => {
    const onPageHide = () => {
      void engineRef.current?.stop('left');
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      void engineRef.current?.stop('left');
      engineRef.current = null;
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  // The screen may lock while the tab is hidden; take the wake lock again on return.
  useEffect(() => {
    if (stage !== 'in_call') return;
    const onVisible = async () => {
      if (document.visibilityState !== 'visible' || wakeLockRef.current) return;
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } };
        wakeLockRef.current = (await nav.wakeLock?.request('screen')) ?? null;
      } catch {
        // ignore
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [stage]);

  const joinOpensAt = details?.joinOpensAt ? Date.parse(details.joinOpensAt) : null;
  const endsAt = details?.endsAt ? Date.parse(details.endsAt) : null;

  return {
    details,
    loadError,
    stage,
    joinError,
    availability,
    now,
    joinOpensIn: joinOpensAt !== null ? Math.max(0, joinOpensAt - now) : null,
    endsAt,
    overTime: endsAt !== null && now >= endsAt,
    isVideo,
    // local media
    localStream,
    localVersion,
    mediaReady,
    micOn,
    camOn,
    micIssue,
    camIssue,
    canSwitchCamera: isVideo && camOn && cameraCount > 1 && !sharing,
    canShareScreen: isVideo && canShareScreen,
    sharing,
    toggleScreenShare,
    toggleMic,
    toggleCam,
    switchCamera,
    // call
    phase,
    /** Trying to connect (or reconnect) for over 20 seconds: show network advice. */
    slowConnect: (phase === 'connecting' || phase === 'reconnecting') && now - phaseSince > 20_000,
    connectedAt,
    remoteStream,
    remoteMedia,
    signalling,
    route,
    relayConfigured,
    join,
    leave,
    backToLobby,
  };
}
