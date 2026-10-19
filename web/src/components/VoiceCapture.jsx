import { useI18n } from '../i18n/I18nProvider.jsx';
import { useSpeechCapture } from '../lib/useSpeechCapture.js';
import './VoiceCapture.css';

// A mic button that listens in the Member's language and shows what it heard, with Retry.
// It only captures text (ticket 60); the voice tickets after it act on the words. Hidden
// where the browser has no speech recognition.
export default function VoiceCapture() {
  const { t, locale } = useI18n();
  const { supported, status, transcript, interim, error, start, stop, retry } =
    useSpeechCapture(locale);
  if (!supported) return null;

  const listening = status === 'listening';
  const heard = [transcript, interim].filter(Boolean).join(' ');

  return (
    <section className="voice" aria-label={t('voice.heading')}>
      <button
        type="button"
        className="btn-quiet voice-mic"
        aria-pressed={listening}
        onClick={listening ? stop : start}
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
      {status === 'done' || status === 'error' ? (
        <button type="button" className="btn-quiet" onClick={retry}>
          {t('voice.retry')}
        </button>
      ) : null}
    </section>
  );
}
