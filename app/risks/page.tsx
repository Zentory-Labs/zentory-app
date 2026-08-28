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
        style={{ color: "#b08d57", fontFamily: "var(--font-montserrat), sans-serif" }}
      >
        {title}
      </div>
      <div
        className="space-y-3 text-sm leading-relaxed"
        style={{ color: "#bfc3c7", fontFamily: "var(--font-montserrat), sans-serif" }}
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
        <p className="text-sm max-w-2xl leading-relaxed" style={{ color: "#bfc3c7" }}>
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
          discloses this honestly: across every possible entry day, a deposit made into a{" "}
          <strong style={STRONG}>dip right before a rally usually lags simply holding</strong> until
          the trend re-establishes. Over a full cycle BTC, ETH and SOL beat holding and XRP roughly
          matches it — all four win on drawdown — but there is no leverage and no shorting, so in a
          straight parabolic run, holding can win on return.
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

      <RiskCard title="Counterparty risk">
        <p>
          The vault does not lend, does not take leverage, and does not use a{" "}
          <strong style={STRONG}>centralised custodian</strong> — your deposit sits in the
          non-custodial ERC-4626 vault contract and you hold the redeemable share token. The only
          off-chain counterparties are: the keeper (which only signs rebalances, never moves user
          funds), the price oracle (which is a separate contract that the vault reads but cannot
          instruct), and the timelock governance contract (which gates admin parameter changes
          behind a 48-hour delay). Each of these is enumerable on-chain and individually
          accountable.
        </p>
        <p>
          Bridged assets carry the usual cross-chain risk: if the underlying asset is a wrapped
          version of a foreign token, the wrapping bridge is itself a counterparty. The
          testnet-mock assets in use today do not carry that risk because they are plain
          ERC-20s minted by the deployer for the testnet.
        </p>
      </RiskCard>

      <RiskCard title="Key-person risk">
        <p>
          Today the testnet admin key is held by a small team in a single-EOA configuration.{" "}
          <strong style={STRONG}>A 3-of-5 Gnosis Safe migration</strong> is a hard gate for
          mainnet — until that lands, a single lost key takes the protocol down on testnet.
          Operational continuity runs through documented runbooks (Railway cron health,
          Railway deploy history, and the founding signer set on the dApp&apos;s /team page).
        </p>
        <p>
          The strategy itself is parameter-free — the deployed ensemble averages votes over the
          whole trend+vol-gate family with no spec selected, so losing any single quant does not
          take the strategy with them. On the contributor side, EpochScoring scores provider
          accuracy per epoch so a single bad actor is slashed rather than poisoning the
          leaderboard.
        </p>
      </RiskCard>

      <RiskCard title="Regulatory risk">
        <p>
          ZENT is a <strong style={STRONG}>utility token</strong> for protocol governance
          (veZENT voting), research subscriptions (SubscriptionVault), and buyback routing
          (FeeDistributor). It is not marketed as a security, and the protocol does not promise
          yield or profit. The vaults themselves are non-custodial smart contracts; the dApp is
          geo-blocked from restricted jurisdictions at the proxy layer and an investor gating
          popup protects the marketing site too.
        </p>
        <p>
          That said, regulatory classification can change in any jurisdiction we serve. A future
          rule change in your country could force us to geo-block you or delist features. You
          are responsible for understanding the rules where you live; we are responsible for
          honest disclosure, not legal advice.
        </p>
        <p>
          For the full terms that govern using the dApp see the{" "}
          <Link
            href="https://zentorylabs.com/terms-of-service"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            style={LINK}
          >
            Terms of Service
          </Link>{" "}
          and the marketing-site{" "}
          <Link
            href="https://zentorylabs.com/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            style={LINK}
          >
            Privacy Policy
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

      <p className="text-xs pt-2" style={{ color: "#6a6f75" }}>
        Questions about any of this:{" "}
        <a href="mailto:info@zentorylabs.com" className="underline" style={LINK}>
          info@zentorylabs.com
        </a>
        . Nothing on this page is financial advice.
      </p>
    </div>
  );
}
