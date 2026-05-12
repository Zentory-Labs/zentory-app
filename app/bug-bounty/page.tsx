"use client";

const SEVERITY_TABLE = [
  { severity: "Critical", reward: "Up to $25,000 USDC", color: "red" as const },
  { severity: "High",     reward: "Up to $10,000 USDC", color: "orange" as const },
  { severity: "Medium",   reward: "Up to $3,000 USDC",  color: "amber" as const },
  { severity: "Low",     reward: "Up to $500 USDC",     color: "muted" as const },
];

const IN_SCOPE = [
  "ZENT.sol",
  "ZENTStaking.sol",
  "FeeDistributor.sol",
  "ProtocolTreasury.sol",
  "ZENTBuyback.sol",
  "SignalRegistry.sol",
  "EpochScoring.sol",
  "BaseVault.sol",
  "SubscriptionVault.sol",
];

const OUT_OF_SCOPE = [
  "Frontend bugs",
  "Social engineering attacks",
  "DDOS attacks",
  "Smart contract bugs in third-party dependencies",
];

const RULES = [
  "Submit via Immunefi (link below) — if not yet listed, email security@zentorylabs.com",
  "Allow 24 hours for initial response",
  "Do NOT disclose publicly until the vulnerability is patched",
  "Provide detailed reproduction steps with Proof of Concept code",
  "First Critical finding receives the full $25,000 reward",
  "Rewards are scaled based on likelihood and impact of the vulnerability",
];

type BadgeColor = "red" | "orange" | "amber" | "muted";

const BADGE_STYLE: Record<BadgeColor, { bg: string; text: string; border: string }> = {
  red:    { bg: "rgba(194,53,63,0.12)",   text: "#c2353f", border: "rgba(194,53,63,0.3)" },
  orange: { bg: "rgba(255,140,0,0.10)",   text: "#ff8c00", border: "rgba(255,140,0,0.25)" },
  amber:  { bg: "rgba(176,141,87,0.12)",  text: "#b08d57", border: "rgba(176,141,87,0.3)" },
  muted:  { bg: "rgba(42,47,58,0.4)",     text: "#6a6f75", border: "rgba(42,47,58,0.6)" },
};

