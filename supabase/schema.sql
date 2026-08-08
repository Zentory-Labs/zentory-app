-- ============================================================
-- Zentory Protocol — Supabase Schema (fully idempotent)
-- Run this in: Supabase Dashboard → SQL Editor
-- Safe to re-run: drops and recreates every object
-- ============================================================
--
-- RLS MODEL (audit findings #21 / #41 — do not weaken without a review):
--
--   * `anon` (the publishable key, inlined into every page of the browser
--     bundle) gets SELECT and ONLY SELECT, and only on tables whose contents
--     are already public (on-chain data, or data rendered on a public page).
--   * `anon` gets NO policy at all on tables holding PII, credentials or
--     operator state (whitelist, subscriptions, profiles, api_keys,
--     indexer_state). RLS with no policy denies everything.
--   * NOBODY gets an INSERT / UPDATE / DELETE policy. All writes go through
--     the service-role key, which bypasses RLS — that is the keeper, the
--     indexers, and the Next.js API routes via utils/supabase/admin.ts.
--
-- Previously every policy here was `using (true)` / `with check (true)` with
-- no TO clause (= TO PUBLIC = includes anon), so any visitor could forge rows
-- in signals / provider_stats / keeper_audit and dump the waitlist. Worse,
-- `drop policy if exists` only drops the names this file knows about, so
-- re-running it silently ORed its permissive policies on top of a hardening
-- migration and cancelled it out. rls_reset() below fixes that class of bug by
-- dropping EVERY policy on the table, whatever it is called.
--
-- To fix an ALREADY-LIVE database without re-running this whole file, use
-- supabase/migrations/2026-08-07_lock_down_rls.sql instead.
-- ============================================================
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ─── RLS helpers ───────────────────────────────────────────
-- rls_reset(table): enable RLS, drop EVERY existing policy on the table (not
-- just the ones named in this file), and revoke write grants from anon /
-- authenticated. Leaves the table deny-all; callers then add back exactly the
-- reads they want. Dropped again at the bottom of this file.
create or replace function public.zentory_rls_reset(tbl text)
returns void language plpgsql as $$
declare
  p record;
begin
  if to_regclass(format('public.%I', tbl)) is null then
    raise notice '[rls] skipping public.% — table does not exist', tbl;
    return;
  end if;

  execute format('alter table public.%I enable row level security', tbl);

  for p in
    select policyname from pg_policies
     where schemaname = 'public' and tablename = tbl
  loop
    execute format('drop policy %I on public.%I', p.policyname, tbl);
  end loop;

  -- Defence in depth: Supabase ships a blanket GRANT ALL on public tables to
  -- anon/authenticated. Take the write bits back so a future policy mistake
  -- cannot re-open a write path on its own.
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute format(
      'revoke insert, update, delete, truncate on public.%I from anon, authenticated', tbl);
  end if;
end;
$$;

-- rls_public_read(table): anon + authenticated may SELECT. Nothing else.
create or replace function public.zentory_rls_public_read(tbl text)
returns void language plpgsql as $$
begin
  if to_regclass(format('public.%I', tbl)) is null then
    return;
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      tbl || '_public_read', tbl);
  end if;
end;
$$;

-- ─── Signals ───────────────────────────────────────────────
create table if not exists public.signals (
  id                  text        primary key default uuid_generate_v4(),
  created_at          timestamptz not null default now(),
  provider            text        not null,
  asset               text        not null,
  direction           text        not null,
  size                numeric     not null,
  price               numeric     not null,
  status              text        not null default 'pending',
  tx_hash             text,
  executed_by         text,
  executor_address    text,
  -- Multi-asset / EpochScoring columns
  asset_class         text        not null default 'CRYPTO_PERP',
  asset_id            text        not null default 'CRYPTO:BTC',
  chain_id            bigint,
  accuracy_bps        integer,
  payout_zent         numeric(78, 0),
  expires_at          bigint,
  nonce               bigint      default 0,
  signal_hash         text,
  provider_ve_balance numeric(78, 0)
);

-- Trigger (idempotent via CREATE OR REPLACE)
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists signals_updated_at on public.signals;
create trigger signals_updated_at
  before update on public.signals
  for each row execute function public.handle_updated_at();

