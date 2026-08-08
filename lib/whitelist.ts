// Waitlist signup — browser side.
//
// Audit findings #21 / #41: this used to INSERT straight into Supabase with
// the publishable key, and the table also carried a `for select using (true)`
// policy, so anyone who loaded the site could dump every collected email. The
// `whitelist` table now has no anon policy at all; signups go through
// POST /api/whitelist, which writes with the service-role key.
//
// There is deliberately no client-side "is this email already on the list?"
// helper any more — that read would be an email-existence oracle, and nothing
// in the app used it.

export interface WhitelistSignupResult {
  ok: boolean;
  /** Human-readable reason when `ok` is false. */
  error?: string;
}

/** Submit an email to the waitlist. Resolves to `{ ok: false }` on failure. */
export async function insertWhitelistEmail(
  email: string,
  source = "website",
): Promise<WhitelistSignupResult> {
  try {
    const res = await fetch("/api/whitelist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, source }),
    });

    if (res.ok) return { ok: true };

    const detail = (await res.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, error: detail?.error ?? `Request failed (${res.status})` };
  } catch (err) {
    console.error("[whitelist] insertWhitelistEmail:", err);
    return { ok: false, error: "Network error" };
  }
}
