-- Sprint 23-A latency/ranking support indexes.
-- Run after 001_schema.sql through 006_ad_reward_limits.sql.
-- All statements use IF NOT EXISTS to avoid duplicating existing indexes.

create index if not exists owned_weapons_user_locked_idx
on public.owned_weapons(user_id, is_locked);

create index if not exists owned_weapons_user_created_idx
on public.owned_weapons(user_id, created_at desc);

create index if not exists game_action_logs_user_created_idx
on public.game_action_logs(user_id, created_at desc);

create index if not exists weekly_rankings_season_category_score_created_idx
on public.weekly_rankings(season_id, category, score desc, created_at asc);

create index if not exists weekly_rankings_season_category_user_idx
on public.weekly_rankings(season_id, category, user_id);

create index if not exists world_records_value_idx
on public.world_records(value desc);

create index if not exists ad_reward_logs_user_created_idx
on public.ad_reward_logs(user_id, created_at desc);
