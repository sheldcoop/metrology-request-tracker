# Open questions

Parked decisions. Add the date and who raised it; move to DECISIONS.md once answered.

| # | Raised | Question | Notes |
|---|---|---|---|
| 1 | 2026-09-24, Prince | Old request list for the one-time import (M6) | Prince provides an anonymised sample (fake names) later. |
| 2 | 2026-09-24, Prince | SMTP details for real automatic emails | Needs IT: server, port, sender address (+ service account). Needs a server; until then Outlook drafts. |
| 3 | 2026-09-24 | Daily capacity per tool | Only tool Up/Down/Maintenance for now; capacity numbers if wanted later. |
| 4 | 2026-09-24 | Result values / verdict per panel | Only a results folder path for now; capturing key values would allow cross-lot charts later. |
| 5 | 2026-09-24 | Real extra fields per tool (HRM, AOI, PRF, QVM, FIB) | Tools start with none; real fields become seed data and test cases. |
| 6 | 2026-09-24, Prince | Real measurement types per tool | Sample types seeded (DECISIONS M1-8); Prince checks with engineers. Talk about it at the end of M1. |
| 7 | 2026-09-24, Prince | Real BKM library (names, paths, versions) | Sample BKMs with fake `\\SAMPLE-SHARE` paths seeded. Talk about it at the end of M1. |
| 8 | 2026-09-24, Prince | Server move (Docker / Kubernetes, Node + SQLite + API) | Not built now; design rules in CLAUDE.md "Architecture". Open: which server/cluster, who runs it, backups, how the app is served (then no more `file://`). |
| 9 | 2026-09-24, Prince | Company SSO login (Windows / Entra ID) | Needs the server first. Open: IT app registration, which claim to match (email or `DOMAIN\user`), what the domain name is. Users already store `windows_id`, `domain`, `email`. |
| 10 | 2026-09-24, Prince | Real email sending | Behind `js/adapters/mail.js`; today Outlook draft. Links to #2 (SMTP details). |
| 11 | 2026-09-24, Prince | Local AI (our LLM on ProKube) | Behind `js/adapters/ai.js`; off today. Check first: CORS from `file://`, which data may be sent (names, lot numbers, purposes?), IT/data-protection approval, where the API key lives (never in the share). What should AI do (e.g. suggest BKM, summarise a timeline)? |
| 12 | 2026-09-24 | CORS and `file://` | A page opened from `file://` has origin `null`; any server call needs the server to allow it, or the app must be served by the server. Decide when #8 starts. |
