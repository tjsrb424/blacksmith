-- Sprint 13-B action/ranking indexes
-- Run after 001_schema.sql and 002_rls_policies.sql.

create unique index if not exists game_action_logs_action_id_uidx
on public.game_action_logs(action_id);

create unique index if not exists weekly_rankings_season_category_user_uidx
on public.weekly_rankings(season_id, category, user_id);

create unique index if not exists world_records_category_uidx
on public.world_records(category);
