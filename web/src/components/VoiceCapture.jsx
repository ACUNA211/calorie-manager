import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useSpeechCapture } from '../lib/useSpeechCapture.js';
import './VoiceCapture.css';

// A mic button that listens in the Member's language and shows what it heard, with Retry.
// Hidden where the browser has no speech recognition. Ticket 60 only captured text; a page that
// acts on the words passes `onHeard(transcript)`, called once per finished capture, and
// `onListen()`, called when listening starts again (to clear the last result). `children`
// shows under the transcript, for the option cards.
export default function VoiceCapture({ onHeard, onListen, children }) {
  const { t, locale } = useI18n();
  const { supported, status, transcript, interim, error, start, stop, retry } =
    useSpeechCapture(locale);
  const handled = useRef(false);

  useEffect(() => {
    if (status === 'listening') handled.current = false;
    if (status === 'done' && transcript && !handled.current) {
      handled.current = true;
      onHeard?.(transcript);
    }
  }, [status, transcript, onHeard]);

  if (!supported) return null;

  const listening = status === 'listening';
  const heard = [transcript, interim].filter(Boolean).join(' ');

  function listen(begin) {
    onListen?.();
    begin();
  }

  return (
    <section className="voice" aria-label={t('voice.heading')}>
      <button
        type="button"
        className="btn-quiet voice-mic"
        aria-pressed={listening}
        onClick={listening ? stop : () => listen(start)}
      >
        <span aria-hidden="true">🎤 </span>
        {listening ? t('voice.stop') : t('voice.start')}
      </button>
      <p className="voice-status" role="status" aria-live="polite">
        {listening && !heard ? t('voice.listening') : null}
        {heard ? <span className="voice-transcript">{heard}</span> : null}
        {status === 'done' && !heard ? t('voice.nothing') : null}
      </p>
      {error ? (
        <p className="voice-error" role="alert">
          {t(`voice.error.${error}`)}
        </p>
      ) : null}
      {children}
      {status === 'done' || status === 'error' ? (
        <button type="button" className="btn-quiet" onClick={() => listen(retry)}>
          {t('voice.retry')}
        </button>
      ) : null}
    </section>
  );
}
