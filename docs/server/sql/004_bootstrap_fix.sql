-- Sprint 13-C bootstrap hardening
-- Run after 001_schema.sql, 002_rls_policies.sql, and 003_action_indexes.sql.

alter table public.profiles
  add column if not exists nickname text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.player_states
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists gold bigint not null default 5000 check (gold >= 0),
  add column if not exists forge_ember bigint not null default 2000 check (forge_ember >= 0),
  add column if not exists transcend_stone bigint not null default 0 check (transcend_stone >= 0),
  add column if not exists forge_level int not null default 1 check (forge_level between 1 and 10),
  add column if not exists forge_last_collected_at timestamptz not null default now(),
  add column if not exists current_season_id text not null default '',
  add column if not exists stats jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.owned_weapons
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists weapon_id text,
  add column if not exists enhance_level int not null default 0 check (enhance_level between 0 and 15),
  add column if not exists transcend_level int not null default 0 check (transcend_level between 0 and 10),
  add column if not exists durability int not null default 3 check (durability between 0 and 3),
  add column if not exists is_locked boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.player_records
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists best_weapon_name text,
  add column if not exists best_weapon_id text,
  add column if not exists best_weapon_value bigint not null default 0 check (best_weapon_value >= 0),
  add column if not exists best_weapon_enhance_level int not null default 0 check (best_weapon_enhance_level between 0 and 15),
  add column if not exists best_weapon_transcend_level int not null default 0 check (best_weapon_transcend_level between 0 and 10),
  add column if not exists best_sale_gold bigint not null default 0 check (best_sale_gold >= 0),
  add column if not exists total_sales_gold bigint not null default 0 check (total_sales_gold >= 0),
  add column if not exists max_transcend_level int not null default 0 check (max_transcend_level between 0 and 10),
  add column if not exists stats jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists player_states_user_id_uidx
on public.player_states(user_id);

create unique index if not exists player_records_user_id_uidx
on public.player_records(user_id);

-- Prevent concurrent bootstrap requests from seeding the starter weapon more than once.
create unique index if not exists owned_weapons_starter_seed_uidx
on public.owned_weapons(user_id)
where weapon_id = 'w_rusty_dagger'
  and enhance_level = 0
  and transcend_level = 0;
