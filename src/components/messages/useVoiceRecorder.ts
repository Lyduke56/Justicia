'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_VOICE_SECONDS } from '@/lib/messaging/types';

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg'];

function extensionFor(mime: string): string {
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  return 'weba';
}

export function isVoiceRecordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

/**
 * Records a voice message with the microphone (MediaRecorder). `stop()` hands the finished
 * file to `onRecorded`; `cancel()` throws the recording away. Stops automatically after 5 minutes.
 */
export function useVoiceRecorder(onRecorded: (file: File, durationSec: number) => void) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);
  const onRecordedRef = useRef(onRecorded);
  useEffect(() => {
    onRecordedRef.current = onRecorded;
  });

  const releaseMic = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  /** Returns an error message, or null once recording has started. */
  const start = useCallback(async (): Promise<string | null> => {
    if (!isVoiceRecordingSupported()) return 'Voice messages are not supported in this browser.';
    if (recorderRef.current) return null;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return 'Microphone access was blocked. Allow it in your browser settings to record a voice message.';
    }
    const mimeType = MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const began = Date.now();
    chunksRef.current = [];
    cancelledRef.current = false;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      releaseMic();
      recorderRef.current = null;
      setStartedAt(null);
      if (cancelledRef.current || chunksRef.current.length === 0) return;
      const type = (recorder.mimeType || mimeType || 'audio/webm').split(';')[0];
      const blob = new Blob(chunksRef.current, { type });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const file = new File([blob], `voice-message-${stamp}.${extensionFor(type)}`, { type });
      const seconds = Math.max(1, Math.round((Date.now() - began) / 1000));
      onRecordedRef.current(file, Math.min(seconds, MAX_VOICE_SECONDS));
    };
    streamRef.current = stream;
    recorderRef.current = recorder;
    recorder.start(250);
    setElapsed(0);
    setStartedAt(began);
    return null;
  }, []);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    else releaseMic();
  }, []);

  // Timer + automatic stop at the length limit.
  useEffect(() => {
    if (startedAt === null) return;
    const timer = setInterval(() => {
      const secs = (Date.now() - startedAt) / 1000;
      setElapsed(secs);
      if (secs >= MAX_VOICE_SECONDS && recorderRef.current?.state === 'recording') recorderRef.current.stop();
    }, 250);
    return () => clearInterval(timer);
  }, [startedAt]);

  // Never leave the microphone on when the view goes away.
  useEffect(
    () => () => {
      cancelledRef.current = true;
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      releaseMic();
    },
    []
  );

  return { recording: startedAt !== null, elapsed, start, stop, cancel };
}
