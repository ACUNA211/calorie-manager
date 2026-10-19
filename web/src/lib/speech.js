// Browser speech recognition: feature detection and language mapping (ticket 60).

// The app language to the recognition language tag. Spanish uses es-MX: the household's
// Spanish is Latin American (an assumption; change here if a Member needs es-ES).
export const SPEECH_LANGUAGES = { en: 'en-US', es: 'es-MX' };

export function speechLanguage(locale) {
  return SPEECH_LANGUAGES[locale] ?? SPEECH_LANGUAGES.en;
}

// The browser's SpeechRecognition constructor (prefixed in Chrome, Edge and Safari), or null.
export function getSpeechRecognition(scope = globalThis) {
  return scope?.SpeechRecognition ?? scope?.webkitSpeechRecognition ?? null;
}

export function speechSupported(scope = globalThis) {
  return getSpeechRecognition(scope) !== null;
}

// Maps a recognition error code to the kind the screen words: 'denied', 'noSpeech' or 'other'.
export function speechErrorKind(code) {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'denied';
  if (code === 'no-speech') return 'noSpeech';
  return 'other';
}
