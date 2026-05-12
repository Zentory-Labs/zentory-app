import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createClient } from "@/utils/supabase/server";

function deriveProviderFromApiKey(apiKey: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const keyHash = createHash("sha256").update(apiKey).digest("hex");
  return supabase
    .from("api_keys")
    .select("provider, is_active")
    .eq("key_hash", keyHash)
    .single();
}

export async function GET(req: NextRequest) {
  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey || typeof apiKey !== "string" || apiKey.length !== 64) {
      return NextResponse.json({ error: "Missing or invalid x-api-key header" }, { status: 401 });
    }

    let supabase;
    try {
      supabase = await createClient();
    } catch {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const { data: keyData, error: keyError } = await deriveProviderFromApiKey(apiKey, supabase);
    if (keyError || !keyData) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }
    if (!keyData.is_active) {
      return NextResponse.json({ error: "API key is inactive" }, { status: 403 });
    }
    const provider = keyData.provider as string;

    const { data: keys, error: keysError } = await supabase
      .from("api_keys")
      .select("id, label, key_prefix, created_at, last_used_at, is_active")
      .eq("provider", provider)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(50);

    if (keysError) {
      console.error("[GET /api/provider/api-keys]", keysError.message);
      return NextResponse.json({ error: "Failed to fetch API keys" }, { status: 500 });
    }

    return NextResponse.json({
      keys: (keys ?? []).map((k) => ({
        id: k.id,
        label: k.label ?? "Unnamed",
        prefix: k.key_prefix,
        createdAt: k.created_at,
        lastUsedAt: k.last_used_at,
        isActive: k.is_active,
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
      supabase = await createClient();
    } catch {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const { data: keyData, error: keyError } = await deriveProviderFromApiKey(apiKey, supabase);
    if (keyError || !keyData) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }
    if (!keyData.is_active) {
      return NextResponse.json({ error: "API key is inactive" }, { status: 403 });
    }
    const provider = keyData.provider as string;

    const rawKey = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, "0")).join("");
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const keyPrefix = rawKey.slice(0, 8);
    const now = Math.floor(Date.now() / 1000);

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
      })
      .select("id")
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
        message: "Save this key now — it will not be shown again",
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
      supabase = await createClient();
    } catch {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const { data: keyData, error: keyError } = await deriveProviderFromApiKey(apiKey, supabase);
    if (keyError || !keyData) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }
    if (!keyData.is_active) {
      return NextResponse.json({ error: "API key is inactive" }, { status: 403 });
    }
    const provider = keyData.provider as string;

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

    return NextResponse.json({ message: "API key revoked successfully" }, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/provider/api-keys]", err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
