import { createClient } from "@/utils/supabase/client";

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
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vault_trading_accounts")
    .select("*")
    .order("vault_address", { ascending: true });

  if (error) {
    console.error("[execution-trace] vault_trading_accounts:", error.message);
    return [];
  }
  return (data as VaultTradingAccountRow[]) ?? [];
}

export async function getRecentExecutionAttempts(limit = 40): Promise<ExecutionAttemptRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("execution_attempts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[execution-trace] execution_attempts:", error.message);
    return [];
  }
  return (data as ExecutionAttemptRow[]) ?? [];
}

export async function getRecentHlUserFills(limit = 80): Promise<HlUserFillRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hl_user_fills")
    .select("id,vault_address,hl_user_address,source,coin,px,sz,side,dir,fee,closed_pnl,time_ms,hash,inserted_at,fill_key")
    .order("time_ms", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error("[execution-trace] hl_user_fills:", error.message);
    return [];
  }
  return (data as HlUserFillRow[]) ?? [];
}
