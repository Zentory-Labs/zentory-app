import Link from "next/link";

// ─── VaultTrustPanel ─────────────────────────────────────────────────────────
// The deposit-decision table stakes every serious vault product shows up
// front: fees, withdrawal mechanics, and security posture. Rendered on every
// vault page so a depositor never has to hunt for them.

const CARD = { background: "#1c1c21", border: "1px solid #2a2f3a" } as const;
const DIM = "rgba(106,111,117,0.9)";
const TEXT = { color: "#eaeaea" } as const;
const BODY = { color: "rgba(234,234,234,0.6)" } as const;
const LINK = { color: "#b08d57" } as const;

function PanelCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5" style={CARD}>
      <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "#b08d57" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export default function VaultTrustPanel({
  vaultAddress,
  founderSeeded = false,
}: {
  vaultAddress: string;
  founderSeeded?: boolean;
}) {
  const shortAddr = `${vaultAddress.slice(0, 6)}…${vaultAddress.slice(-4)}`;

  return (
    <div className="grid md:grid-cols-3 gap-4 mb-8">
      <PanelCard title="Fees">
        <div className="space-y-3 text-sm">
          {[
            ["Management", "0%"],
            ["Performance", "20% above high-water mark"],
            ["Entry / Exit", "0%"],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 border-b border-[#2a2f3a] pb-3">
              <span style={{ color: DIM }}>{label}</span>
              <span className="text-right" style={TEXT}>{value}</span>
            </div>
          ))}
          <p className="text-xs leading-relaxed" style={BODY}>
            Rebalance cost: paid by the vault at execution — see the{" "}
            <Link href="/backtest" className="underline" style={LINK}>
              cost-sensitivity table
            </Link>{" "}
            for how it erodes the edge.
          </p>
        </div>
      </PanelCard>

      <PanelCard title="Withdrawals">
        <div className="space-y-3 text-sm leading-relaxed" style={BODY}>
          <p>
            <span style={TEXT}>Instant ERC-4626 redeem</span> — no lockup, no cooldown.
          </p>
          <p>
            You receive the vault&apos;s current holdings mix: the underlying asset when{" "}
            <span style={TEXT}>LONG</span>, USDC-equivalent when <span style={TEXT}>FLAT</span>.
          </p>
          <p>Shares burn at current NAV.</p>
        </div>
      </PanelCard>

      <PanelCard title="Security">
        <div className="space-y-3 text-xs leading-relaxed" style={BODY}>
          <div className="flex justify-between gap-3 text-sm border-b border-[#2a2f3a] pb-3">
            <span style={{ color: DIM }}>Contract</span>
            <a
              href={`https://app.hyperliquid-testnet.xyz/explorer/address/${vaultAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              title={vaultAddress}
              className="underline"
              style={{ ...LINK, fontFamily: "'Space Mono', monospace", fontSize: 12 }}
            >
              {shortAddr} ↗
            </a>
          </div>
          <p>
            Internal reviews + 330-test suite; <span style={TEXT}>external audit scheduled — gates
            mainnet</span>. See the{" "}
            <Link href="/bug-bounty" className="underline" style={LINK}>
              bug bounty
            </Link>{" "}
            and{" "}
            <Link href="/risks" className="underline" style={LINK}>
              full risk disclosure
            </Link>
            .
          </p>
          <p>
            Managed by Zentory Labs — keeper-signed rebalances, bounded on-chain: the keeper can
            only rotate asset ⇄ USDC, it can <span style={TEXT}>never withdraw funds</span>.
            3-of-5 multisig migration is a hard mainnet gate.
          </p>
          {founderSeeded && (
            <p style={{ color: DIM }}>Depositors: founder-seeded (testnet).</p>
          )}
        </div>
      </PanelCard>
    </div>
  );
}
