# ZENTORY dApp — Copy & Performance-Claim Style Guide

Rules for any user-facing copy that describes performance or the vaults. Derived from
the strategy-research honesty pass (see workspace `STRATEGY_IMPROVEMENT_PLAN.md`) and the
regulatory memo. Reviewers: reject copy that violates these.

## Banned words / claims (never, anywhere user-facing)
- **guaranteed**, **risk-free**, **safe** (as a return claim), **can't lose / cannot lose**,
  **always beats BTC**, **beat BTC by far**, **passive income** implying certainty.
- Reason: beating BTC requires perfect market timing — impossible to guarantee — and these
  phrases map directly onto SEC/CFTC fraud red-flag language (Investor.gov digital-asset alert).
- A grep guard exists in CI intent; if you add one of these words in an honest *negation*
  (e.g. "cash is **not** risk-free"), that's fine — the ban is on *promising* them.

## The benchmark is the asset (sats), not dollars
- Vaults are **denominated in the underlying** (NAV, high-water mark, performance fee all in
  BTC/ETH/SOL/XRP units — verified in `SpotVault.sol`).
- "Ahead of holding" / "outperformance" means **more of the coin** (more sats for BTC), measured
  over a full cycle — *not* a USD return and *not* per-week.
- Always state the honest mechanism: the strategy steps to cash in downturns and rebuys lower to
  accumulate more of the asset. **It is drawdown insurance, not a guarantee** — in a straight-up
  rally it can end with *fewer* sats than holding (the cost of stepping aside). Say this.

## The honest one-liner (reuse verbatim where a value prop is needed)
> Aim to finish each cycle with more sats and shallower drawdowns than holding — by going to cash
> in downturns and rebuying lower. Drawdown insurance, not a guarantee: in straight-up rallies we
> may stack fewer sats than buy-and-hold.

## Live record vs backtest — never blend
- The live paper/track record (~weeks) is **one regime, too short to judge**. Show it as raw
  NAV-in-asset only — **no** capture ratios, Sortino, or "% time outperforming" on a <90-day window.
- The 6-year figures are an **out-of-sample backtest — hypothetical, not the return of a live
  deposit.** Label them so, and keep them on a separate surface (`/backtest`) from the live record.
- Don't present borrowed/external research numbers as ZENTORY's measured results.

## Net vs gross
- Show NAV **net of fees** as the headline; if a gross figure appears, give it equal prominence
  (SEC Marketing Rule 206(4)-1). State: "performance fee charged in BTC, only on new sats above the
  BTC high-water mark."

## Per-asset truth over blended headlines
- The edge is **risk-adjusted and drawdown-driven**, concentrated on high-drawdown assets. Prefer a
  truthful per-asset table over a blended "beats BTC" claim (which overstates the majors; XRP
  underperforms on return and wins on drawdown only).

## Seed-scale caveat (testnet)
- At the current ~1-BTC test seed, live SpotVault NAV is dominated by fixed swap costs from churning
  a tiny position — **not** strategy economics. Where the live NAV is shown, point to `/backtest`
  for the strategy's edge at scale. Don't let a cost-driven sub-1.0 NAV read as strategy failure.
