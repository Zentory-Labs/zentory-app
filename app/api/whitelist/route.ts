import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rateLimit";

/**
 * POST /api/whitelist — waitlist signup.
 *
 * Audit findings #21 / #41. This used to be a direct browser INSERT with the
 * publishable key, backed by `whitelist_insert_public ... with check (true)`
 * and — far worse — `whitelist_read_admin ... for select using (true)`, which
 * let anyone holding the key (i.e. anyone who loaded the site) dump every
 * email ever collected. The table now has no anon policy at all; signups come
 * through here and are written with the service-role key.
 *
 * The response deliberately carries no row data: there is no reason for the
 * browser to learn anything about the stored record, and echoing it back would
 * turn this endpoint into an email-existence oracle.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  // Per-IP cap: this is an unauthenticated write endpoint.
  const { ok } = await rateLimit(`whitelist:ip:${clientIp(req)}`, 5, 60);
  if (!ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "retry-after": "60" } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { email, source } = (body ?? {}) as { email?: unknown; source?: unknown };

  if (typeof email !== "string" || email.length > 320 || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedSource =
    typeof source === "string" && /^[a-z0-9_-]{1,32}$/i.test(source) ? source : "website";

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (err) {
    console.error("[POST /api/whitelist] Supabase not configured:", String(err));
    return NextResponse.json({ error: "Signup is temporarily unavailable" }, { status: 503 });
  }

  const { error } = await supabase
    .from("whitelist")
    .upsert({ email: normalizedEmail, source: normalizedSource }, { onConflict: "email" });

  if (error) {
    console.error("[POST /api/whitelist]", error.message);
    return NextResponse.json({ error: "Failed to join the waitlist" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
