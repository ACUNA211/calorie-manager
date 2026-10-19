import { useCallback, useEffect, useRef, useState } from 'react';
import { getSpeechRecognition, speechErrorKind, speechLanguage } from './speech.js';

// Listens once and gives back the words heard. Output for tickets 61 to 63:
//   { supported, status, transcript, interim, error, start, stop, retry }
// status is 'idle' | 'listening' | 'done' | 'error'; `transcript` holds the final words and
// `interim` the words still being worked out; error is 'denied' | 'noSpeech' | 'other' | null.
export function useSpeechCapture(locale) {
  const supported = getSpeechRecognition() !== null;
  const recognizer = useRef(null);
  const [state, setState] = useState({ status: 'idle', transcript: '', interim: '', error: null });

  const stop = useCallback(() => recognizer.current?.stop(), []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    recognizer.current?.abort();
    const rec = new Ctor();
    rec.lang = speechLanguage(locale);
    rec.continuous = false;
    rec.interimResults = true;
    const current = () => recognizer.current === rec;
    rec.onresult = (event) => {
      if (!current()) return;
      let finalText = '';
      let interimText = '';
      for (let i = 0; i < event.results.length; i += 1) {
        const piece = event.results[i][0]?.transcript ?? '';
        if (event.results[i].isFinal) finalText += piece;
        else interimText += piece;
      }
      setState((s) => ({ ...s, transcript: finalText.trim(), interim: interimText.trim() }));
    };
    rec.onerror = (event) => {
      if (!current() || event.error === 'aborted') return;
      setState((s) => ({
        ...s,
        status: 'error',
        interim: '',
        error: speechErrorKind(event.error),
      }));
    };
    rec.onend = () => {
      if (!current()) return;
      recognizer.current = null;
      setState((s) => (s.status === 'error' ? s : { ...s, status: 'done', interim: '' }));
    };
    recognizer.current = rec;
    setState({ status: 'listening', transcript: '', interim: '', error: null });
    try {
      rec.start();
    } catch {
      recognizer.current = null;
      setState({ status: 'error', transcript: '', interim: '', error: 'other' });
    }
  }, [locale]);

  // Retry clears what was heard and listens again.
  const retry = start;

  useEffect(
    () => () => {
      const rec = recognizer.current;
      recognizer.current = null;
      rec?.abort();
    },
    []
  );

  return { supported, ...state, start, stop, retry };
}
