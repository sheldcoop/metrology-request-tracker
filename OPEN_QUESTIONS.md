# Open questions

Parked decisions. Add the date and who raised it; move to DECISIONS.md once answered.

| # | Raised | Question | Notes |
|---|---|---|---|
| 1 | 2026-09-24, Prince | Old request list for the one-time import (M6) | Prince gives an anonymised sample (fake names) right before M6 (R3). |
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
| 13 | 2026-09-24, Prince | Put the current test data file into the repo for now | Prince wants `data/mrt_data.json` (his Mac test file) in the repo temporarily, so an office download works like his Mac; removed again when real data comes. Not done yet (tool step was stopped). Caution: a tracked live file can be overwritten by a later `git pull`, and the repo is public (name, email, PIN hash). |
| 14 | 2026-09-24, Prince | Rights per role (who may do what) | Today: Engineer requests, Quality engineer measures (primary/backup of a tool, tool status; queue actions from M3), Operator has no rights, Manager sees manager analytics, Admin has Settings. Design the full table later - e.g. whether Operators may measure, accept or complete requests. One place in code: `domain.canMeasure()` (+ role checks next to it). |
| 16 | 2026-09-24, Prince | Design polish: engineered animations P1-P7 | Plan in DECISIONS "Design polish plan". Plan each one first and ask Prince before building. Needs the screens they belong to (traveller card M2, board M3, bell M4). |
| 17 | 2026-09-24 | Part numbers: remaining details | Answered: a part number can belong to several projects (M1-13). Built in Settings > Lists with a provisional format (capitals, digits, `- . _ /`, up to 30; `domain.isPartNumber()`). Still open: required on a lot? the real format rule? Needed by M2. |
| 18 | 2026-09-24, Prince | Second admin before go-live | Prince names a colleague; handover: PIN, backups, restore (R2). |
| 19 | 2026-09-24, Prince | Server / Kubernetes slot from IT | Prince asks IT now (R4, links to #8, #9, #12). Until then: shared-file version. |
| 20 | 2026-09-24, Prince | Linked lots for analysis | A split lot (`18178.01`) belongs to its parent (`18178`); later also "related lots" to compare in analytics. Open: link automatically from the number, or by hand? which analysis? Not built in M2 - lot numbers are kept so the link can be added without a data change. |
| 22 | 2026-09-24, Prince | **Hirata code** in the app | Built 2026-09-25 (DECISIONS H-3): Hirata tools page, copper panels in the form, request page and slip. Still open: (a) should a panel ID need at least 4 digits (H-1)? today 1-9 are accepted so old IDs like "23" stay valid; (b) attach decoded panels to a lot; (c) a PNG download of patterns (Print works). |
| 21 | 2026-09-24 | Lot number rule | Mostly 5 digits, split lots `.01`/`.02` (M2-1). Open: ever 4 or 6 digits, letters, or `.1` instead of `.01`? Until answered: digits, optionally a dot and 1-2 digits. |
