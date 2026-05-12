# Sprint 18-G Ad Reward Complete Latency

Recent production-local readings:

- `/api/ad/reward/complete`: about 1580ms
- ad complete flow: about 3202ms
- ad modal: 13ms
- ad sync/store sync: 0ms
- ad status fetch: 349ms

## Diagnosis

The previous `ad complete` metric included provider load/show time plus the complete API call. With the mock provider, this included an artificial mock delay. The modal and store sync were not the bottleneck.

## Changes

- Added client timing marks for:
  - rewarded event to complete API start
  - complete API duration
  - complete response to modal open
  - reward patch application
  - deferred reward sync
  - ad complete total
- Debug panel now shows `ad api`, `ad event-api`, `ad resp-modal`, and `ad patch`.
- Mock provider delay from reward intent was reduced from 700ms to 150ms so production-local mock QA does not hide server latency behind artificial wait.
- `/api/ad/reward/complete` step warnings use a 700ms threshold.
- `forgeCollectDouble` applies `player_states` and `player_records` updates in parallel.
- `sellBonus` applies state, record, weekly ranking, and optional world sale record work in one parallel group after the weapon delete.
- `sellBonus` skips world sale record checks unless the base sale value can beat the player's known best sale.
- Complete responses remain patch-based and do not return a full player snapshot.

## Still Deferred

The happy-path intent claim still uses the existing read-then-claim structure. Collapsing it into `UPDATE ... WHERE pending RETURNING *` is the next server-side round-trip reduction, but it changes replay/conflict flow enough that it should be tested carefully.

## RPC Option

If complete API p50 remains above 1000ms, use a Postgres function:

- input: `p_user_id`, `p_reward_intent_id`, `p_provider`, `p_provider_reward_id`, `p_rewarded`, `p_outcome`
- atomically claim `ad_reward_logs`
- validate pending/completed replay
- update `player_states`
- update `player_records`
- delete `owned_weapons` for `sellBonus`
- write completed `reward_result`
- return lightweight result + patch

This would reduce multiple Supabase HTTP round trips to one database round trip while preserving idempotency.
