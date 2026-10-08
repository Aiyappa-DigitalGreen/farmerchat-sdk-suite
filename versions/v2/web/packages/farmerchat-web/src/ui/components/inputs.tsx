/**
 * User input surfaces (components/userinput): PrimaryInputButtons
 * (Photo/Speak/Type), TextInputOverlay, VoiceInputOverlay (MediaRecorder),
 * PhotoInputOverlay (`<input capture>` camera / gallery per docs/03 fidelity
 * map). All capability-detected: unsupported inputs degrade gracefully.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { onSuspendMedia } from '../../core/mediaSuspend';
import { FcIcon } from './FcIcon';
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
    <div className="fcsdk-c-tilerow">
      {props.enableImages ? (
        <button
          type="button"
          className="fcsdk-c-tile"
          onClick={() => {
            services.analytics.track(Events.IMAGE_OPTION_DIALOG_CLICK_EVENT, {});
            props.onSelect('photo');
          }}
        >
          <FcIcon name="icon_camera" size={28} />
          <span className="fcsdk-c-tile-label">{label('fc_v2_app_label_photo', 'Photo')}</span>
        </button>
      ) : null}
      {voiceSupported ? (
        <button
          type="button"
          className="fcsdk-c-tile"
          onClick={() => {
            services.analytics.track(Events.MICROPHONE_CLICK_EVENT, {});
            props.onSelect('speak');
          }}
        >
          <FcIcon name="icon_mic" size={28} />
          <span className="fcsdk-c-tile-label">{label('fc_v2_app_label_speak', 'Speak')}</span>
        </button>
      ) : null}
      <button
        type="button"
        className="fcsdk-c-tile"
        onClick={() => {
          services.analytics.track(Events.CHAT_ICON_CLICKED, {});
          props.onSelect('type');
        }}
      >
        <FcIcon name="icon_keyboard" size={28} />
          <span className="fcsdk-c-tile-label">{label('fc_v2_app_label_type', 'Type')}</span>
      </button>
    </div>
  );
}

/** UserInput.kt bottom sheet: 25% black scrim, a surfaceSecondary sheet sliding up, top radius 16. */
function BottomSheet(props: { onDismiss: () => void; children: React.ReactNode; padding: string }) {
  return (
    <div className="fcsdk-c-inputsheet-host" onClick={props.onDismiss}>
      <div className="fcsdk-c-inputsheet" style={{ padding: props.padding }} onClick={(e) => e.stopPropagation()}>
        {props.children}
      </div>
    </div>
  );
}

/** A 48dp forced-light action circle (#08361B with a #00C950 icon) — InputActionButton. */
function ActionCircle(props: { icon: 'icon_camera' | 'icon_mic' | 'icon_send' | 'm_delete'; size?: number; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="fcsdk-c-actioncircle" aria-label={props.label} onClick={props.onClick} disabled={props.disabled}>
      {props.icon === 'icon_send' ? (
        <FcIcon name="icon_send" width={props.size ?? 22} tint="#00C950" />
      ) : (
        <FcIcon name={props.icon} size={props.size ?? 22} tint="#00C950" />
      )}
    </button>
  );
}

/**
 * UserInput.kt TextInputOverlay (legacy): camera · field (pill at rest, 16 radius active,
 * bodyLarge) · mic/send, on a surfaceSecondary sheet.
 */
export function TextInputOverlay(props: {
  onSend: (text: string) => void;
  onClose: () => void;
  placeholder?: string;
  onPhoto?: () => void;
  onVoice?: () => void;
}) {
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
  const hasText = text.trim().length > 0;
  return (
    <BottomSheet onDismiss={props.onClose} padding="16px 12px calc(12px + var(--fc-inset-bottom))">
      <div className="fcsdk-c-textsheet-row">
        {!hasText && props.onPhoto ? <ActionCircle icon="icon_camera" label={label('fc_v2_app_label_photo', 'Photo')} onClick={props.onPhoto} /> : null}
        <textarea
          ref={areaRef}
          className={`fc-t-bodyLarge fcsdk-c-textsheet-field${hasText ? ' fcsdk-c-textsheet-field--active' : ''}`}
          rows={1}
          value={text}
          placeholder={props.placeholder ?? label('fc_v2_app_label_ask_about_your_farm', 'Ask about your farm...')}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          aria-label={label('fc_v2_app_label_ask_about_your_farm', 'Ask about your farm...')}
        />
        {hasText || !props.onVoice ? (
          <ActionCircle icon="icon_send" label={label('fc_v2_app_label_send', 'Send')} onClick={send} disabled={!hasText} />
        ) : (
          <ActionCircle icon="icon_mic" label={label('fc_v2_app_label_speak', 'Speak')} onClick={props.onVoice} />
        )}
      </div>
    </BottomSheet>
  );
}

