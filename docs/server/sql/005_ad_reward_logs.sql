-- Sprint 14 ad reward logs
-- Run after 001_schema.sql through 004_bootstrap_fix.sql.

create table if not exists public.ad_reward_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_type text not null,
  reward_status text not null default 'pending',
  provider text not null,
  provider_reward_id text,
  action_id text not null,
  related_action_id text,
  payload jsonb not null default '{}'::jsonb,
  reward_result jsonb,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_reward_logs_status_check check (
    reward_status in ('pending', 'processing', 'completed', 'expired', 'failed', 'canceled')
  ),
  constraint ad_reward_logs_type_check check (
    reward_type in (
      'forgeCollectDouble',
      'sellBonus',
      'destructionScrapDouble',
      'dailyTranscendStoneBox'
    )
  )
);

drop trigger if exists ad_reward_logs_set_updated_at on public.ad_reward_logs;
create trigger ad_reward_logs_set_updated_at
before update on public.ad_reward_logs
for each row execute function public.set_updated_at();

create unique index if not exists ad_reward_logs_user_action_uidx
on public.ad_reward_logs(user_id, action_id);

create unique index if not exists ad_reward_logs_provider_reward_uidx
on public.ad_reward_logs(provider_reward_id)
where provider_reward_id is not null;

create unique index if not exists ad_reward_logs_pending_related_uidx
on public.ad_reward_logs(user_id, reward_type, related_action_id)
where related_action_id is not null
  and reward_status in ('pending', 'processing', 'completed');

create index if not exists ad_reward_logs_user_status_idx
on public.ad_reward_logs(user_id, reward_status);

create index if not exists ad_reward_logs_reward_type_idx
on public.ad_reward_logs(reward_type);

create index if not exists ad_reward_logs_expires_at_idx
on public.ad_reward_logs(expires_at);

alter table public.ad_reward_logs enable row level security;

drop policy if exists "ad_reward_logs_select_own" on public.ad_reward_logs;
create policy "ad_reward_logs_select_own"
on public.ad_reward_logs
for select
to authenticated
using ((select auth.uid()) = user_id);

-- No client insert/update/delete policies are created.
-- All mutations must go through server route handlers with the admin client.
