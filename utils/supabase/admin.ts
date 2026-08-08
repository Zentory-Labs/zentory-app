import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. SERVER ONLY — never import this from a
 * "use client" module or anything that ends up in the browser bundle.
 *
 * Audit finding #21 fix. Every RLS policy used to be `using (true)` with no
 * TO clause, which meant the publishable key shipped in the browser bundle
 * could INSERT/UPDATE `signals`, `provider_stats`, `keeper_audit` and friends.
 * supabase/schema.sql now grants anon SELECT only, and creates no write policy
 * for anyone — so every write has to run with the service-role key, which
 * bypasses RLS. That key exists only in the server environment.
 *
 * Rules of thumb:
 *   - Public reads of public tables  -> utils/supabase/server.ts (anon key)
 *   - Anything that writes           -> this client
 *   - Reads of private tables
 *     (api_keys, whitelist, profiles, subscriptions) -> this client
 *
 * The caller is responsible for authn/authz. RLS is not a backstop here.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing Supabase service-role configuration. Set NEXT_PUBLIC_SUPABASE_URL " +
        "and SUPABASE_SERVICE_ROLE_KEY in the server environment. " +
        "SUPABASE_SERVICE_ROLE_KEY must never be prefixed with NEXT_PUBLIC_.",
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-zentory-client": "server-admin" } },
  });
}
