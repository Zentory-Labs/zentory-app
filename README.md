# ZENTORY App

**Non-custodial Alpha Vaults + Signal Arena interface for HyperEVM.**

Source for [app.zentorylabs.com](https://app.zentorylabs.com) — the end-user interface for ZENTORY Protocol.

## What this is

ZENTORY App is the front-end application for ZENTORY Protocol. It connects to the protocol's on-chain contracts (deployed on HyperEVM, chain id 998 testnet) via [wagmi](https://wagmi.sh) + [viem](https://viem.sh) and uses [Supabase](https://supabase.com) for indexer data and user sessions.

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · wagmi · viem · Supabase · Upstash

### What you can do with it

**As a depositor:**
- Deposit BTC, ETH, SOL, XRP, or HYPE into an ERC-4626 Alpha Vault and receive vault shares.
- Withdraw vault shares at any time for the underlying asset (no lockup beyond your own decision).
- View your vault positions, accrued yield, and historical performance.
- Track Hold vs Ghost vs Actual attribution for your vault.

**As a quant researcher:**
- Submit EIP-712 signed trading signals against any vault.
- Stake ZENT against your signal's accuracy; build reputation over time.
- View your signal history, epoch scores, and leaderboard position.
- Subscribe to other quants' signal feeds with ZENT.

**As a governance participant:**
- Lock ZENT for veZENT to vote on protocol parameters.
- Participate in epoch scoring weight proposals.
- View and vote on treasury grants.

## Status

- **Testnet only** (HyperEVM chain id 998). Contracts at `Zentory-Labs/zentory-protocol`.
- Mainnet target: Q4 2026 after external audit.

## Related repos

| Repo | Purpose |
|---|---|
| [`Zentory-Labs/zentory-protocol`](https://github.com/Zentory-Labs/zentory-protocol) | Smart contracts, tests, deploy scripts, whitepaper |
| [`Zentory-Labs/zentorylabs.com`](https://github.com/Zentory-Labs/zentorylabs.com) | Marketing site |
| [`Zentory-Labs/zentory-engine`](https://github.com/Zentory-Labs/zentory-engine) | Strategy research engine (private) |

## Development

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Fill in: NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID, NEXT_PUBLIC_SUPABASE_URL, etc.

# Run locally
npm run dev

# Build for production
npm run build

# Run tests
npm run test
```

## License

AGPL-3.0 with additional terms. See [LICENSE](LICENSE).

Any hosted or managed version of this app that uses ZENTORY Protocol must prominently display "Powered by ZENTORY Protocol" and publish modifications under AGPL-3.0. See LICENSE file for full terms.

---

*ZENTORY Labs — building the verifiable signal market for HyperEVM.*
