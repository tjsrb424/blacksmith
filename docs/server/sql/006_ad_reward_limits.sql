-- Sprint 17 ad reward limit support indexes
-- Run after 005_ad_reward_logs.sql.

create index if not exists ad_reward_logs_daily_limit_idx
on public.ad_reward_logs(user_id, reward_type, completed_at)
where reward_status = 'completed';

create index if not exists ad_reward_logs_cooldown_idx
on public.ad_reward_logs(user_id, reward_type, requested_at desc);

create index if not exists ad_reward_logs_active_pending_idx
on public.ad_reward_logs(user_id, reward_type, related_action_id, expires_at)
where reward_status = 'pending';
