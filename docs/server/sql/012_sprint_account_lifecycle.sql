-- Sprint account lifecycle.
-- Run after 011_sprint24d_nickname_policy.sql.

alter table public.profiles
  add column if not exists status text not null default 'active',
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_status_check;

alter table public.profiles
  add constraint profiles_status_check
  check (status in ('active', 'guest', 'linked', 'archived', 'deleted'));

update public.profiles
set status = case
  when deleted_at is not null then 'deleted'
  when archived_at is not null then 'archived'
  when auth_user_id is null and guest_id is not null then 'guest'
  when auth_user_id is not null and guest_id is not null then 'linked'
  else 'active'
end
where status is null
   or status not in ('active', 'guest', 'linked', 'archived', 'deleted');

create index if not exists profiles_auth_user_status_idx
on public.profiles(auth_user_id, status, updated_at desc)
where auth_user_id is not null;

create index if not exists profiles_guest_status_idx
on public.profiles(guest_id, status)
where guest_id is not null;

drop index if exists profiles_normalized_nickname_uidx;

create unique index if not exists profiles_normalized_nickname_active_uidx
on public.profiles(normalized_nickname)
where normalized_nickname is not null
  and status not in ('archived', 'deleted');
