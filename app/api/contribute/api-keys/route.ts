import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
// Audit #21: `api_keys` is the authn root for this surface and is no longer
// anon-readable, and `signals` / `provider_stats` have no anon write policy.
// Audit #22 (Q16): keys have an `expires_at` column; expired keys are rejected
// even if `is_active` is still true. The route family runs on the service-role
// key; the x-api-key check below is the authorization gate.
import { createAdminClient } from "@/utils/supabase/admin";

// API key lifetime (unix seconds). 90 days, per audit Q16 recommendation.
// Centralized so the lifetime stays consistent across the create + read paths.
export const API_KEY_LIFETIME_SECONDS = 90 * 24 * 60 * 60;

function deriveProviderFromApiKey(apiKey: string, supabase: ReturnType<typeof createAdminClient>) {
  const keyHash = createHash("sha256").update(apiKey).digest("hex");
  return supabase
    .from("api_keys")
    .select("provider, is_active, expires_at")
    .eq("key_hash", keyHash)
    .single();
}

/**
 * Throws an Error object with a `.status` and `.body` if the key is invalid
 * (not found, inactive, or expired). Used by every handler in this file and
 * shared with the other contribute routes via `./_auth.ts`.
 */
function assertKeyUsable(keyData: { provider: string; is_active: boolean; expires_at: number } | null) {
  if (!keyData) {
    const err = new Error("Invalid API key") as Error & { status: number; body: Record<string, string> };
    err.status = 401;
    err.body = { error: "Invalid API key" };
    throw err;
  }
  if (!keyData.is_active) {
    const err = new Error("API key is inactive") as Error & { status: number; body: Record<string, string> };
    err.status = 403;
    err.body = { error: "API key is inactive" };
    throw err;
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof keyData.expires_at === "number" && keyData.expires_at <= now) {
    const err = new Error("API key expired") as Error & { status: number; body: Record<string, string> };
    err.status = 403;
    err.body = { error: "API key expired — please rotate" };
    throw err;
  }
  return keyData;
}

export async function GET(req: NextRequest) {
  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey || typeof apiKey !== "string" || apiKey.length !== 64) {
      return NextResponse.json({ error: "Missing or invalid x-api-key header" }, { status: 401 });
    }

    let supabase;
    try {
      supabase = createAdminClient();
    } catch {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const { data: keyData, error: keyError } = await deriveProviderFromApiKey(apiKey, supabase);
    if (keyError || !keyData) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }
    let provider: string;
    try {
      provider = assertKeyUsable(keyData).provider;
    } catch (e) {
      return NextResponse.json((e as { body?: Record<string, string> }).body ?? { error: "Invalid API key" }, { status: (e as { status?: number }).status ?? 401 });
    }

    const { data: keys, error: keysError } = await supabase
      .from("api_keys")
      .select("id, label, key_prefix, created_at, last_used_at, is_active, expires_at")
      .eq("provider", provider)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(50);

    if (keysError) {
      console.error("[GET /api/provider/api-keys]", keysError.message);
      return NextResponse.json({ error: "Failed to fetch API keys" }, { status: 500 });
    }

    const now = Math.floor(Date.now() / 1000);
    return NextResponse.json({
      keys: (keys ?? []).map((k) => ({
        id: k.id,
        label: k.label ?? "Unnamed",
        prefix: k.key_prefix,
        createdAt: k.created_at,
        lastUsedAt: k.last_used_at,
        isActive: k.is_active,
        expiresAt: k.expires_at,
        // Convenience flag — clients (and the API-keys page) want to colour
        // an "Expiring soon" pill without re-running the math.
        isExpired: typeof k.expires_at === "number" && k.expires_at <= now,
        expiresInDays: typeof k.expires_at === "number" ? Math.max(0, Math.floor((k.expires_at - now) / 86400)) : null,
      })),
    });
  } catch (err) {
    console.error("[GET /api/provider/api-keys]", err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey || typeof apiKey !== "string" || apiKey.length !== 64) {
      return NextResponse.json({ error: "Missing or invalid x-api-key header" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { label } = body as { label?: string };

    let supabase;
    try {
      supabase = createAdminClient();
    } catch {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const { data: keyData, error: keyError } = await deriveProviderFromApiKey(apiKey, supabase);
    if (keyError || !keyData) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }
    let provider: string;
    try {
      provider = assertKeyUsable(keyData).provider;
    } catch (e) {
      return NextResponse.json((e as { body?: Record<string, string> }).body ?? { error: "Invalid API key" }, { status: (e as { status?: number }).status ?? 401 });
    }

    const rawKey = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, "0")).join("");
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const keyPrefix = rawKey.slice(0, 8);
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + API_KEY_LIFETIME_SECONDS;

    const { data: insertData, error: insertError } = await supabase
      .from("api_keys")
      .insert({
        provider,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        label: label ?? "Unnamed",
        created_at: now,
        last_used_at: null,
        is_active: true,
        expires_at: expiresAt,
      })
      .select("id, expires_at")
      .single();

    if (insertError) {
      console.error("[POST /api/provider/api-keys]", insertError.message);
      return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
    }

    return NextResponse.json(
      {
        id: insertData.id,
        key: rawKey,
        prefix: keyPrefix,
        label: label ?? "Unnamed",
        expiresAt: insertData.expires_at,
        expiresInDays: Math.floor(API_KEY_LIFETIME_SECONDS / 86400),
        message: "Save this key now — it will not be shown again. Keys expire after 90 days.",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/provider/api-keys]", err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey || typeof apiKey !== "string" || apiKey.length !== 64) {
      return NextResponse.json({ error: "Missing or invalid x-api-key header" }, { status: 401 });
    }

    const body = await req.json();
    const { keyId } = body as { keyId?: number };

    if (!keyId || typeof keyId !== "number") {
      return NextResponse.json({ error: "keyId (number) is required" }, { status: 400 });
    }

    let supabase;
    try {
      supabase = createAdminClient();
    } catch {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const { data: keyData, error: keyError } = await deriveProviderFromApiKey(apiKey, supabase);
    if (keyError || !keyData) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }
    let provider: string;
    try {
      provider = assertKeyUsable(keyData).provider;
    } catch (e) {
      return NextResponse.json((e as { body?: Record<string, string> }).body ?? { error: "Invalid API key" }, { status: (e as { status?: number }).status ?? 401 });
    }

    const { error: deleteError } = await supabase
      .from("api_keys")
      .update({ is_active: false })
      .eq("id", keyId)
      .eq("provider", provider)
      .eq("is_active", true);

    if (deleteError) {
      console.error("[DELETE /api/provider/api-keys]", deleteError.message);
      return NextResponse.json({ error: "Failed to revoke API key" }, { status: 500 });
    }

    return NextResponse.json({ message: "API key revoked successfully" }, { status: 200 });
  } catch (err) {
    console.error("[DELETE /api/provider/api-keys]", err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
