-- ============================================================
-- Zentory Protocol — Supabase Schema (fully idempotent)
-- Run this in: Supabase Dashboard → SQL Editor
-- Safe to re-run: drops and recreates every object
-- ============================================================
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

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

alter table public.signals enable row level security;

drop policy if exists "signals_read_all" on public.signals;
create policy "signals_read_all"
  on public.signals for select using (true);

drop policy if exists "signals_insert_keeper" on public.signals;
create policy "signals_insert_keeper"
  on public.signals for insert with check (true);

drop policy if exists "signals_update_keeper" on public.signals;
create policy "signals_update_keeper"
  on public.signals for update using (true);

drop policy if exists "signals_insert_public" on public.signals;
create policy "signals_insert_public"
  on public.signals for insert with check (true);

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

alter table public.profiles enable row level security;

drop policy if exists "profiles_read_all" on public.profiles;
create policy "profiles_read_all"
  on public.profiles for select using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert with check (true);

drop policy if exists "profiles_update_keeper" on public.profiles;
create policy "profiles_update_keeper"
  on public.profiles for update using (true);

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

alter table public.proposals enable row level security;

drop policy if exists "proposals_read_all" on public.proposals;
create policy "proposals_read_all"
  on public.proposals for select using (true);

drop policy if exists "proposals_insert_keeper" on public.proposals;
create policy "proposals_insert_keeper"
  on public.proposals for insert with check (true);

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

alter table public.keeper_audit enable row level security;

drop policy if exists "keeper_audit_read_all" on public.keeper_audit;
create policy "keeper_audit_read_all"
  on public.keeper_audit for select using (true);

drop policy if exists "keeper_audit_insert_keeper" on public.keeper_audit;
create policy "keeper_audit_insert_keeper"
  on public.keeper_audit for insert with check (true);

drop policy if exists "keeper_audit_insert_keeper_v2" on public.keeper_audit;
create policy "keeper_audit_insert_keeper_v2"
  on public.keeper_audit for insert with check (true);

create index if not exists keeper_audit_created_idx on public.keeper_audit(created_at desc);
create index if not exists keeper_audit_signal_idx on public.keeper_audit(signal_id);

-- ─── Whitelist / Waitlist ─────────────────────────────────
create table if not exists public.whitelist (
  id         text        primary key default uuid_generate_v4(),
  email      text        not null unique,
  source     text        not null default 'website',
  created_at timestamptz not null default now()
);

alter table public.whitelist enable row level security;

drop policy if exists "whitelist_insert_public" on public.whitelist;
create policy "whitelist_insert_public"
  on public.whitelist for insert with check (true);

drop policy if exists "whitelist_read_admin" on public.whitelist;
create policy "whitelist_read_admin"
  on public.whitelist for select using (true);

drop policy if exists "whitelist_insert_keeper" on public.whitelist;
create policy "whitelist_insert_keeper"
  on public.whitelist for insert with check (true);

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

alter table public.vault_trading_accounts enable row level security;

drop policy if exists "vault_trading_accounts_read_all" on public.vault_trading_accounts;
create policy "vault_trading_accounts_read_all"
  on public.vault_trading_accounts for select using (true);

drop policy if exists "vault_trading_accounts_insert_keeper" on public.vault_trading_accounts;
create policy "vault_trading_accounts_insert_keeper"
  on public.vault_trading_accounts for insert with check (true);

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

alter table public.execution_attempts enable row level security;

drop policy if exists "execution_attempts_read_all" on public.execution_attempts;
create policy "execution_attempts_read_all"
  on public.execution_attempts for select using (true);

drop policy if exists "execution_attempts_insert_keeper" on public.execution_attempts;
create policy "execution_attempts_insert_keeper"
  on public.execution_attempts for insert with check (true);

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

alter table public.hl_user_fills enable row level security;

drop policy if exists "hl_user_fills_read_all" on public.hl_user_fills;
create policy "hl_user_fills_read_all"
  on public.hl_user_fills for select using (true);

drop policy if exists "hl_user_fills_insert_keeper" on public.hl_user_fills;
create policy "hl_user_fills_insert_keeper"
  on public.hl_user_fills for insert with check (true);

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

alter table public.signal_scores enable row level security;

drop policy if exists "signal_scores_read_all" on public.signal_scores;
create policy "signal_scores_read_all"
  on public.signal_scores for select using (true);

drop policy if exists "signal_scores_insert_keeper" on public.signal_scores;
create policy "signal_scores_insert_keeper"
  on public.signal_scores for insert with check (true);

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
  updated_at          bigint  not null default (EXTRACT(EPOCH FROM NOW()))::BIGINT
);

create index if not exists idx_provider_stats_rank     on public.provider_stats(current_rank);
create index if not exists idx_provider_stats_provider on public.provider_stats(provider);

alter table public.provider_stats enable row level security;

drop policy if exists "provider_stats_read_all" on public.provider_stats;
create policy "provider_stats_read_all"
  on public.provider_stats for select using (true);

drop policy if exists "provider_stats_insert_keeper" on public.provider_stats;
create policy "provider_stats_insert_keeper"
  on public.provider_stats for insert with check (true);

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
create index if not exists idx_subscriptions_active
  on public.subscriptions(subscriber, expiration)
  where expiration > (EXTRACT(EPOCH FROM NOW()))::BIGINT;

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_read_all" on public.subscriptions;
create policy "subscriptions_read_all"
  on public.subscriptions for select using (true);

drop policy if exists "subscriptions_insert_keeper" on public.subscriptions;
create policy "subscriptions_insert_keeper"
  on public.subscriptions for insert with check (true);

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

alter table public.epochs enable row level security;

drop policy if exists "epochs_read_all" on public.epochs;
create policy "epochs_read_all"
  on public.epochs for select using (true);

drop policy if exists "epochs_insert_keeper" on public.epochs;
create policy "epochs_insert_keeper"
  on public.epochs for insert with check (true);

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

alter table public.cross_chain_signal_records enable row level security;

drop policy if exists "cross_chain_signal_records_read_all" on public.cross_chain_signal_records;
create policy "cross_chain_signal_records_read_all"
  on public.cross_chain_signal_records for select using (true);

drop policy if exists "cross_chain_signal_records_insert_keeper" on public.cross_chain_signal_records;
create policy "cross_chain_signal_records_insert_keeper"
  on public.cross_chain_signal_records for insert with check (true);
