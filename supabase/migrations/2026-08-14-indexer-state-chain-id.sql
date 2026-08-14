-- ============================================================================
-- 2026-08-14 — Indexer cursor: add chain_id column for multi-chain safety
--
-- WHY
--   The strategy-executor indexer (scripts/index_strategy_executor_events.py)
--   is gaining cursor persistence against public.indexer_state (P1-8). To
--   refuse to advance a cursor across a chain re-point (e.g. testnet 998 ->
--   mainnet 7777) we need to record which chain the cursor is on. Existing
--   entries (key=signal_arena) get backfilled to chain 998 (testnet) so the
--   new column doesn't NULL-violate the engine-side check.
--
-- WHAT IT DOES
--   1. Adds indexer_state.chain_id bigint NULL (nullable for safety on
--      already-deployed instances; engine treats NULL as "unknown, refuse
--      to advance").
--   2. Backfills existing rows to chain 998 so the signal_arena indexer
--      keeps working without operator action.
--   3. Re-runs the RLS lockdown (no policy = no anon access) — the column
--      is only ever read/written by service-role callers (the indexers).
--
-- SAFE TO RE-RUN
--   Yes. Each statement is idempotent: add-if-missing column, conditional
--   backfill (where chain_id IS NULL), and the RLS reset is a drop-and-
--   recreate that is safe to repeat.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'indexer_state'
       and column_name  = 'chain_id'
  ) then
    alter table public.indexer_state add column chain_id bigint;
  end if;
end$$;

update public.indexer_state
   set chain_id = 998
 where chain_id is null;

-- Tighten the RLS again in case prior migrations altered it.
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'indexer_state' loop
    execute format('drop policy if exists %I on public.indexer_state', r.policyname);
  end loop;
end$$;

-- (No new policy created: writes/reads are service-role only.)
