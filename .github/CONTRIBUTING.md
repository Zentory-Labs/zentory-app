# Contributing to zentory-app

This repo follows the same contribution + security policy as the rest of
ZENTORY. **Canonical doc lives in the protocol repo** — see
[`Zentory-Labs/zentory-protocol/.github/CONTRIBUTING.md`](https://github.com/Zentory-Labs/zentory-protocol/blob/main/.github/CONTRIBUTING.md)
and [`Zentory-Labs/zentory-protocol/SECURITY_HARDENING.md`](https://github.com/Zentory-Labs/zentory-protocol/blob/main/SECURITY_HARDENING.md).

## Highlights (repo-specific)

1. **Open an issue first.** Unsolicited PRs from first-time contributors
   are closed on sight.
2. **Hard "no" changes** (close + block-the-author): touches to
   `.github/workflows/*`, `package.json`/`package-lock.json`,
   `next.config.*`, `middleware.ts`, `lib/contracts.ts`,
   `lib/wagmi.ts`, `lib/supabase*`, `app/api/*` from a non-maintainer; new
   dependencies without prior design discussion; postinstall scripts in
   any added deps; PRs that touch `public/forward_ledger.jsonl` (it is
   machine-published).
3. **The dApp is AGPL-3.0.** Any fork that runs as a service must open-
   source its modifications. See `LICENSE`.
4. **Security disclosures** → see `SECURITY.md` (do NOT open a public
   issue/PR for vulnerabilities).

## What we welcome

- Bug reports with steps to reproduce.
- Doc/typo fixes (small PRs OK).
- Discussion of UI/UX in issues.

## What we don't accept

- Refactors, lint-only PRs, dependency bumps, or new tests without a
  linked issue + maintainer ack.
