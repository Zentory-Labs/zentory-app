-- ============================================================================
-- 2026-08-22 — Add `expires_at` to api_keys (audit Q16 / finding #22)
--
-- WHAT THIS FIXES
--   api_keys had no expiry column. Keys were checked only for `is_active`,
--   so a stolen + quietly-used credential was indistinguishable from normal
--   traffic. There was also no rotation path — `last_used_at` was written but
--   never read. The audit recommendation was:
--
--     "Add `expires_at` (90-day default) and reject expired keys;
--      add `created_by_key_id` so minting is traceable, and require
--      a separate, human-issued bootstrap credential (or wallet signature)
--      rather than an existing API key to mint new ones."
--
--   The self-mint-from-existing-key path is a follow-up (see audit finding
--   #22 part 1) — this migration covers the expiry half because the
--   contributor program opens Q3 2026 and we cannot ship without rotation.
--
-- WHAT IT DOES
--   1. Adds `expires_at BIGINT` (unix seconds) NOT NULL with a 90-day default
--      of (now() + interval '90 days').
--   2. Backfills any pre-existing rows so they all have a sensible expiry
--      (90 days from now if they were active; already-revoked rows stay
--      historical).
--   3. Adds an index on `expires_at` for the "is this key still valid"
--      lookup that the route family now performs on every request.
--   4. Adds `created_by_key_id BIGINT` self-FK so a future audit can trace
--      minting chains (column is nullable; written by the routes after this
--      migration is applied — a future PR will enforce non-null for new rows).
--
-- SAFE TO RE-RUN
--   Yes. Every statement is `add column if not exists` / `update ... where`
--   / `create index if not exists`. No rows are touched after the initial
--   backfill; if you re-run, the WHERE clause on the backfill skips rows
--   that already have a non-null expires_at.
--
-- AFTER RUNNING, VERIFY (should return one row per active api_keys row):
--   select id, provider, key_prefix, created_at, expires_at, is_active
--     from public.api_keys
--    order by created_at desc;
-- ============================================================================

-- ─── 1. Add expires_at with 90-day default ────────────────────────────────
alter table public.api_keys
  add column if not exists expires_at bigint
  not null default (EXTRACT(EPOCH FROM (now() + interval '90 days'))::BIGINT);

-- ─── 2. Backfill any rows that pre-date the NOT NULL constraint being live
--       (defensive — IF NOT EXISTS above already covers this, but be explicit
--       for rows that were inserted with NULL before the column was added).
update public.api_keys
   set expires_at = (EXTRACT(EPOCH FROM (now() + interval '90 days'))::BIGINT)
 where expires_at is null;

-- ─── 3. Index for the "is this key still valid" lookup ────────────────────
create index if not exists idx_api_keys_expires_at
  on public.api_keys(expires_at);

-- Composite index for the (provider, is_active, expires_at) filter the
-- api-keys GET handler runs to list the provider's active keys.
create index if not exists idx_api_keys_provider_active_expiry
  on public.api_keys(provider, is_active, expires_at desc);

-- ─── 4. Self-FK so minting chains are traceable ───────────────────────────
-- Nullable on purpose: the existing POST handler has not been updated yet to
-- thread `created_by_key_id`. A follow-up PR will enforce non-null on insert
-- for new rows and update the route to populate it. Pre-existing rows are
-- left as NULL — that's the truth ("we don't know who minted this").
alter table public.api_keys
  add column if not exists created_by_key_id bigint
  references public.api_keys(id) on delete set null;

create index if not exists idx_api_keys_created_by
  on public.api_keys(created_by_key_id);

-- ─── 5. Post-run assertion: every row has a non-null expires_at ───────────
do $$
declare
  bad_count integer;
begin
  select count(*) into bad_count from public.api_keys where expires_at is null;
  if bad_count > 0 then
    raise exception 'api_keys expiry migration incomplete: % rows still have NULL expires_at', bad_count;
  end if;
end
$$;
