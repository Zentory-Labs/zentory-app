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

// Audit finding #21: `insertResearch`, `updateResearchStatus` and
// `insertKeeperAudit` used to live here and wrote to `signals` / `keeper_audit`
// with the browser (publishable) key. That is exactly the hole the finding
// describes — anyone could forge rows on the public research feed and the
// "tamper-evident" keeper audit trail. Neither had a caller. They are gone:
// anon now has SELECT and only SELECT, and every write goes through an API
// route using utils/supabase/admin.ts (service role).
//
// If you need to write from the app, add a route under app/api/ — do not
// reintroduce a browser-side write here.

// ─── Keeper audit helpers (read-only) ──────────────────────────────────────────

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
