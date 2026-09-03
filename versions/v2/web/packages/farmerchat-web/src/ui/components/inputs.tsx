/**
 * User input surfaces (components/userinput): PrimaryInputButtons
 * (Photo/Speak/Type), TextInputOverlay, VoiceInputOverlay (MediaRecorder),
 * PhotoInputOverlay (`<input capture>` camera / gallery per docs/03 fidelity
 * map). All capability-detected: unsupported inputs degrade gracefully.
 */

import { useEffect, useRef, useState } from 'react';
import { Icon } from './common';
import { useLabel, useSdk } from '../context';
import { useVoiceRecorder, VoiceRecording } from '../../state/useVoiceRecorder';
import { Events } from '../../core/analytics';
import { formatSeconds } from '../../state/helpers';

export type InputKind = 'photo' | 'speak' | 'type';

/** Sticky Photo / Speak / Type row (docs/01 §3.7 stickyHeader). */
export function PrimaryInputButtons(props: { onSelect: (kind: InputKind) => void; enableVoice: boolean; enableImages: boolean }) {
  const label = useLabel();
  const { services } = useSdk();
  const voiceSupported =
    props.enableVoice && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  return (
    <div className="fcsdk-inputbtns">
      {props.enableImages ? (
        <button
          type="button"
          className="fcsdk-inputbtn"
          onClick={() => {
            services.analytics.track(Events.IMAGE_OPTION_DIALOG_CLICK_EVENT, {});
            props.onSelect('photo');
          }}
        >
          <span aria-hidden>{Icon.camera}</span> {label('input_photo', 'Photo')}
        </button>
      ) : null}
      {voiceSupported ? (
        <button
          type="button"
          className="fcsdk-inputbtn"
          onClick={() => {
            services.analytics.track(Events.MICROPHONE_CLICK_EVENT, {});
            props.onSelect('speak');
          }}
        >
          <span aria-hidden>{Icon.mic}</span> {label('input_speak', 'Speak')}
        </button>
      ) : null}
      <button
        type="button"
        className="fcsdk-inputbtn"
        onClick={() => {
          services.analytics.track(Events.CHAT_ICON_CLICKED, {});
          props.onSelect('type');
        }}
      >
        <span aria-hidden>{Icon.keyboard}</span> {label('input_type', 'Type')}
      </button>
    </div>
  );
}

