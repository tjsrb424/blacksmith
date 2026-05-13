# Sprint 23-A Server Action Latency

## Scope

- Mutating APIs checked: enhance, buy, sell, forge collect, forge upgrade.
- Ranking APIs checked: weekly ranking, world records.
- Game math, enhancement probability, sale price, ranking value, auth flow, and ad provider code were left unchanged.

## Perf Logging

Server logs are now emitted as one safe summary line per request when enabled:

```text
[perf][enhance] auth=40ms requestParse=1ms actionIdClaimReplayCheck=70ms playerStateLookup=80ms ownedWeaponLookup=60ms rankingCountersUpdate=120ms responseSerialize=2ms total=420ms
```

Control flags:

- `PERF_DEBUG_SERVER=true`: enable server perf logs in production or development.
- `PERF_DEBUG_SERVER=false`: disable server perf logs.
- `NEXT_PUBLIC_PERF_DEBUG=true`: enable client diagnostic logs.

No email, token, cookie, service role key, or raw payload content is logged.

## Payload Changes

- `buy` now returns a `patch` with `currentGold/currentEmber/currentStone` and the inserted `changedWeapon`.
- `forge_collect` now returns a `patch` with resource totals, `forgeLastCollectedAt`, and updated records.
- `forge_upgrade` now returns a `patch` with resource totals and `forgeLevel`.
- `enhance` and `sell` were already on patch responses for the hot path.
- Ranking is still fetched only from ranking routes, not bundled into mutation responses.

This removes the post-action full player snapshot query from buy, forge collect, and forge upgrade.

## Query/Write Shape

| Action | Reads | Writes | Ranking work | Response |
| --- | ---: | ---: | --- | --- |
| buy | 1 player_state | 1 player_state update, 1 owned_weapon insert, action log begin/finish | none | patch |
| enhance | profile, player_state, player_records, target owned_weapon | owned_weapon, player_state, player_records, action log begin/finish | strongest rank count/upsert only when needed, counters | patch |
| sell | player_state, player_records, target owned_weapon, owned count, profile | player_state, owned_weapon delete, player_records, action log begin/finish | weekly sales upsert, world sale only on new candidate | patch |
| forge_collect | player_state, player_records | player_state, player_records, action log begin/finish | none | patch |
| forge_upgrade | 1 player_state | 1 player_state update, action log begin/finish | none | patch |
| ranking weekly | auth + weekly_rankings top rows | none | query-only | ranking rows |
| ranking world | auth + world_records | none | query-only | record cards |

## Index Review

Already present:

- `player_states(user_id)` via index and unique constraint.
- `player_records(user_id)` via index and unique constraint.
- `owned_weapons(user_id)`.
- `game_action_logs(action_id)` unique.
- `weekly_rankings(season_id, category, user_id)` unique.
- `weekly_rankings(season_id, category, score desc)`.
- `world_records(category)` unique and `(category, value desc)`.
- ad reward limit/status indexes.

Added in `docs/server/sql/007_sprint23a_performance_indexes.sql`:

- `owned_weapons(user_id, is_locked)`.
- `owned_weapons(user_id, created_at desc)`.
- `game_action_logs(user_id, created_at desc)`.
- `weekly_rankings(season_id, category, score desc, created_at asc)`.
- `weekly_rankings(season_id, category, user_id)`.
- `world_records(value desc)`.
- `ad_reward_logs(user_id, created_at desc)`.

Not applicable:

- `owned_weapons(user_id, equipped)`: there is no persisted `equipped` column in the current schema.
- `owned_weapons(user_id, locked)`: the actual column is `is_locked`.
- `world_records(ranking_value desc)`: the actual column is `value`.

## Ranking Bottleneck Notes

- Estimated strongest-weapon rank uses count queries, not a full ranking list.
- Top ranking rows are fetched only from ranking routes.
- `world_records` uses category rows and pre-checks current value before upsert.
- `sell` skips the world sale upsert unless the sale can beat the user's previous best sale.

## Concurrency/Idempotency

- All covered mutations still require `actionId`.
- `game_action_logs.action_id` remains the idempotency key.
- Replayed actions return stored responses.
- UI disables action buttons while a server mutation is pending.
- DB-level multi-row transaction support is still a future hardening item; current code keeps existing server-authoritative checks and idempotency but does not add a new RPC transaction.

## Region Review

- No Vercel function region is configured in the repository.
- No Supabase DB region is recorded in the repository.
- Next 16 local docs note that Vercel-specific `preferredRegion` support is tied to Edge runtime; these route handlers currently run as dynamic Node handlers.
- For Korea-first traffic, verify the Supabase project region in Supabase Dashboard and Vercel function region in Vercel Dashboard. If Supabase is not in or near Asia, DB round trips will dominate mutation latency.

## Scale Risks

- 100 users: current query shape should be acceptable if indexes are applied; action log writes and ranking upserts become the first monitored points.
- 1,000 users: weekly ranking indexes and `game_action_logs(action_id)` uniqueness are essential; watch p95 for ranking count queries and action log begin/finish.
- 10,000 users: move hot mutations into Postgres RPC transactions, add connection pooling review, and consider async/non-blocking action audit logs for non-critical telemetry.

## Test Script

`npm run perf:api` runs a small authenticated HTTP latency harness.

Required for authenticated routes:

- `PERF_TEST_COOKIE`
- `PERF_TEST_RANKING_SEASON_ID`
- `PERF_TEST_WEAPON_INSTANCE_ID` for enhance
- `PERF_TEST_CONFIRM_MUTATIONS=true` only against a disposable local/staging account

Default mutation tests are skipped unless explicitly confirmed.

## Verification

- `npm run lint`: passed.
- `npm run build`: passed.
- `NEXT_PUBLIC_GAME_MODE=beta npm run build`: passed.
- Local browser smoke check: `http://localhost:3000/play` renders the beta login screen.