-- Public: the research feed renders these rows. Writes are keeper-only, so
-- they run with the service-role key (see app/api/research/*).
select public.zentory_rls_reset('signals');
select public.zentory_rls_public_read('signals');

-- Multi-asset indexes
create index if not exists signals_asset_idx               on public.signals(asset);
create index if not exists signals_status_idx              on public.signals(status);
create index if not exists signals_provider_idx            on public.signals(provider);
create index if not exists signals_created_idx             on public.signals(created_at desc);
create index if not exists idx_signals_asset_class         on public.signals(asset_class);
create index if not exists idx_signals_asset_id            on public.signals(asset_id);
create index if not exists idx_signals_provider            on public.signals(provider);
create index if not exists idx_signals_provider_ve_balance on public.signals(provider_ve_balance);
create index if not exists idx_signals_expires_at          on public.signals(expires_at);

-- ─── Profiles ──────────────────────────────────────────────
create table if not exists public.profiles (
  wallet_address   text        primary key,
  email            text        unique,
  created_at       timestamptz not null default now(),
  is_keeper        boolean     not null default false,
  is_governor      boolean     not null default false
);

-- PRIVATE: maps a wallet address to an email. Personal data — no anon policy,
-- so RLS denies every anon read and write. Service role only.
select public.zentory_rls_reset('profiles');

-- ─── Governance Proposals ───────────────────────────────────
create table if not exists public.proposals (
  id                text        primary key default uuid_generate_v4(),
  proposal_id       integer     not null unique,
  title             text        not null,
  description       text        not null,
  status            text        not null default 'active',
  votes_for         numeric     not null default 0,
  votes_against     numeric     not null default 0,
  quorum_required   numeric     not null default 0,
  created_at        timestamptz not null default now()
);

-- Public: governance proposals are already public on-chain.
select public.zentory_rls_reset('proposals');
select public.zentory_rls_public_read('proposals');

-- ─── Keeper Audit Log ──────────────────────────────────────
create table if not exists public.keeper_audit (
  id                text        primary key default uuid_generate_v4(),
  signal_id         text        references public.signals(id) on delete set null,
  tx_hash           text        not null,
  gas_used          numeric,
  executor_address   text,
  block_number      bigint,
  created_at        timestamptz not null default now()
);

-- Public read: this is the audit trail investors are invited to check. It is
-- only tamper-evident if anon CANNOT write to it — inserts are service-role
-- only (app/api/research/execute).
select public.zentory_rls_reset('keeper_audit');
select public.zentory_rls_public_read('keeper_audit');

create index if not exists keeper_audit_created_idx on public.keeper_audit(created_at desc);
create index if not exists keeper_audit_signal_idx on public.keeper_audit(signal_id);

-- ─── Whitelist / Waitlist ─────────────────────────────────
create table if not exists public.whitelist (
  id         text        primary key default uuid_generate_v4(),
  email      text        not null unique,
  source     text        not null default 'website',
  created_at timestamptz not null default now()
);

-- PRIVATE: waitlist emails are personal data (GDPR). The old
-- "whitelist_read_admin ... using (true)" policy let anyone holding the
-- publishable key dump the entire list; the old insert policy let anyone
-- stuff it. No anon policy now — signups go through POST /api/whitelist,
-- which writes with the service-role key.
select public.zentory_rls_reset('whitelist');

create index if not exists whitelist_email_idx   on public.whitelist(email);
create index if not exists whitelist_created_idx on public.whitelist(created_at desc);

-- ─── Vault Trading Accounts (Hybrid Execution) ────────────
create table if not exists public.vault_trading_accounts (
  vault_address   text primary key,
  hl_user_address text not null,
  asset           text not null,
  notes           text,
  created_at      timestamptz not null default now()
);

-- Public read: the execution-trace panel maps a vault to its HL account.
select public.zentory_rls_reset('vault_trading_accounts');
select public.zentory_rls_public_read('vault_trading_accounts');

-- ─── Execution Attempts (Hybrid Execution) ─────────────────
create table if not exists public.execution_attempts (
  id            uuid primary key default gen_random_uuid(),
  vault_address text not null,
  tx_hash       text not null,
  chain_id      int  not null default 998,
  nonce         numeric,
  direction     smallint,
  size_raw      text,
  price_raw     text,
  expiry_ts     bigint,
  status        text not null default 'submitted',
  error         text,
  created_at    timestamptz not null default now(),
  unique (vault_address, tx_hash)
);

-- Public read: rendered by lib/execution-trace.ts. Written by the keeper.
select public.zentory_rls_reset('execution_attempts');
select public.zentory_rls_public_read('execution_attempts');

create index if not exists execution_attempts_created_idx
  on public.execution_attempts (created_at desc);

-- ─── Hyperliquid User Fills (Hybrid Execution) ──────────────
create table if not exists public.hl_user_fills (
  id              bigserial primary key,
  vault_address   text      not null,
  hl_user_address text      not null,
  source          text      not null default 'hyperliquid_testnet_info',
  fill_key        text      not null,
  coin            text,
  px              text,
  sz              text,
  side            text,
  dir             text,
  fee             text,
  fee_token       text,
  closed_pnl      text,
  oid             text,
  tid             text,
  time_ms         bigint,
  hash            text,
  raw             jsonb     not null,
  inserted_at     timestamptz not null default now(),
  unique (vault_address, fill_key)
);

-- Public read: fills are already public on Hyperliquid. Written by the indexer.
select public.zentory_rls_reset('hl_user_fills');
select public.zentory_rls_public_read('hl_user_fills');

create index if not exists hl_user_fills_time_idx
  on public.hl_user_fills (vault_address, time_ms desc);
create index if not exists hl_user_fills_hl_user_idx
  on public.hl_user_fills (hl_user_address, time_ms desc);

-- ─── signal_scores — EpochScoring accuracy tracking ──────────
create table if not exists public.signal_scores (
  id            bigserial primary key,
  signal_id     text      not null references public.signals(id) on delete cascade,
  epoch_id      bigint    not null,
  accuracy_bps  integer   not null,
  payout_zent   numeric(78, 0) not null,
  scored_at     bigint    not null default (EXTRACT(EPOCH FROM NOW()))::BIGINT,
  scored_by     text,
  unique (signal_id, epoch_id)
);

create index if not exists idx_signal_scores_epoch  on public.signal_scores(epoch_id);
create index if not exists idx_signal_scores_signal on public.signal_scores(signal_id);

-- Public read: accuracy scores drive the public leaderboard. Written by the
-- scoring indexer with the service-role key.
select public.zentory_rls_reset('signal_scores');
select public.zentory_rls_public_read('signal_scores');

-- ─── provider_stats — live provider rankings ─────────────────
create table if not exists public.provider_stats (
  id                  bigserial primary key,
  provider            text     not null unique,
  total_signals       bigint  default 0,
  resolved_signals    bigint  default 0,
  avg_accuracy_bps    integer default 0,
  total_payout_zent   numeric(78, 0) default 0,
  current_rank        integer default 0,
  last_signal_at      bigint,
  zent_staked         numeric(78, 0) default 0,
  updated_at          bigint  not null default (EXTRACT(EPOCH FROM NOW()))::BIGINT
);

-- Idempotent column add for tables created before zent_staked existed
-- (CREATE TABLE IF NOT EXISTS above won't alter an existing table). The
-- /api/leaderboard SELECT references zent_staked, so a missing column errors
-- the whole query.
alter table public.provider_stats add column if not exists zent_staked numeric(78, 0) default 0;
-- Running sum of accuracy bps so the incremental indexer can maintain an exact
-- average (avg = accuracy_sum_bps / resolved_signals) without re-scanning history.
alter table public.provider_stats add column if not exists accuracy_sum_bps bigint default 0;

create index if not exists idx_provider_stats_rank     on public.provider_stats(current_rank);
create index if not exists idx_provider_stats_provider on public.provider_stats(provider);

-- Public read: /api/leaderboard renders these. Anon INSERT previously let
-- anyone fabricate a top-ranked provider — writes are now indexer-only
-- (zentory-engine/scripts/index_signal_arena.py, service-role key).
select public.zentory_rls_reset('provider_stats');
select public.zentory_rls_public_read('provider_stats');

-- ─── indexer_state — cursor for the incremental Signal Arena indexer ──────────
-- Stores the last fully-scanned block so each indexer run scans only NEW blocks
-- (RPC-light) and accumulates into provider_stats. RLS on with no policy: only
-- the service-role key (which bypasses RLS) reads/writes it — nothing public.
create table if not exists public.indexer_state (
  key        text primary key,
  last_block bigint not null default 0,
  updated_at bigint not null default (EXTRACT(EPOCH FROM NOW()))::BIGINT
);
select public.zentory_rls_reset('indexer_state');

-- ─── subscriptions — ERC-6932 subscription tracking ───────────
create table if not exists public.subscriptions (
  id                bigserial primary key,
  subscriber        text      not null,
  tier_id           integer  not null,
  tier_name         text     not null,
  token_id          bigint,
  asset_class_bitmap text    not null,
  expiration        bigint   not null,
  zent_paid         numeric(78, 0) not null,
  subscribed_at     bigint   not null default (EXTRACT(EPOCH FROM NOW()))::BIGINT,
  cancelled_at      bigint,
  refund_zent       numeric(78, 0)
);

create index if not exists idx_subscriptions_subscriber on public.subscriptions(subscriber);
create index if not exists idx_subscriptions_expiration  on public.subscriptions(expiration);
-- Plain composite index (subscriber, expiration). A PARTIAL index with a
-- `where expiration > now()` predicate is illegal in Postgres — index predicates
-- must be IMMUTABLE and now()/EXTRACT(EPOCH FROM NOW()) is only STABLE (error
-- 42P17). The "active" filter is applied at query time instead; this index still
-- serves it.
create index if not exists idx_subscriptions_active
  on public.subscriptions(subscriber, expiration);

-- PRIVATE: subscriber address + tier + amount paid, i.e. a ready-made map of
-- who paid what, keyed to an on-chain identity. The underlying events are
-- public on HyperEVM, but this table hands a scraper the joined view for free.
-- No anon policy — the indexer writes it with the service-role key.
select public.zentory_rls_reset('subscriptions');

-- ─── epochs — epoch windows for EpochScoring ──────────────────
create table if not exists public.epochs (
  id              bigserial primary key,
  epoch_id        bigint    not null unique,
  start_time      bigint    not null,
  end_time        bigint    not null,
  total_signals   integer   default 0,
  settled_signals integer   default 0,
  settled         boolean   default false,
  settled_at      bigint
);

create index if not exists idx_epochs_settled on public.epochs(settled) where not settled;

-- Public read: epoch windows are public on-chain. Written by the keeper.
select public.zentory_rls_reset('epochs');
select public.zentory_rls_public_read('epochs');

-- ─── cross_chain_signal_records — CCIP cross-chain signals ─────
create table if not exists public.cross_chain_signal_records (
  id                     bigserial primary key,
  signal_id              text      not null,
  source_chain_id        bigint    not null,
  destination_chain_id   bigint,
  ccip_message_id        text,
  ccip_status            text,
  sent_at                bigint    not null default (EXTRACT(EPOCH FROM NOW()))::BIGINT,
  received_at            bigint
);

create index if not exists idx_cc_records_signal on public.cross_chain_signal_records(signal_id);
create index if not exists idx_cc_records_status on public.cross_chain_signal_records(ccip_status);

-- Public read: CCIP message status is public on both chains. Keeper-written.
select public.zentory_rls_reset('cross_chain_signal_records');
select public.zentory_rls_public_read('cross_chain_signal_records');

-- ─── Tables that live in the project but not in this file ──────────────────
-- vault_nav_history / vault_flow / vault_performance / epoch_history are read
-- by the dApp; api_keys and keeper_heartbeats are credential/ops state. They
-- were created out-of-band and are still not under version control here, so
-- apply the same posture defensively if they exist. (Bringing their DDL into
-- this file is tracked separately.)
select public.zentory_rls_reset('vault_nav_history');
select public.zentory_rls_public_read('vault_nav_history');
select public.zentory_rls_reset('vault_flow');
select public.zentory_rls_public_read('vault_flow');
select public.zentory_rls_reset('vault_performance');
select public.zentory_rls_public_read('vault_performance');
select public.zentory_rls_reset('epoch_history');
select public.zentory_rls_public_read('epoch_history');
-- PRIVATE — sha256 contributor-key store; the authn root for /api/contribute.
select public.zentory_rls_reset('api_keys');
-- PRIVATE — keeper liveness/ops state.
select public.zentory_rls_reset('keeper_heartbeats');

-- ─── Tear down the helpers ─────────────────────────────────────────────────
drop function if exists public.zentory_rls_public_read(text);
drop function if exists public.zentory_rls_reset(text);

-- ─── Post-run assertion ────────────────────────────────────────────────────
-- Fails loudly if any policy on a public table grants a non-SELECT command to
-- anon or PUBLIC. This is the regression that already happened once (a
-- hardening migration was silently ORed back open by re-running this file).
do $$
declare
  bad text;
begin
  select string_agg(format('%s.%s (%s -> %s)', tablename, policyname, cmd, roles), ', ')
    into bad
    from pg_policies
   where schemaname = 'public'
     and cmd <> 'SELECT'
     and ('anon' = any(roles) or 'public' = any(roles));

  if bad is not null then
    raise exception 'RLS regression: anon/public has write policies: %', bad;
  end if;
end
$$;