export function TextInputOverlay(props: { onSend: (text: string) => void; onClose: () => void; placeholder?: string }) {
  const [text, setText] = useState('');
  const label = useLabel();
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    areaRef.current?.focus();
  }, []);
  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    props.onSend(trimmed);
  };
  return (
    <div className="fcsdk-overlay" onClick={props.onClose}>
      <div className="fcsdk-overlay-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="fcsdk-textinput-row">
          <textarea
            ref={areaRef}
            value={text}
            placeholder={props.placeholder ?? label('input_type_placeholder', 'Ask your question…')}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            aria-label={label('input_type_placeholder', 'Ask your question…')}
          />
          <button type="button" className="fcsdk-sendbtn" onClick={send} disabled={!text.trim()} aria-label="send">
            {Icon.send}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Voice recording overlay — MediaRecorder webm/opus (docs/03). */
export function VoiceInputOverlay(props: {
  onRecorded: (recording: VoiceRecording) => void;
  onClose: () => void;
  onPermissionDenied: () => void;
}) {
  const [recState, recorder] = useVoiceRecorder();
  const label = useLabel();
  const { services } = useSdk();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      void recorder.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (recState.status === 'denied') {
      services.analytics.track(Events.PERMISSION_DENIED, { permission: 'microphone' });
      props.onPermissionDenied();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recState.status]);

  const finish = async () => {
    services.analytics.track(Events.SEND_RECORD_AUDIO_CLICK_EVENT, {});
    const recording = await recorder.stop();
    if (recording) props.onRecorded(recording);
    else props.onClose();
  };

  const cancel = () => {
    services.analytics.track(Events.CANCEL_RECORD_AUDIO_CLICK_EVENT, {});
    recorder.cancel();
    props.onClose();
  };

  return (
    <div className="fcsdk-overlay" onClick={cancel}>
      <div className="fcsdk-overlay-sheet" style={{ alignItems: 'center', gap: 16 }} onClick={(e) => e.stopPropagation()}>
        {recState.status === 'error' ? (
          <div className="fcsdk-error-inline">{recState.errorMessage}</div>
        ) : (
          <>
            <div style={{ fontWeight: 700 }}>
              {recState.status === 'recording'
                ? label('voice_listening', 'Listening…')
                : label('voice_preparing', 'Preparing microphone…')}
            </div>
            <div className="fcsdk-timer">{formatSeconds(Math.floor(recState.elapsedMs / 1000))}</div>
            <button type="button" className="fcsdk-recbtn" onClick={finish} aria-label={label('voice_stop_and_send', 'Stop and send')}>
              {Icon.mic}
            </button>
            <button type="button" className="fcsdk-btn-text" onClick={cancel}>
              {label('voice_cancel', 'Cancel')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Photo picker overlay — camera capture + gallery via <input type=file>. */
export function PhotoInputOverlay(props: {
  onPicked: (file: File, objectUrl: string, question: string) => void;
  onClose: () => void;
  /**
   * 2.0.0 composer mode: pick and hand the image straight back as an ATTACHMENT, with no
   * question step. Compose's `PhotoInput` behaves this way whenever the unified composer owns
   * the input surface — the question is typed in the composer field alongside the thumbnail,
   * so asking for it twice would be a dead end (see InputComposer.kt `photoUris`).
   */
  attachOnly?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const label = useLabel();

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    const url = URL.createObjectURL(f);
    if (props.attachOnly) {
      // Hand it back as an attachment; the composer renders the thumbnail and owns the question.
      props.onPicked(f, url, '');
      return;
    }
    setFile(f);
    setObjectUrl(url);
  };

  return (
    <div className="fcsdk-overlay" onClick={props.onClose}>
      <div className="fcsdk-overlay-sheet" onClick={(e) => e.stopPropagation()}>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        {!file ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="fcsdk-inputbtn" onClick={() => cameraRef.current?.click()}>
              <span aria-hidden>{Icon.camera}</span> {label('photo_take', 'Take photo')}
            </button>
            <button type="button" className="fcsdk-inputbtn" onClick={() => galleryRef.current?.click()}>
              <span aria-hidden>🖼️</span> {label('photo_gallery', 'Choose from gallery')}
            </button>
          </div>
        ) : (
          <>
            <div className="fcsdk-photothumb">
              {objectUrl ? <img src={objectUrl} alt="selected" /> : null}
              <button
                type="button"
                aria-label="remove"
                onClick={() => {
                  if (objectUrl) URL.revokeObjectURL(objectUrl);
                  setFile(null);
                  setObjectUrl(null);
                }}
              >
                {Icon.close}
              </button>
            </div>
            <div className="fcsdk-textinput-row">
              <textarea
                value={question}
                placeholder={label('photo_question_placeholder', 'Add a question about this photo (optional)')}
                onChange={(e) => setQuestion(e.target.value)}
                aria-label={label('photo_question_placeholder', 'Add a question about this photo (optional)')}
              />
              <button
                type="button"
                className="fcsdk-sendbtn"
                aria-label="send"
                onClick={() => {
                  if (file && objectUrl) props.onPicked(file, objectUrl, question.trim());
                }}
              >
                {Icon.send}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Voice clip playback inside a user chat bubble (single active player). */
export function VoiceClip(props: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const toggle = () => {
    if (!audioRef.current) {
      const audio = new Audio(props.src);
      audioRef.current = audio;
      audio.onplay = () => setIsPlaying(true);
      audio.onpause = () => setIsPlaying(false);
      audio.onended = () => {
        setIsPlaying(false);
        setProgress(0);
      };
      audio.ontimeupdate = () => {
        if (audio.duration && Number.isFinite(audio.duration)) {
          setProgress(audio.currentTime / audio.duration);
        }
      };
    }
    const audio = audioRef.current;
    if (audio.paused) void audio.play().catch(() => setIsPlaying(false));
    else audio.pause();
  };

  return (
    <div className="fcsdk-voiceclip">
      <button type="button" onClick={toggle} aria-label={isPlaying ? 'pause' : 'play'}>
        {isPlaying ? Icon.pause : Icon.play}
      </button>
      <div className="fcsdk-voiceclip-bar">
        <span style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
    </div>
  );
}
