-- Sprint 24-D nickname validation and unique namespace.
-- Run after 010_sprint24b2_guest_players.sql.

alter table public.profiles
  add column if not exists normalized_nickname text,
  add column if not exists nickname_updated_at timestamptz;

update public.profiles
set normalized_nickname = regexp_replace(lower(nickname), '[[:space:]._-]+', '', 'g'),
    nickname_updated_at = coalesce(nickname_updated_at, updated_at)
where nickname is not null
  and normalized_nickname is null;

alter table public.profiles
  drop constraint if exists profiles_nickname_format;

alter table public.profiles
  add constraint profiles_nickname_format
  check (
    nickname is null
    or (
      char_length(btrim(nickname)) between 2 and 12
      and btrim(nickname) = nickname
      and nickname !~ '[[:space:]]{2,}'
      and nickname ~ '^[가-힣A-Za-z0-9 ._-]+$'
      and nickname !~ '^[ ._-]'
      and nickname !~ '[ ._-]$'
      and nickname !~ '[._-]{2,}'
    )
  );

create unique index if not exists profiles_normalized_nickname_uidx
on public.profiles(normalized_nickname)
where normalized_nickname is not null;

create index if not exists profiles_nickname_updated_at_idx
on public.profiles(nickname_updated_at);
