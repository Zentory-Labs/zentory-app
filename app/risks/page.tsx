import type { Metadata } from "next";
import Link from "next/link";

// ─── /risks ──────────────────────────────────────────────────────────────────
// Honest risk documentation for the vaults. Plain language, no marketing —
// the things a depositor should weigh BEFORE depositing. Every serious vault
// product publishes this; ours also names the scenario where we lose.

export const metadata: Metadata = {
  title: "Risks",
  description:
    "What can go wrong with ZENTORY vaults: strategy whipsaw, stablecoin depeg, keeper and oracle failure, smart-contract risk, and current testnet status — in plain language.",
};

function RiskCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
      <div
        className="text-xs font-semibold uppercase tracking-widest mb-4"
        style={{ color: "#b08d57", fontFamily: "'Montserrat', sans-serif" }}
      >
        {title}
      </div>
      <div
        className="space-y-3 text-sm leading-relaxed"
        style={{ color: "rgba(234,234,234,0.6)", fontFamily: "'Montserrat', sans-serif" }}
      >
        {children}
      </div>
    </div>
  );
}

const STRONG = { color: "#eaeaea" } as const;
const LINK = { color: "#b08d57" } as const;

export default function RisksPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      <header className="space-y-3 mb-10">
        <h1 className="text-4xl font-bold tracking-tight" style={{ color: "#eaeaea" }}>
          Risks
        </h1>
        <p className="text-sm max-w-2xl leading-relaxed" style={{ color: "rgba(234,234,234,0.5)" }}>
          If you are considering a deposit, read this first. These are the ways the vaults
          can lose money or get stuck — in plain language, including the scenarios where the
          strategy is simply worse than doing nothing.
        </p>
      </header>

      <RiskCard title="Strategy risk — whipsaw and chop">
        <p>
          The strategy is trend-following: long when the trend is up, flat when it turns down.
          Trend strategies <strong style={STRONG}>lose in sideways markets</strong>. In chop, the
          vault buys after small rallies and sells after small dips — paying rebalance costs each
          time — and can end up well behind simply holding the asset. This is not a tail risk;
          it is the normal failure mode of this strategy family.
        </p>
        <p>
          The{" "}
          <Link href="/backtest" className="underline" style={LINK}>
            6-year walk-forward backtest
          </Link>{" "}
          discloses this honestly: out-of-sample,{" "}
          <strong style={STRONG}>XRP underperformed holding on return</strong> and won only on
          drawdown. There is no leverage and no shorting, so in a straight parabolic bull run,
          holding can also win on return.
        </p>
      </RiskCard>

      <RiskCard title="Stablecoin risk — USDC depeg while FLAT">
        <p>
          When the vault is FLAT it holds USDC (or its testnet equivalent), not the underlying
          asset. &ldquo;Cash&rdquo; is not risk-free: if{" "}
          <strong style={STRONG}>USDC depegs while the vault is flat</strong>, the vault&apos;s NAV
          takes that loss directly, and the drawdown protection the vault exists for is undermined
          by the very asset it shelters in.
        </p>
      </RiskCard>

      <RiskCard title="Operational risk — keeper and oracle">
        <p>
          Rebalances are keeper-signed. If the <strong style={STRONG}>keeper fails</strong>, no
          rebalance happens and the vault stays in its last posture: LONG stays long through a
          crash, FLAT stays flat through a rally, until the keeper is restored. The keeper is
          bounded on-chain — it can only rotate between the asset and USDC, never withdraw funds —
          but its absence still means the strategy stops reacting.
        </p>
        <p>
          NAV is marked to a <strong style={STRONG}>price oracle</strong>. If the feed goes stale
          or fails, deposits and redemptions revert until it updates — funds are not lost, but you
          cannot enter or exit at a stale price, and a wrong price would mis-mark NAV for anyone
          transacting while it lasts.
        </p>
      </RiskCard>

      <RiskCard title="Smart-contract risk">
        <p>
          The contracts have completed <strong style={STRONG}>internal reviews and a 330-test
          suite</strong>. An <strong style={STRONG}>external audit has not happened yet</strong> —
          it is pending and is a hard gate for mainnet. Until then, treat the code as unaudited:
          ERC-4626 vaults, fee logic, and rebalance paths can contain bugs that lose funds.
        </p>
        <p>
          Found something?{" "}
          <Link href="/bug-bounty" className="underline" style={LINK}>
            Report it through the bug bounty
          </Link>
          .
        </p>
      </RiskCard>

      <RiskCard title="Testnet status">
        <p>
          Everything live today runs on <strong style={STRONG}>HyperEVM testnet</strong>. All
          deposit assets are <strong style={STRONG}>valueless mock tokens</strong> — nothing you
          deposit or withdraw here is real money. The vaults exist to prove the mechanics
          (deposit → rebalance → NAV → redeem) end-to-end, not to demonstrate real-capital
          performance.
        </p>
      </RiskCard>

      <p className="text-xs pt-2" style={{ color: "rgba(234,234,234,0.35)" }}>
        Questions about any of this:{" "}
        <a href="mailto:info@zentorylabs.com" className="underline" style={LINK}>
          info@zentorylabs.com
        </a>
        . Nothing on this page is financial advice.
      </p>
    </div>
  );
}
