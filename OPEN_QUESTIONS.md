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
| 17 | 2026-09-24 | Part numbers: remaining details | Answered: a part number can belong to several projects (M1-13). Still open: required on a lot? any format rule? Needed by M2. |
| 18 | 2026-09-24, Prince | Second admin before go-live | Prince names a colleague; handover: PIN, backups, restore (R2). |
| 19 | 2026-09-24, Prince | Server / Kubernetes slot from IT | Prince asks IT now (R4, links to #8, #9, #12). Until then: shared-file version. |
