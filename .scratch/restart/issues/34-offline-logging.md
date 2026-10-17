# 34: Offline logging

**What to build:** Logging on Today works with no signal: entries are queued on the phone and sent when back online, in order. The screen marks entries that haven't synced yet.

Read `CONTEXT.md` (vocabulary) and ADRs 0002 and 0003 before starting.

**Blocked by:** 23 (Today: log a food), 03 (Home Screen install and offline app shell)

**Status:** ready-for-agent

- [ ] With the network off, logging a food from the Food Library adds it to Today, marked "not synced"
- [ ] Turning the network back on sends queued entries and clears the mark
- [ ] A queued entry that fails to sync shows an error instead of vanishing
- [ ] Searching USDA offline says it needs a connection
