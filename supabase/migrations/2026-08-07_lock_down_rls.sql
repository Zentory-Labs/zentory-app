-- ============================================================================
-- 2026-08-07 — Lock down Row Level Security (audit findings #21 and #41)
--
-- WHAT THIS FIXES
--   Every RLS policy created by supabase/schema.sql was `using (true)` /
--   `with check (true)` with no `TO` clause. No TO clause means TO PUBLIC,
--   which includes `anon` — and the anon key is inlined into the browser
--   bundle on every page load. So any internet user could, with no auth:
--     * INSERT / UPDATE `signals`   -> forge rows on the public research feed
--     * INSERT `provider_stats`     -> forge leaderboard rankings
--     * INSERT `keeper_audit`       -> forge the "tamper-evident" audit trail
--     * INSERT / UPDATE `profiles`  -> write to a table that stores emails
--     * SELECT `whitelist`          -> dump every waitlist email ever collected
--     * SELECT `subscriptions`      -> dump subscriber wallet / tier / spend
--
--   An earlier hardening migration (0035_fix_rls_policies.sql) did the right
--   thing, but schema.sql was re-run afterwards and its `drop policy if exists`
--   only ever drops ITS OWN policy names. Postgres ORs permissive policies
--   together, so `(true) OR (auth.role() = 'service_role')` collapses back to
--   `true` and the hardening was arithmetically dead. That is why this script
--   drops EVERY policy on each table by enumerating pg_policies, rather than
--   dropping a list of names it happens to know about.
--
-- WHAT IT DOES
--   For every protocol table:
--     1. enable row level security
--     2. drop every existing policy, whatever it is named
--     3. revoke insert/update/delete/truncate from anon + authenticated
--     4. re-create a SELECT-only policy for anon on public-display tables
--        (tables holding PII or operator state get no anon policy at all)
--   No write policy is created for anyone. Writes are therefore only possible
--   with the service-role key, which bypasses RLS — that is the keeper, the
--   indexers, and the Next.js API routes (utils/supabase/admin.ts). Those
--   keep working unchanged.
--
-- SAFE TO RE-RUN
--   Yes. It is fully idempotent: it drops and recreates policies from scratch
--   on every run, skips tables that do not exist in this project, and touches
--   no rows. Run it in Supabase Dashboard -> SQL Editor.
--
-- AFTER RUNNING, VERIFY (should return zero rows):
--   select tablename, policyname, cmd, roles
--     from pg_policies
--    where schemaname = 'public'
--      and cmd <> 'SELECT'
--      and ('anon' = any(roles) or 'public' = any(roles));
-- ============================================================================

do $$
declare
  -- Public protocol data. Anon may SELECT and nothing else. Everything here is
  -- either already public on-chain or is rendered on a public page.
  public_read text[] := array[
    'signals',
    'keeper_audit',
    'proposals',
    'signal_scores',
    'epochs',
    'provider_stats',
    'vault_trading_accounts',
    'execution_attempts',
    'hl_user_fills',
    'cross_chain_signal_records',
    'vault_nav_history',
    'vault_flow',
    'vault_performance',
    'epoch_history'
  ];

  -- PII, credentials, or operator state. Anon gets NOTHING — no policy at all,
  -- so RLS denies every anon read and write. Written by server routes and the
  -- keeper with the service-role key.
  private_only text[] := array[
    'whitelist',          -- waitlist emails (GDPR personal data)
    'subscriptions',      -- subscriber wallet / tier / spend
    'profiles',           -- wallet <-> email mapping
    'api_keys',           -- sha256 contributor-key store (authn)
    'keeper_heartbeats',  -- keeper liveness / ops
    'indexer_state'       -- indexer cursor
  ];

  all_tables text[];
  t          text;
  p          record;
  has_roles  boolean;
begin
  all_tables := public_read || private_only;

  select exists (select 1 from pg_roles where rolname = 'anon')
     and exists (select 1 from pg_roles where rolname = 'authenticated')
    into has_roles;

  -- ── 1. Enable RLS, drop every existing policy, revoke write grants ────────
  foreach t in array all_tables loop
    if to_regclass(format('public.%I', t)) is null then
      raise notice '[rls] skipping public.% — table does not exist in this project', t;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);

    for p in
      select policyname
        from pg_policies
       where schemaname = 'public'
         and tablename  = t
    loop
      raise notice '[rls] dropping policy %.% ', t, p.policyname;
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;

    -- Defence in depth. RLS is the primary gate, but Supabase ships a blanket
    -- GRANT ALL on public tables to anon/authenticated; take the write bits
    -- back so a future policy mistake cannot re-open a write path on its own.
    if has_roles then
      execute format(
        'revoke insert, update, delete, truncate on public.%I from anon, authenticated',
        t
      );
    end if;
  end loop;

  -- ── 2. Re-create SELECT-only policies on public-display tables ────────────
  if has_roles then
    foreach t in array public_read loop
      if to_regclass(format('public.%I', t)) is null then
        continue;
      end if;

      execute format(
        'create policy %I on public.%I for select to anon, authenticated using (true)',
        t || '_public_read',
        t
      );
    end loop;
  end if;
end
$$;

-- ── 3. Report the resulting posture ─────────────────────────────────────────
-- Anything printed by this SELECT with cmd <> 'SELECT', or with 'public'/'anon'
-- in roles on a table from private_only above, means the lockdown did not take.
select
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
