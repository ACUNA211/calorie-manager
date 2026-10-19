# 101: Phone check: voice capture

**Type:** your task (not for an agent)

**What to do:** On your phone (the deployed app or `npm run dev` in `web/` on the same network), open Today and tap the mic under the log box. Speak in English and check the words appear and Retry clears and listens again. Switch to Español and do the same. Block the microphone in the browser's site settings and check the message. Then decide whether Spanish should be recognised as Mexican Spanish (`es-MX`, what's built) or Spain's (`es-ES`); it's one line in `web/src/lib/speech.js`. Note results and the choice in ticket 60's Comments and tick its first box.

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

**Unblocks:** 60

- [ ] English and Spanish transcripts appear on the phone
- [ ] Spanish variant chosen
