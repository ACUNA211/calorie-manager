# 60: Voice capture

**What to build:** A mic button that uses the browser's speech recognition in the Member's language (English or Spanish), shows the transcript, and has a retry. No actions yet; this ticket only captures text.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 04 (English/Spanish switch)

**Status:** done (awaiting phone check)

- [ ] Tapping the mic and speaking shows the transcript in English or Spanish
- [x] Retry clears it and listens again (fake-recognizer test)
- [x] Browsers without speech recognition hide the mic button (test with the API removed)

## Comments

- 2026-10-19: Built `lib/speech.js`, `lib/useSpeechCapture.js` (returns `{supported, status, transcript, interim, error, start, stop, retry}` for 61 to 63) and `components/VoiceCapture.jsx`, mounted under the log box in `TodayPage.jsx` (two lines). English listens as `en-US`, Spanish as `es-MX` (a choice: the household's Spanish is assumed Latin American; one line in `speech.js` to change). Shows interim and final words, Retry, and messages for a blocked microphone and for no speech. Tested with a fake SpeechRecognition (7 tests) only. The first box (real speech, English and Spanish) is not ticked: it needs a phone check. Support, from MDN's browser-compat-data (https://github.com/mdn/browser-compat-data/blob/main/api/SpeechRecognition.json, page https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition): Chrome and Edge 33+ (prefixed `webkit`), unprefixed from 139; Safari 14.1+ prefixed `webkit`, and Safari on iOS is listed as mirroring Safari 14.1 (read through a summary; not seen in Apple's own page); Firefox only "preview". MDN notes Chrome sends audio to a server, so it does not work offline. Where the constructor is missing the mic is hidden.
