"use client";

import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { GOVERNOR_ABI, addresses } from "@/lib/contracts";
import { useState, useEffect } from "react";
import { useDemoMode, DemoBadge } from "@/lib/demo/context";
import { demoProposals } from "@/lib/demo/data";

const PROPOSAL_STATES = ["pending", "active", "canceled", "defeated", "succeeded", "queued", "expired", "executed"];

function shorten(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function timeRemaining(deadline: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = Number(deadline) - now;
  if (diff <= 0) return "Ended";
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h left`;
  return `${h}h ${m}m left`;
}

function StateBadge({ state }: { state: number }) {
  const labels = ["Pending", "Active", "Canceled", "Defeated", "Succeeded", "Queued", "Expired", "Executed"];
  const colors = [
    "bg-white/[0.06] text-white/60 border border-white/10",
    "bg-[rgba(139,30,45,0.15)] text-[#c2353f] border border-[rgba(139,30,45,0.3)]",
    "bg-white/[0.04] text-white/40 border border-white/10",
    "bg-red-500/10 text-red-400 border border-red-500/20",
    "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    "bg-[rgba(176,141,87,0.12)] text-[#b08d57] border border-[rgba(176,141,87,0.25)]",
    "bg-white/[0.04] text-white/30 border border-white/10",
    "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20",
  ];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${colors[state] ?? colors[0]}`}>
      {labels[state] ?? "Unknown"}
    </span>
  );
}

interface ProposalInfo {
  id: number;
  state: number;
  deadline: bigint;
  snapshot: bigint;
  forVotes: bigint;
  againstVotes: bigint;
  description: string;
}

