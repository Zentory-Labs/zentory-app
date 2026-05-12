export type Direction = "LONG" | "SHORT" | "CLOSE";
export type ResearchStatus = "pending" | "executed" | "failed";
export type ResearchContributor = "gp" | "lumibot" | "manual";
export type Asset = "BTC" | "ETH" | "XRP" | "SOL";

export interface Research {
  id: string;
  created_at?: string;
  timestamp?: number;
  provider: ResearchContributor;
  asset: Asset;
  direction: Direction;
  size: number;
  price: number;
  status: ResearchStatus;
  txHash?: string;
}

export interface ResearchInput {
  provider: ResearchContributor;
  asset: Asset;
  direction: Direction;
  size: number;
  price: number;
}

export async function getResearch(): Promise<Research[]> {
  const res = await fetch("/api/research", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch research");
  const data = await res.json();
  return data.map((s: Record<string, unknown>) => ({
    ...s,
    txHash: s.tx_hash as string | undefined,
    timestamp: s.created_at ? new Date(s.created_at as string).getTime() : 0,
  }));
}

/**
 * POST a research entry to Supabase via the protected /api/research/log route.
 * The KEEPER_API_KEY is injected by Vercel and never exposed to the browser.
 */
export async function logResearch(data: ResearchInput): Promise<Research> {
  const res = await fetch("/api/research/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? "Failed to log research");
  }
  return res.json();
}

/**
 * Execute a research entry on-chain via the keeper route.
 * KEEPER_PRIVATE_KEY is server-side only — this call goes through Next.js API.
 */
export async function executeResearch(
  research: Research & { researchId?: string }
): Promise<{ txHash: string; blockNumber?: number }> {
  const res = await fetch("/api/research/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      researchId: research.researchId ?? research.id,
      asset: research.asset,
      direction: research.direction,
      size: research.size,
      price: research.price,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Execution failed" }));
    throw new Error(err.error ?? "Execution failed");
  }
  return res.json();
}
