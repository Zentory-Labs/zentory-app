import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
// Audit #21: `api_keys` is the authn root for this surface and is no longer
// anon-readable, and `signals` / `provider_stats` have no anon write policy.
// Audit #22 (Q16): keys have an `expires_at` column; expired keys are rejected
// even if `is_active` is still true. Every handler in /api/contribute/* runs
// the gate below.
import { createAdminClient } from "@/utils/supabase/admin";

/**
 * Shape returned by `deriveProviderFromApiKey` — the columns we SELECT so the
 * caller can both authorize and read the provider.
 */
export interface ApiKeyRow {
  id: number;
  provider: string;
  is_active: boolean;
  expires_at: number;
}

/**
 * Custom error thrown by `requireValidApiKey`. The route catch arm reads
 * `.status` and `.body` and returns the matching NextResponse.
 */
export class ApiKeyError extends Error {
  status: number;
  body: Record<string, string>;
  constructor(status: number, body: Record<string, string>) {
    super(body.error ?? "API key error");
    this.status = status;
    this.body = body;
  }
}

/**
 * Look up the API-key row by sha256(apiKey). Returns the row or throws.
 *
 * Order of checks (intentional):
 *   1. Missing/short x-api-key  -> 401 ("Missing or invalid")
 *   2. sha256 not in api_keys   -> 401 ("Invalid API key")
 *   3. is_active = false        -> 403 ("API key is inactive")
 *   4. expires_at <= now        -> 403 ("API key expired — please rotate")
 *
 * `expires_at` is the Q16 fix. We read it on every request so a key that was
 * active when issued but is now past its 90-day lifetime cannot submit research.
 */
export async function requireValidApiKey(req: NextRequest): Promise<ApiKeyRow> {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || typeof apiKey !== "string" || apiKey.length !== 64) {
    throw new ApiKeyError(401, { error: "Missing or invalid x-api-key header" });
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    throw new ApiKeyError(503, { error: "Supabase not configured" });
  }

  const keyHash = createHash("sha256").update(apiKey).digest("hex");
  const { data: keyData, error: keyError } = await supabase
    .from("api_keys")
    .select("id, provider, is_active, expires_at")
    .eq("key_hash", keyHash)
    .single();

  if (keyError || !keyData) {
    throw new ApiKeyError(401, { error: "Invalid API key" });
  }
  if (!keyData.is_active) {
    throw new ApiKeyError(403, { error: "API key is inactive" });
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof keyData.expires_at === "number" && keyData.expires_at <= now) {
    throw new ApiKeyError(403, { error: "API key expired — please rotate" });
  }
  return keyData as ApiKeyRow;
}

/**
 * Catch arm for `requireValidApiKey` — converts thrown errors to a
 * NextResponse. Returns null on success so callers can `if (!resp) return;`.
 */
export function apiKeyErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof ApiKeyError) {
    return NextResponse.json(err.body, { status: err.status });
  }
  return null;
}
