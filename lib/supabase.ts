import { createClient } from "@/utils/supabase/client";
import type { Asset, Direction, ResearchContributor } from "@/lib/research";

// ─── Database types ─────────────────────────────────────────────────────────────

export interface DbResearch {
  id: string;
  created_at: string;
  provider: ResearchContributor;
  asset: Asset;
  direction: Direction;
  size: number;
  price: number;
  status: "pending" | "executed" | "failed";
  tx_hash: string | null;
  executed_by: string | null;
  executor_address: string | null;
}

export interface DbKeeperAudit {
  id: string;
  signal_id: string | null;
  tx_hash: string;
  gas_used: number | null;
  executor_address: string | null;
  block_number: number | null;
  created_at: string;
}

// ─── Research helpers (browser/client-side) ──────────────────────────────────────

/** Fetch research from Supabase */
export async function getResearch(limit = 100) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("signals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[supabase] getResearch:", error.message);
    return [];
  }
  return (data as DbResearch[]) ?? [];
}

/** Insert a new research entry */
export async function insertResearch(
  research: Omit<DbResearch, "id" | "created_at">
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("signals")
    .insert(research)
    .select()
    .single();
  if (error) {
    console.error("[supabase] insertResearch:", error.message);
    return null;
  }
  return data as DbResearch;
}

/** Update research status after execution */
export async function updateResearchStatus(
  id: string,
  status: "pending" | "executed" | "failed",
  txHash?: string,
  executedBy?: string,
  executorAddress?: string
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("signals")
    .update({
      status,
      tx_hash: txHash ?? null,
      executed_by: executedBy ?? null,
      executor_address: executorAddress ?? null,
    })
    .eq("id", id);
  if (error) console.error("[supabase] updateResearchStatus:", error.message);
}

// ─── Keeper audit helpers ──────────────────────────────────────────────────────

export async function insertKeeperAudit(
  entry: Omit<DbKeeperAudit, "id" | "created_at">
) {
  const supabase = createClient();
  const { error } = await supabase.from("keeper_audit").insert(entry);
  if (error) console.error("[supabase] insertKeeperAudit:", error.message);
}

export async function getKeeperAudit(limit = 50) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("keeper_audit")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[supabase] getKeeperAudit:", error.message);
    return [];
  }
  return (data as DbKeeperAudit[]) ?? [];
}
