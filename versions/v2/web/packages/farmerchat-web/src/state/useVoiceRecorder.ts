/**
 * MediaRecorder-based voice capture — web adaptation of the app's OGG/OPUS
 * recorder (docs/03 fidelity map: "MediaRecorder (webm/opus)"). Produces a
 * base64 payload + the `input_audio_encoding_format` field for endpoint #16.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { blobToBase64 } from './helpers';

export type VoiceRecorderStatus = 'idle' | 'requesting' | 'recording' | 'processing' | 'error' | 'denied';

export interface VoiceRecording {
  base64: string;
  mimeType: string;
  /** Value sent as `input_audio_encoding_format` (e.g. "webm", "ogg", "mp4"). */
  format: string;
  durationMs: number;
  objectUrl: string;
  blob: Blob;
}

export interface VoiceRecorderState {
  status: VoiceRecorderStatus;
  elapsedMs: number;
  errorMessage: string | null;
}

export interface VoiceRecorderActions {
  start: () => Promise<void>;
  /** Stops and resolves the finished recording (null when nothing captured). */
  stop: () => Promise<VoiceRecording | null>;
  cancel: () => void;
  isSupported: () => boolean;
}

/**
 * Format labels follow docs/05 open-question #1: opus-in-webm/ogg is reported
 * as "ogg" (matching the app's OGG/OPUS pipeline); the mp4 fallback as "aac".
 */
const CANDIDATE_TYPES: Array<{ mime: string; format: string }> = [
  { mime: 'audio/webm;codecs=opus', format: 'ogg' },
  { mime: 'audio/webm', format: 'ogg' },
  { mime: 'audio/ogg;codecs=opus', format: 'ogg' },
  { mime: 'audio/mp4', format: 'aac' },
];

function pickMimeType(): { mime: string; format: string } | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const candidate of CANDIDATE_TYPES) {
    if (MediaRecorder.isTypeSupported(candidate.mime)) return candidate;
  }
  return { mime: '', format: 'ogg' };
}

export function useVoiceRecorder(): [VoiceRecorderState, VoiceRecorderActions] {
  const [state, setState] = useState<VoiceRecorderState>({ status: 'idle', elapsedMs: 0, errorMessage: null });
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const formatRef = useRef('ogg');
  const tickRef = useRef<number | null>(null);

  const cleanupStream = useCallback(() => {
    if (tickRef.current !== null) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => cleanupStream, [cleanupStream]);

  const isSupported = useCallback((): boolean => {
    return (
      typeof MediaRecorder !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia
    );
  }, []);

  const start = useCallback(async () => {
    if (!isSupported()) {
      setState({ status: 'error', elapsedMs: 0, errorMessage: 'Voice recording is not supported in this browser.' });
      return;
    }
    setState({ status: 'requesting', elapsedMs: 0, errorMessage: null });
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const denied = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      setState({
        status: denied ? 'denied' : 'error',
        elapsedMs: 0,
        errorMessage: denied ? 'Microphone permission denied.' : 'Could not access the microphone.',
      });
      return;
    }
    const picked = pickMimeType();
    formatRef.current = picked?.format ?? 'webm';
    const recorder = picked && picked.mime ? new MediaRecorder(stream, { mimeType: picked.mime }) : new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorderRef.current = recorder;
    streamRef.current = stream;
    startedAtRef.current = Date.now();
    recorder.start(250);
    setState({ status: 'recording', elapsedMs: 0, errorMessage: null });
    tickRef.current = window.setInterval(() => {
      setState((s) => (s.status === 'recording' ? { ...s, elapsedMs: Date.now() - startedAtRef.current } : s));
    }, 200);
  }, [isSupported]);

  const stop = useCallback(async (): Promise<VoiceRecording | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      cleanupStream();
      setState({ status: 'idle', elapsedMs: 0, errorMessage: null });
      return null;
    }
    setState((s) => ({ ...s, status: 'processing' }));
    const durationMs = Date.now() - startedAtRef.current;
    const mimeType = recorder.mimeType || 'audio/webm';

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunksRef.current, { type: mimeType }));
      recorder.stop();
    });
    cleanupStream();
    setState({ status: 'idle', elapsedMs: 0, errorMessage: null });
    if (blob.size === 0) return null;
    const base64 = await blobToBase64(blob);
    return {
      base64,
      mimeType,
      format: formatRef.current,
      durationMs,
      objectUrl: URL.createObjectURL(blob),
      blob,
    };
  }, [cleanupStream]);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    cleanupStream();
    setState({ status: 'idle', elapsedMs: 0, errorMessage: null });
  }, [cleanupStream]);

  return [state, { start, stop, cancel, isSupported }];
}
