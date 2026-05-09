# Sprint 13-B Server Actions Implementation

## Implemented APIs

- `POST /api/game/buy`
- `POST /api/game/enhance`
- `POST /api/game/transcend`
- `POST /api/game/sell`
- `POST /api/game/forge/collect`
- `POST /api/ranking/submit`

All endpoints require an authenticated Supabase session. The server uses the session user id and ignores any client-supplied user id.

## Request Pattern

Common fields:

```json
{
  "actionId": "client-generated-uuid",
  "clientCreatedAt": "2026-05-09T00:00:00.000Z"
}
```

Action-specific fields:

- buy: `weaponId`
- enhance: `weaponInstanceId`
- transcend: `weaponInstanceId`
- sell: `weaponInstanceId`, `sellMode`
- forge collect: `collectMode`
- ranking submit: `weaponInstanceId`, `seasonId`

## Response Pattern

```json
{
  "actionId": "...",
  "actionType": "enhance",
  "status": "applied",
  "snapshot": {},
  "display": {}
}
```

`snapshot` is the server state used to sync the beta client store. `display` contains only UI result data for modals, sounds, and animations.

## Server Validation

- Auth is required before every action.
- Weapon ownership is checked against `owned_weapons.user_id`.
- Weapon definitions are loaded from the server bundle.
- Costs, success rates, sale values, forge production, scrap rewards, ranking values, and record updates are server-calculated.
- Client gold, ember, stone, success result, sale value, ranking value, and time are ignored.

## Idempotency

`game_action_logs.action_id` is checked before processing.

1. If the action id already has a completed result for the same user, that result is returned as `status: "replayed"`.
2. If it belongs to another user, the request is rejected.
3. If it is pending, the request is rejected as an in-progress conflict.
4. New actions insert a pending log before mutation and update the log with the final response.

Run `docs/server/sql/003_action_indexes.sql` to ensure the upsert/idempotency indexes exist.

## Server RNG

Enhance and transcend use Node `crypto.randomInt` through `serverRandom.ts`.

Scrap reward random rolls also use server-side randomness. The client never sends success/failure or reward rolls.

## Ranking Updates

- Strongest weapon updates `player_records`, `weekly_rankings`, and `world_records`.
- Sales update `player_records`, weekly sales ranking, and world sale record.
- Enhancement and transcend success counts update weekly category rows.
- Ranking value excludes ad sale bonus.

## Mode Difference

local mode:

- Existing LocalStorage game actions remain active.
- Mock ranking remains active.
- Login is not required.

beta mode:

- AuthGate requires login.
- Core actions call server APIs.
- Server response snapshot is applied to the Zustand store.
- Local ad reward shortcuts are disabled.
- Forge upgrade is blocked until it receives a server action.

## Remaining Security Work

- Add database transactions or RPC wrappers around multi-step mutations.
- Add rate limits per user/IP.
- Add stricter action log pending recovery.
- Add server-side ad verification for reward modes.
- Add full server authoritative forge upgrade.
- Add admin monitoring for suspicious action rates.

## Next Sprint

- Implement transactional RPCs for each game action.
- Add ranking list APIs backed by Supabase tables.
- Add server-side inventory lock/unlock action.
- Add audit dashboards for `game_action_logs`.