function ProposalCard({ proposal, onVote }: {
  proposal: ProposalInfo;
  onVote: (id: number, support: 0 | 1) => void;
}) {
  const [isPending, setIsPending] = useState(false);
  const total = proposal.forVotes + proposal.againstVotes;
  const forPct = total > 0n ? Math.round(Number(proposal.forVotes * 10000n / total)) / 100 : 0;
  const againstPct = total > 0n ? Math.round(Number(proposal.againstVotes * 10000n / total)) / 100 : 0;

  return (
    <div className="rounded-2xl border border-white/[0.1] bg-black/60 backdrop-blur-xl p-5 glass-hover">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-xs text-white/40 mb-1">Proposal #{proposal.id}</div>
          <h3 className="text-white font-semibold text-base leading-tight">{proposal.description.split("\n")[0]}</h3>
        </div>
        <StateBadge state={proposal.state} />
      </div>

      {proposal.state === 1 && (
        <div className="mb-4 space-y-1">
          <div className="flex justify-between text-xs text-white/40 mb-1">
            <span>For: {forPct}%</span>
            <span>Against: {againstPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-red-900/60 overflow-hidden flex">
            <div className="bg-emerald-500 transition-all" style={{ width: `${forPct}%` }} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-white/40">
          {proposal.state === 1 ? timeRemaining(proposal.deadline) : `State: ${PROPOSAL_STATES[proposal.state]}`}
        </span>
        {proposal.state === 1 && (
          <div className="flex gap-2">
            <button
              disabled={isPending}
              onClick={() => onVote(proposal.id, 1)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 transition-colors border"
              style={{
                background: "rgba(139, 30, 45, 0.15)",
                color: "#c2353f",
                borderColor: "rgba(139, 30, 45, 0.3)",
              }}
            >
              {isPending ? "…" : "Vote For"}
            </button>
            <button
              disabled={isPending}
              onClick={() => onVote(proposal.id, 0)}
              className="rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 text-xs font-semibold disabled:opacity-50 transition-colors"
            >
              {isPending ? "…" : "Vote Against"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GovernPage() {
  const { address, isConnected } = useAccount();

  const votingDelay = useReadContract({
    address: addresses.ZentGovernor,
    abi: GOVERNOR_ABI,
    functionName: "votingDelay",
  } as any);

  const votingPeriod = useReadContract({
    address: addresses.ZentGovernor,
    abi: GOVERNOR_ABI,
    functionName: "votingPeriod",
  } as any);

  const quorum = useReadContract({
    address: addresses.ZentGovernor,
    abi: GOVERNOR_ABI,
    functionName: "quorum",
    args: [1n],
  } as any);

  const { writeContract } = useWriteContract();
  const { enabled: demoMode } = useDemoMode();
  const [proposals, setProposals] = useState<ProposalInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadProposals() {
      if (demoMode) {
        // Map demo proposals into the ProposalInfo shape ProposalCard renders.
        const samples = demoProposals();
        const STATE_TO_NUM: Record<string, number> = {
          pending: 0, active: 1, canceled: 2, defeated: 3,
          succeeded: 4, queued: 5, expired: 6, executed: 7,
        };
        setProposals(samples.map((p) => ({
          id: p.id,
          state: STATE_TO_NUM[p.status] ?? 1,
          deadline: BigInt(Math.floor(p.endsAt / 1000)),
          snapshot: BigInt(Math.floor((p.endsAt - 7 * 24 * 60 * 60 * 1000) / 1000)),
          forVotes: BigInt(p.forVotes) * 10n ** 18n,
          againstVotes: BigInt(p.againstVotes) * 10n ** 18n,
          description: `#${p.id} · ${p.title} — by ${p.proposer}\n\n${p.summary}`,
        })));
        setLoading(false);
        return;
      }
      // No proposals yet — Governor has no proposalCount() so we just show empty state
      setProposals([]);
      setLoading(false);
    }
    loadProposals();
  }, [demoMode]);

  function handleVote(proposalId: number, support: 0 | 1) {
    try {
      writeContract({
        address: addresses.ZentGovernor,
        abi: GOVERNOR_ABI,
        functionName: "castVote",
        args: [BigInt(proposalId), support],
      } as any);
    } catch (err: any) {
      console.error("Vote failed:", err.message);
    }
  }

  return (
    <div className="min-h-screen relative">
      <header className="border-b sticky top-0 z-10" style={{ background: "rgba(20, 20, 23, 0.9)", backdropFilter: "blur(20px)", borderColor: "#2a2f3a" }}>
        <div className="mx-auto max-w-7xl px-6 py-4">
          <h1 className="text-3xl font-bold tracking-tight inline-flex items-center gap-3" style={{ fontFamily: "'Montserrat', sans-serif" }}><span className="gradient-text-gold">Governance</span>{demoMode && <DemoBadge />}</h1>
          <p className="text-xs text-white/40 mt-0.5">Vote on protocol upgrades, risk parameters, and treasury allocations</p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10 space-y-8">
        {/* Governor Info */}
        <div>
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold mb-3"
            style={{ background: "rgba(176,141,87,0.12)", borderColor: "rgba(176,141,87,0.3)", color: "#b08d57" }}
          >
            Testnet placeholder parameters
          </div>
          <p className="text-xs text-white/40 mb-4 max-w-2xl">
            Quorum and proposal threshold are deliberately set to zero on testnet so governance
            flows can be exercised end-to-end. Mainnet values are set together with the external audit.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Voting Period", value: votingPeriod.data !== undefined ? `${Math.round(Number(votingPeriod.data as bigint) / 3600)}h` : "—" },
              { label: "Quorum Required", value: quorum.data !== undefined ? `${(Number(quorum.data as bigint) / 1e18 / 1e6).toFixed(0)}M ZENT` : "—" },
              { label: "Min. veZENT to Propose", value: "Anyone (threshold = 0)" },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-2xl border border-white/[0.1] bg-black/60 backdrop-blur-xl p-5 glass-hover">
                <div className="text-xs text-white/40 uppercase tracking-wider">{label}</div>
                <div className="font-mono font-semibold text-white">{value}</div>
                <div className="text-[10px] mt-1" style={{ color: "rgba(176,141,87,0.8)" }}>Testnet placeholder</div>
              </div>
            ))}
          </div>
        </div>

        {/* Who controls the protocol today */}
        <div className="rounded-2xl p-6" style={{ background: "#1c1c21", border: "1px solid #2a2f3a" }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "#b08d57", fontFamily: "'Montserrat', sans-serif" }}>
            Who controls the protocol today
          </h2>
          <ul className="space-y-2 text-sm" style={{ color: "rgba(234,234,234,0.6)" }}>
            <li>
              · Protocol parameters are currently controlled by the team deployer key, behind a{" "}
              <strong className="text-white/80">48-hour timelock</strong> — every change is publicly visible on-chain before it executes.
            </li>
            <li>
              · Migration to a <strong className="text-white/80">3-of-5 Gnosis Safe</strong> is a hard gate for mainnet launch.
            </li>
            <li>
              · The keeper can only rotate vault exposure between the vault&rsquo;s asset and USDC —{" "}
              <strong className="text-white/80">it can never withdraw user funds</strong>.
            </li>
          </ul>
        </div>

        {/* Proposals */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Recent Proposals</h2>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : proposals.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.1] bg-black/60 backdrop-blur-xl p-12 text-center">
              <p className="text-white/40 text-sm">No proposals yet. Be the first to propose a protocol upgrade.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {proposals.map((p) => (
                <ProposalCard key={p.id} proposal={p} onVote={handleVote} />
              ))}
            </div>
          )}
        </div>

        {/* Links */}
        <div className="text-center space-y-2">
          <a
            href={`https://app.hyperliquid-testnet.xyz/explorer/address/${addresses.ZentGovernor}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs hover:underline transition-colors"
            style={{ color: "#b08d57" }}
          >
            View ZentGovernor on Hyperliquid Explorer →
          </a>
          <a
            href={`https://app.hyperliquid-testnet.xyz/explorer/address/${addresses.Timelock}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs hover:underline transition-colors"
            style={{ color: "#b08d57" }}
          >
            View Timelock on Hyperliquid Explorer →
          </a>
        </div>
      </main>
    </div>
  );
}
