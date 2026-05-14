-- Sprint 13-A Supabase schema
-- Run this first in the Supabase SQL Editor.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_nickname_format check (
    nickname is null
    or (
      char_length(btrim(nickname)) between 2 and 12
      and btrim(nickname) ~ '^[가-힣A-Za-z0-9]+$'
    )
  )
);

create table if not exists public.player_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gold bigint not null default 2500 check (gold >= 0),
  forge_ember bigint not null default 3000 check (forge_ember >= 0),
  transcend_stone bigint not null default 0 check (transcend_stone >= 0),
  forge_level int not null default 1 check (forge_level between 1 and 10),
  forge_last_collected_at timestamptz not null default now(),
  current_season_id text not null default '',
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_states_user_id_unique unique (user_id)
);

create table if not exists public.owned_weapons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weapon_id text not null,
  enhance_level int not null default 0 check (enhance_level between 0 and 15),
  transcend_level int not null default 0 check (transcend_level between 0 and 10),
  durability int not null default 3 check (durability between 0 and 3),
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  best_weapon_name text,
  best_weapon_id text,
  best_weapon_value bigint not null default 0 check (best_weapon_value >= 0),
  best_weapon_enhance_level int not null default 0 check (best_weapon_enhance_level between 0 and 15),
  best_weapon_transcend_level int not null default 0 check (best_weapon_transcend_level between 0 and 10),
  best_sale_gold bigint not null default 0 check (best_sale_gold >= 0),
  total_sales_gold bigint not null default 0 check (total_sales_gold >= 0),
  max_transcend_level int not null default 0 check (max_transcend_level between 0 and 10),
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_records_user_id_unique unique (user_id)
);

create table if not exists public.game_action_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null,
  action_id text not null,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint game_action_logs_action_id_unique unique (action_id)
);

create table if not exists public.weekly_rankings (
  id uuid primary key default gen_random_uuid(),
  season_id text not null,
  category text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text,
  weapon_instance_id uuid references public.owned_weapons(id) on delete set null,
  weapon_name text,
  weapon_id text,
  enhance_level int not null default 0 check (enhance_level between 0 and 15),
  transcend_level int not null default 0 check (transcend_level between 0 and 10),
  ranking_value bigint not null default 0 check (ranking_value >= 0),
  score bigint not null default 0 check (score >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.world_records (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text,
  weapon_name text,
  weapon_id text,
  enhance_level int not null default 0 check (enhance_level between 0 and 15),
  transcend_level int not null default 0 check (transcend_level between 0 and 10),
  value bigint not null default 0 check (value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists player_states_set_updated_at on public.player_states;
create trigger player_states_set_updated_at
before update on public.player_states
for each row execute function public.set_updated_at();

drop trigger if exists owned_weapons_set_updated_at on public.owned_weapons;
create trigger owned_weapons_set_updated_at
before update on public.owned_weapons
for each row execute function public.set_updated_at();

drop trigger if exists player_records_set_updated_at on public.player_records;
create trigger player_records_set_updated_at
before update on public.player_records
for each row execute function public.set_updated_at();

drop trigger if exists world_records_set_updated_at on public.world_records;
create trigger world_records_set_updated_at
before update on public.world_records
for each row execute function public.set_updated_at();

create index if not exists player_states_user_id_idx on public.player_states(user_id);
create index if not exists owned_weapons_user_id_idx on public.owned_weapons(user_id);
create index if not exists player_records_user_id_idx on public.player_records(user_id);
create index if not exists game_action_logs_user_id_idx on public.game_action_logs(user_id);
create index if not exists weekly_rankings_lookup_idx on public.weekly_rankings(season_id, category, score desc);
create index if not exists weekly_rankings_user_idx on public.weekly_rankings(user_id, season_id);
create index if not exists world_records_category_idx on public.world_records(category, value desc);
