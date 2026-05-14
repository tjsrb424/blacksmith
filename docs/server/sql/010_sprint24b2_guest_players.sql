-- Sprint 24-B-2 guest server players.
-- Run after 001_schema.sql through 009_sprint23a5_hot_mutation_rpcs.sql.
--
-- Design note:
-- - profiles.id remains the canonical player_id used by state, inventory, RPCs, and rankings.
-- - auth players keep id = auth.users.id and auth_user_id = auth.users.id.
-- - guest players use id = guest_id, store only guest_secret_hash, and can later be linked
--   by setting auth_user_id/linked_at. If an auth player already exists for that user, the
--   merge/keep/overwrite conflict policy needs a product decision before linking.

alter table public.profiles
  drop constraint if exists profiles_id_fkey;

alter table public.player_states
  drop constraint if exists player_states_user_id_fkey;

alter table public.owned_weapons
  drop constraint if exists owned_weapons_user_id_fkey;

alter table public.player_records
  drop constraint if exists player_records_user_id_fkey;

alter table public.game_action_logs
  drop constraint if exists game_action_logs_user_id_fkey;

alter table public.weekly_rankings
  drop constraint if exists weekly_rankings_user_id_fkey;

alter table public.world_records
  drop constraint if exists world_records_user_id_fkey;

alter table public.profiles
  add column if not exists auth_user_id uuid,
  add column if not exists guest_id text,
  add column if not exists guest_secret_hash text,
  add column if not exists play_mode text not null default 'auth',
  add column if not exists linked_at timestamptz;

update public.profiles
  set auth_user_id = id,
      play_mode = 'auth'
  where auth_user_id is null
    and guest_id is null;

alter table public.profiles
  drop constraint if exists profiles_play_mode_check;

alter table public.profiles
  add constraint profiles_play_mode_check
  check (play_mode in ('auth', 'guest'));

alter table public.profiles
  drop constraint if exists profiles_identity_check;

alter table public.profiles
  add constraint profiles_identity_check
  check (
    (play_mode = 'auth' and auth_user_id is not null)
    or
    (play_mode = 'guest' and guest_id is not null and guest_secret_hash is not null)
  );

alter table public.profiles
  drop constraint if exists profiles_nickname_format;

alter table public.profiles
  add constraint profiles_nickname_format
  check (
    nickname is null
    or (
      char_length(btrim(nickname)) between 2 and 12
      and btrim(nickname) ~ '^[가-힣A-Za-z0-9]+$'
    )
  );

create unique index if not exists profiles_auth_user_id_uidx
on public.profiles(auth_user_id)
where auth_user_id is not null;

create unique index if not exists profiles_guest_id_uidx
on public.profiles(guest_id)
where guest_id is not null;

create index if not exists profiles_play_mode_idx
on public.profiles(play_mode);
