-- Sprint 13-A Row Level Security policies
-- Run this after docs/server/sql/001_schema.sql.

alter table public.profiles enable row level security;
alter table public.player_states enable row level security;
alter table public.owned_weapons enable row level security;
alter table public.player_records enable row level security;
alter table public.game_action_logs enable row level security;
alter table public.weekly_rankings enable row level security;
alter table public.world_records enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "player_states_select_own" on public.player_states;
create policy "player_states_select_own"
on public.player_states
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "owned_weapons_select_own" on public.owned_weapons;
create policy "owned_weapons_select_own"
on public.owned_weapons
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "player_records_select_own" on public.player_records;
create policy "player_records_select_own"
on public.player_records
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "game_action_logs_select_own" on public.game_action_logs;
create policy "game_action_logs_select_own"
on public.game_action_logs
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "weekly_rankings_select_all" on public.weekly_rankings;
create policy "weekly_rankings_select_all"
on public.weekly_rankings
for select
to anon, authenticated
using (true);

drop policy if exists "world_records_select_all" on public.world_records;
create policy "world_records_select_all"
on public.world_records
for select
to anon, authenticated
using (true);

-- No direct client insert/update/delete policies are created for:
-- - player_states
-- - owned_weapons
-- - player_records
-- - game_action_logs
-- - weekly_rankings
-- - world_records
--
-- Those writes must go through Next.js Route Handlers using the server admin
-- client. The service/secret key must never be exposed to the browser.
