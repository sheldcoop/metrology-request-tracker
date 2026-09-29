# Milestone 3 — Identity & auth: COMPLETE

Date: 2026-09-29. Branch: `m3-identity`.

## Security model (as built)

- Identity is SOFT by design (DECISIONS M1-3): `?who=` / remembered ID /
  typed name only say which store record you are. Impersonating another
  existing user by typing their ID is accepted for a small team.
- Privilege is HARD: roles live only in the store record. Every
  `saveEntry` (including users + PIN change) requires the Admin role
  server-side-in-spirit (`store.js: requireAdmin`). There is no URL,
  localStorage, or API path to self-promote: proven by test + grep.
- PIN is a screen-level gate for the Settings UI (`verifyPin`, salted
  SHA-256, never plain). Even with the PIN dialog bypassed, a non-admin
  still cannot write anything: `requireAdmin` refuses. Both layers tested.

## Tests added

- Engineer cannot take admin, hand it out, or change the PIN
  (`not_admin` each).
- Role change is live on the next `currentUser()` read (no reload, one
  render cycle — views re-render on route and read live state).
- Login normalization matrix: domain case, bare ID, double backslash,
  trailing/leading backslash, UPN, 65-char ID, bad chars, blank.
- Pre-existing, verified still green: first-admin flow, PIN hashed/right/
  wrong, name-match sign-up, already-linked refusal.

## Grep proofs

- `roles:` written only in `settings-users.js` dialog -> `saveEntry`.
- `location.search` outside `identity.js`: only dev ui-kit params.
- `localStorage` outside identity/prefs/themes: only dev ui-kit.

## Fixes

None needed.

## Gates

675/675 unit, app-smoke 302, ui-smoke ok, css ok, contrast 0, preview 13.