function SeverityBadge({ color, children }: { color: BadgeColor; children: React.ReactNode }) {
  const s = BADGE_STYLE[color];
  return (
    <span
      className="px-2.5 py-0.5 rounded-full text-xs font-semibold border"
      style={{ background: s.bg, color: s.text, borderColor: s.border, fontFamily: "'Montserrat', sans-serif" }}
    >
      {children}
    </span>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}
    >
      <div
        className="text-xs font-semibold uppercase tracking-widest mb-5"
        style={{ color: "#b08d57", fontFamily: "'Montserrat', sans-serif" }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function ContractPill({ name }: { name: string }) {
  return (
    <span
      className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-mono font-medium border"
      style={{
        background: "rgba(42,47,58,0.3)",
        color: "#eaeaea",
        borderColor: "#2a2f3a",
        fontFamily: "'Montserrat', sans-serif",
      }}
    >
      {name}
    </span>
  );
}

export default function BugBountyPage() {
  return (
    <div className="w-full min-h-screen" style={{ background: "#0b0b0d" }}>
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-[#8b1e2d]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-3xl mx-auto px-6 py-20 space-y-8">

        {/* ── Page Header ── */}
        <div className="text-center mb-16">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold mb-5"
            style={{
              background: "rgba(139,30,45,0.08)",
              borderColor: "rgba(139,30,45,0.35)",
              color: "#c2353f",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "#c2353f", boxShadow: "0 0 8px #c2353f" }}
            />
            Immunefi Bug Bounty · Active
          </div>
          <h1
            className="text-4xl sm:text-5xl font-bold tracking-tight mb-4"
            style={{ color: "#eaeaea", fontFamily: "'Montserrat', sans-serif" }}
          >
            ZENTORY Labs Security
          </h1>
          <p
            className="text-base max-w-2xl mx-auto leading-relaxed"
            style={{ color: "rgba(234,234,234,0.5)", fontFamily: "'Montserrat', sans-serif" }}
          >
            Responsible disclosure for the ZENTORY Protocol. Help us keep users safe — report vulnerabilities through the channels below.
          </p>
        </div>

        {/* ── 1. Bug Bounty Program ── */}
        <SectionCard title="Bug Bounty Program">
          <div className="space-y-4">
            <p className="text-sm leading-relaxed" style={{ color: "rgba(234,234,234,0.6)", fontFamily: "'Montserrat', sans-serif" }}>
              ZENTORY Labs has launched a bug bounty program on Immunefi to reward security researchers who help identify vulnerabilities in our smart contracts. Rewards are paid in USDC and scaled by severity and impact.
            </p>
            <a
              href="https://immunefi.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold transition-all hover:scale-[1.02] rounded-xl px-5 py-3"
              style={{
                color: "#eaeaea",
                background: "rgba(139,30,45,0.15)",
                border: "1px solid rgba(139,30,45,0.4)",
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c2353f" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Submit on Immunefi
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="ml-1">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <p className="text-xs" style={{ color: "rgba(234,234,234,0.3)", fontFamily: "'Montserrat', sans-serif" }}>
              Or email:{" "}
              <span style={{ color: "#b08d57" }}>security@zentorylabs.com</span>
            </p>
          </div>
        </SectionCard>

        {/* ── 2. Severity & Rewards ── */}
        <SectionCard title="Severity & Rewards">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr style={{ borderBottom: "1px solid #2a2f3a" }}>
                  {["Severity", "Reward"].map((h) => (
                    <th
                      key={h}
                      className="pb-3 text-xs uppercase tracking-wider font-semibold"
                      style={{ color: "#6a6f75", fontFamily: "'Montserrat', sans-serif" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SEVERITY_TABLE.map((row) => (
                  <tr key={row.severity} style={{ borderBottom: "1px solid rgba(42,47,58,0.5)" }}>
                    <td className="py-4">
                      <SeverityBadge color={row.color}>{row.severity}</SeverityBadge>
                    </td>
                    <td className="py-4">
                      <span
                        className="text-sm font-bold font-mono"
                        style={{ color: "#b08d57", fontFamily: "'Montserrat', sans-serif" }}
                      >
                        {row.reward}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            className="mt-4 p-4 rounded-xl border"
            style={{ background: "rgba(176,141,87,0.07)", borderColor: "rgba(176,141,87,0.25)" }}
          >
            <div className="flex items-start gap-3">
              <svg width="14" height="14" className="flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="#b08d57" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(234,234,234,0.5)", fontFamily: "'Montserrat', sans-serif" }}>
                First Critical finding receives the full <strong style={{ color: "#b08d57" }}>$25,000</strong>. Rewards are scaled based on likelihood and impact. Most projects start at the lower end of the range.
              </p>
            </div>
          </div>
        </SectionCard>

        {/* ── 3. In-Scope Contracts ── */}
        <SectionCard title="In-Scope Contracts">
          <div className="space-y-3">
            <p className="text-xs" style={{ color: "rgba(234,234,234,0.4)", fontFamily: "'Montserrat', sans-serif" }}>
              Only vulnerabilities in these contracts are eligible for rewards:
            </p>
            <div className="flex flex-wrap gap-2">
              {IN_SCOPE.map((c) => (
                <ContractPill key={c} name={c} />
              ))}
            </div>
            <div
              className="mt-4 pt-4 flex items-center gap-2"
              style={{ borderTop: "1px solid #2a2f3a" }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#6a6f75" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs" style={{ color: "rgba(234,234,234,0.3)", fontFamily: "'Montserrat', sans-serif" }}>
                Source:{" "}
                <span style={{ color: "#b08d57" }}>github.com/edgeza/ZentoryToken/blob/main/contracts/src/</span>
                {" "}· Chain: HyperEVM
              </span>
            </div>
          </div>
        </SectionCard>

        {/* ── 4. Out of Scope ── */}
        <SectionCard title="Out of Scope">
          <ul className="space-y-3">
            {OUT_OF_SCOPE.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <svg width="14" height="14" className="flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="#6a6f75" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                </svg>
                <span className="text-sm" style={{ color: "rgba(234,234,234,0.5)", fontFamily: "'Montserrat', sans-serif" }}>
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* ── 5. Disclosure Rules ── */}
        <SectionCard title="Disclosure Rules">
          <ol className="space-y-4">
            {RULES.map((rule, i) => (
              <li key={i} className="flex items-start gap-4">
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center"
                  style={{
                    background: "rgba(139,30,45,0.15)",
                    color: "#c2353f",
                    border: "1px solid rgba(139,30,45,0.3)",
                    fontFamily: "'Montserrat', sans-serif",
                  }}
                >
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed pt-0.5" style={{ color: "rgba(234,234,234,0.6)", fontFamily: "'Montserrat', sans-serif" }}>
                  {rule}
                </span>
              </li>
            ))}
          </ol>
        </SectionCard>

        {/* ── 6. Safe Harbor ── */}
        <SectionCard title="Safe Harbor">
          <div
            className="rounded-xl p-5 border"
            style={{ background: "rgba(39,174,96,0.07)", borderColor: "rgba(39,174,96,0.25)" }}
          >
            <div className="flex items-start gap-3">
              <svg width="18" height="18" className="flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="#27ae60" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: "#27ae60", fontFamily: "'Montserrat', sans-serif" }}>
                  Safe Harbor Commitment
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(234,234,234,0.55)", fontFamily: "'Montserrat', sans-serif" }}>
                  ZENTORY Labs commits to not pursuing legal action against researchers who act in good faith under this program. We aim to triage reports within 24 hours, assess severity within 7 days, and deploy fixes within 30 days for critical vulnerabilities.
                </p>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ── Submit CTA ── */}
        <div className="text-center pt-4">
          <a
            href="https://immunefi.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 text-sm font-bold transition-all hover:scale-[1.02] rounded-2xl px-8 py-4"
            style={{
              color: "#eaeaea",
              background: "linear-gradient(135deg, #8b1e2d 0%, #c2353f 100%)",
              boxShadow: "0 0 40px rgba(139,30,45,0.35)",
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Submit a Vulnerability on Immunefi
          </a>
          <p className="mt-3 text-xs" style={{ color: "rgba(234,234,234,0.25)", fontFamily: "'Montserrat', sans-serif" }}>
            Confidential — do NOT discuss vulnerabilities publicly until patched
          </p>
        </div>

      </div>
    </div>
  );
}
