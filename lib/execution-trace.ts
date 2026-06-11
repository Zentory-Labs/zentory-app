import { createClient } from "@/utils/supabase/client";

function supabaseDisabled(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !url || !url.includes(".supabase.co");
}

export interface VaultTradingAccountRow {
  vault_address: string;
  hl_user_address: string;
  asset: string;
  notes: string | null;
  created_at: string;
}

export interface ExecutionAttemptRow {
  id: string;
  vault_address: string;
  tx_hash: string;
  chain_id: number;
  nonce: string | number | null;
  direction: number | null;
  size_raw: string | null;
  price_raw: string | null;
  expiry_ts: number | null;
  status: string;
  error: string | null;
  created_at: string;
}

export interface HlUserFillRow {
  id: number;
  vault_address: string;
  hl_user_address: string;
  source: string;
  fill_key: string;
  coin: string | null;
  px: string | null;
  sz: string | null;
  side: string | null;
  dir: string | null;
  fee: string | null;
  fee_token: string | null;
  closed_pnl: string | null;
  oid: string | null;
  tid: string | null;
  time_ms: number | null;
  hash: string | null;
  inserted_at: string;
}

export async function getVaultTradingAccounts(): Promise<VaultTradingAccountRow[]> {
  if (supabaseDisabled()) return [];
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from("vault_trading_accounts")
      .select("*")
      .order("vault_address", { ascending: true });
    if (error) return [];
    return (data as VaultTradingAccountRow[]) ?? [];
  } catch {
    return [];
  }
}

export async function getRecentExecutionAttempts(limit = 40): Promise<ExecutionAttemptRow[]> {
  if (supabaseDisabled()) return [];
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from("execution_attempts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return [];
    return (data as ExecutionAttemptRow[]) ?? [];
  } catch {
    return [];
  }
}

export async function getRecentHlUserFills(limit = 80): Promise<HlUserFillRow[]> {
  if (supabaseDisabled()) return [];
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from("hl_user_fills")
      .select("id,vault_address,hl_user_address,source,coin,px,sz,side,dir,fee,closed_pnl,time_ms,hash,inserted_at,fill_key")
      .order("time_ms", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) return [];
    // The table contains indexer plumbing-test rows recorded against the
    // placeholder HL user 0x…0001 with an all-zero tx hash. Real venue fills
    // always carry a hash; surfacing the placeholders under a "Live from
    // Hyperliquid" badge misrepresents them, so drop them for all callers.
    const ZERO_HASH = `0x${"0".repeat(64)}`;
    return ((data as HlUserFillRow[]) ?? []).filter(
      (r) => r.hash != null && r.hash !== ZERO_HASH
    );
  } catch {
    return [];
  }
}