/** A row of animated bars standing in for the live mic level while recording. */
function LiveWave(props: { bars: number; active: boolean }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!props.active) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 120);
    return () => window.clearInterval(id);
  }, [props.active]);
  return (
    <span className="fcsdk-c-livewave" aria-hidden>
      {Array.from({ length: props.bars }, (_, i) => {
        const h = props.active ? 6 + Math.abs(Math.sin(i * 0.9 + tick * 0.7) * Math.cos(i * 0.37 + tick * 0.31)) * 24 : 6;
        return <span key={i} style={{ height: h }} />;
      })}
    </span>
  );
}

/**
 * UserInput.kt VoiceInput sheet: "Speak now" / "Processing...", the prompt, then Delete · live
 * wave · Send, and the background-noise tip with a green info icon.
 */
export function VoiceInputOverlay(props: {
  onRecorded: (recording: VoiceRecording) => void;
  onClose: () => void;
  onPermissionDenied: () => void;
}) {
  const [recState, recorder] = useVoiceRecorder();
  const label = useLabel();
  const { services } = useSdk();
  const startedRef = useRef(false);
  const [processing, setProcessing] = useState(false);

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
    setProcessing(true);
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
    <BottomSheet onDismiss={cancel} padding="16px 8px calc(8px + var(--fc-inset-bottom))">
      <div className="fcsdk-c-voicesheet">
        {recState.status === 'error' ? (
          <div className="fc-t-bodyMedium" style={{ color: 'var(--fc-c-feedback-fail)', textAlign: 'center' }}>
            {recState.errorMessage}
          </div>
        ) : (
          <>
            <div className="fcsdk-c-section" style={{ gap: 8, alignItems: 'center', textAlign: 'center' }}>
              <div className="fc-t-titleLarge" style={{ color: 'var(--fc-c-fg-primary)' }}>
                {processing
                  ? label('fc_v2_app_label_processing', 'Processing...')
                  : label('fc_v2_app_label_listening', 'Speak now')}
              </div>
              <div className="fc-t-bodyLarge" style={{ color: 'var(--fc-c-fg-secondary)' }}>
                {label('fc_v2_app_label_ask_your_farming_question', 'Ask about your farm or livestock')}
              </div>
            </div>
            <div style={{ height: 32 }} />
            <div className="fcsdk-c-voicesheet-row">
              <ActionCircle icon="m_delete" size={28} label={label('fc_v2_app_label_cancel', 'Cancel')} onClick={cancel} />
              <LiveWave bars={36} active={recState.status === 'recording' && !processing} />
              <ActionCircle icon="icon_send" label={label('fc_v2_app_label_send', 'Send')} onClick={() => void finish()} disabled={processing} />
            </div>
            <div style={{ height: 32 }} />
            <div className="fcsdk-c-voicesheet-tip">
              <FcIcon name="m_info" size={23} tint="#00C950" />
              <span className="fc-t-bodySmall" style={{ color: 'var(--fc-c-fg-secondary)' }}>
                {label('fc_v2_app_label_voice_input_is_still_improving', 'Keep background noise low')}
              </span>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

/**
 * UserInput.kt PhotoInput sheet: two 168dp tiles (Camera / Photos) on surfaceTertiary. Legacy mode
 * then asks an optional question beside the thumbnail before sending.
 */
export function PhotoInputOverlay(props: {
  onPicked: (file: File, objectUrl: string, question: string) => void;
  onClose: () => void;
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
      props.onPicked(f, url, '');
      return;
    }
    setFile(f);
    setObjectUrl(url);
  };

  return (
    <BottomSheet onDismiss={props.onClose} padding={file ? '16px 12px calc(12px + var(--fc-inset-bottom))' : '24px 12px calc(8px + var(--fc-inset-bottom))'}>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
      <input ref={galleryRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
      {!file ? (
        <div className="fcsdk-c-photosheet-row">
          <button type="button" className="fcsdk-c-photosheet-tile" onClick={() => cameraRef.current?.click()}>
            <FcIcon name="icon_camera" size={32} tint="var(--fc-c-fg-primary)" />
            <span className="fc-t-labelMedium" style={{ color: 'var(--fc-c-fg-secondary)' }}>
              {label('fc_v2_app_label_camera', 'Camera')}
            </span>
          </button>
          <button type="button" className="fcsdk-c-photosheet-tile" onClick={() => galleryRef.current?.click()}>
            <FcIcon name="m_photo_library" size={32} tint="var(--fc-c-fg-primary)" />
            <span className="fc-t-labelMedium" style={{ color: 'var(--fc-c-fg-secondary)' }}>
              {label('fc_v2_app_label_photos', 'Photos')}
            </span>
          </button>
        </div>
      ) : (
        <div className="fcsdk-c-section" style={{ gap: 10 }}>
          <div className="fcsdk-composer-thumb" style={{ width: 64, height: 64 }}>
            {objectUrl ? <img src={objectUrl} alt="" /> : null}
            <button
              type="button"
              aria-label="remove"
              onClick={() => {
                if (objectUrl) URL.revokeObjectURL(objectUrl);
                setFile(null);
                setObjectUrl(null);
              }}
            >
              <FcIcon name="m_close" size={14} tint="var(--fc-c-fg-primary)" />
            </button>
          </div>
          <div className="fcsdk-c-textsheet-row">
            <textarea
              className="fc-t-bodyLarge fcsdk-c-textsheet-field fcsdk-c-textsheet-field--active"
              rows={1}
              value={question}
              placeholder={label('fc_v2_app_label_ask_about_your_farm', 'Ask about your farm...')}
              onChange={(e) => setQuestion(e.target.value)}
              aria-label={label('fc_v2_app_label_ask_about_your_farm', 'Ask about your farm...')}
            />
            <ActionCircle
              icon="icon_send"
              label={label('fc_v2_app_label_send', 'Send')}
              onClick={() => {
                if (file && objectUrl) props.onPicked(file, objectUrl, question.trim());
              }}
            />
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

/**
 * UserInput.kt VoiceClip in a user bubble: a 50dp pill (surfaceSecondary) — a 38dp forced-light
 * play button, 26 waveform bars (green up to the playhead while playing) and an m:ss timer.
 */
export function VoiceClip(props: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const heights = useMemo(() => Array.from({ length: 26 }, () => Math.min(30, Math.max(6, Math.random() * 30))), []);

  useEffect(() => {
    const audio = new Audio(props.src);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    };
    audio.onplay = () => setIsPlaying(true);
    audio.onpause = () => setIsPlaying(false);
    audio.onended = () => {
      setIsPlaying(false);
      setProgress(0);
      setPosition(0);
    };
    audio.ontimeupdate = () => {
      setPosition(audio.currentTime);
      if (audio.duration && Number.isFinite(audio.duration)) setProgress(audio.currentTime / audio.duration);
    };
    audioRef.current = audio;
    // Hidden SDK (widget closed): stop playback.
    const offSuspend = onSuspendMedia(() => audio.pause());
    return () => {
      offSuspend();
      audio.pause();
      audioRef.current = null;
    };
  }, [props.src]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => setIsPlaying(false));
    else audio.pause();
  };
  const shown = isPlaying ? position : duration;

  return (
    <div className="fcsdk-c-voiceclip">
      <button type="button" className="fcsdk-c-voiceclip-btn" onClick={toggle} aria-label={isPlaying ? 'pause' : 'play'}>
        <FcIcon name={isPlaying ? 'm_pause' : 'm_play_arrow'} size={24} tint="#00C950" />
      </button>
      <span className="fcsdk-c-voiceclip-wave" aria-hidden>
        {heights.map((h, i) => (
          <span key={i} style={{ height: h, background: isPlaying && i / heights.length <= progress ? 'var(--fc-c-button-accent)' : 'var(--fc-c-fg-tertiary)' }} />
        ))}
      </span>
      <span className="fc-t-labelSmall" style={{ color: 'var(--fc-c-fg-secondary)' }}>
        {formatSeconds(Math.floor(shown))}
      </span>
    </div>
  );
}
