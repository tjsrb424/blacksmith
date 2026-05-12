# Sprint 18-F Server Action Latency

Recent production-local overlay readings:

- enhance api: 2170-3250ms
- enhance modal: 13-28ms
- store sync: 0-2ms
- ad complete api: 3580-4050ms
- ad modal: 12-23ms
- bootstrap: 1200-3000ms
- ad status fetch: 940-1200ms
- tab switch: 40-124ms

The bottleneck is server API round-trip count and payload size, not modal render, tab switch, or store sync.

## Changes

- `ServerGameActionResponse.snapshot` is now optional.
- Hot paths can return `patch` instead of a full `BetaPlayerSnapshot`.
- Enhance now returns changed/removed weapon plus resource and record fields.
- Ad reward complete now returns resource/record patch data for forge collect and sell bonus.
- Normal sell also returns a patch and avoids rebuilding a full snapshot.
- Client store can apply either a full snapshot or a patch.
- Enhance/ad reward modal opening remains lightweight, and patch sync can run deferred.
- Existing-user bootstrap now performs parallel reads first and returns immediately when all rows exist.
- Ad reward status now reads recent reward logs once instead of doing per-type count/latest/pending queries.

## Expected Effect

This removes the owned-weapons list query from enhance and ad reward complete critical paths, and removes full snapshot JSON serialization from those responses.

The largest remaining costs are still:

- Supabase auth user lookup
- idempotency read/write in `game_action_logs` or `ad_reward_logs`
- player/weapon/state/record reads
- mutation round trips
- ranking/world record updates

## RPC Threshold

If p50 remains above the target after this patch, the next meaningful step is a Postgres RPC for hot actions:

- `perform_enhance_action(p_user_id, p_action_id, p_weapon_instance_id, p_client_created_at)`
- claim/replay action id inside the transaction
- lock `player_states` and `owned_weapons` with `FOR UPDATE`
- perform RNG and mutations in one DB round trip
- return result plus patch

Expected benefit: fewer HTTP round trips and transactional locking. Main risk: duplicating game math in SQL or designing trusted server inputs carefully.
