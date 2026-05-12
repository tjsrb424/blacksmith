# Sprint 18-D Server Latency Optimization

Production-local measurements before this pass:

- bootstrap: 933ms
- tab switch: 40ms
- store sync: 0-2ms
- enhance modal: 13-28ms
- ad status fetch: 1159ms
- enhance total: 3284ms
- enhance api: 3251ms
- ad complete api: 4056ms

The main bottleneck is server/API latency, not tab switching, modal mount, or Zustand store sync.

## Step Latency Logs

Development server logs now include step timers for:

- `/api/game/enhance`
- `/api/ad/reward/complete`

Any step at or above 1000ms is logged with `console.warn`. Production does not print step logs.

Expected enhance steps:

- `auth user 조회`
- `actionId claim / replay check`
- `profile 조회`
- `player_state 조회`
- `player_records 조회`
- `owned_weapon 조회`
- `비용/확률 계산`
- `RNG`
- `owned_weapon update/delete`
- `player_state update`
- `player_records update`
- `weekly_rankings/world_records update`
- `ranking counters update`
- `snapshot owned_weapons 조회`
- `response result/patch 생성`
- `action_log complete update`
- `response serialize`
- `enhance total`

Expected ad reward complete steps:

- `auth user 조회`
- `reward intent 조회`
- `pending/processing/completed 상태 claim`
- `profile 조회`
- `player_state 조회`
- `player_records 조회`
- `owned_weapon 조회` for `sellBonus`
- `reward 지급 계산`
- `player_state update`
- `owned_weapon delete` for `sellBonus`
- `player_records update`
- `ranking/world record update` for `sellBonus`
- `snapshot owned_weapons 조회`
- `server result/patch 생성`
- `ad_reward_logs completed update`
- `response serialize`
- `ad reward complete total`

## Applied Optimizations

- Initial profile/state/record/weapon reads are parallelized where they are independent.
- `owned_weapons.update(...).select("*").single()` was removed from enhance. The server constructs the changed weapon row from the already loaded row and the applied patch.
- Action responses still include a full `snapshot` for the existing client contract, but the snapshot is now built from known rows plus one `owned_weapons` list query instead of calling `bootstrapPlayer()` again.
- `game_action_logs` replay lookup now selects only `user_id,result`.
- `ad_reward_logs` complete lookup now selects the columns required for completion/replay instead of `*`.
- Ranking counter updates that are independent run in parallel.
- Weekly enhancement ranking updates are skipped on failed enhance attempts because the success count does not change.
- `world_records` pre-check selects only `value`.

## Remaining Bottleneck Candidates

- `upsertWorldRecord` still needs a read-before-write check. Under high latency this can dominate ranking-related steps.
- `game_action_logs` idempotency still costs at least one read and one write on applied actions.
- Returning a full player snapshot still requires an owned weapon list query and serializes all owned weapons.
- Supabase HTTP round trips remain the largest cost. Multiple independent calls are now parallelized, but the mutation sequence is still multi-call.

## RPC Migration Notes

To target sub-500ms action latency consistently, move hot actions into Postgres RPC.

`perform_enhance_action` inputs:

- `p_user_id uuid`
- `p_action_id text`
- `p_weapon_instance_id uuid`
- `p_client_created_at timestamptz` optional

RPC responsibilities:

- Claim or replay `game_action_logs` by `action_id`.
- Lock `player_states` and target `owned_weapons` rows with `FOR UPDATE`.
- Validate ownership, resources, durability, max level, and weapon definition inputs.
- Calculate cost, success rate, durability loss, scrap, and result.
- Apply `player_states`, `owned_weapons`, and `player_records` mutations transactionally.
- Store a replayable action result.
- Return lightweight result plus changed rows.

Ranking handling options:

- Keep strongest/sales/world ranking inside the RPC for immediate consistency.
- Or return the ranking candidate and process ranking updates after the critical mutation path. This lowers perceived latency but requires an accepted consistency tradeoff.

Risks:

- Game math must be duplicated in SQL or passed as trusted server inputs.
- RPC row locking needs careful deadlock ordering.
- Debugging server action behavior moves from TypeScript logs into SQL notices/tests.

## OAuth Internal IP Testing

The app-side OAuth `redirectTo` uses `window.location.origin + "/auth/callback"`, so an iPhone opened on `http://192.168.x.x:3000` should request that same origin.

For local production beta OAuth on an internal IP, configure:

Supabase Redirect URLs:

- `http://192.168.x.x:3000`
- `http://192.168.x.x:3000/auth/callback`
- `http://192.168.x.x:3000/**`

Google Cloud Authorized JavaScript origins:

- `http://192.168.x.x:3000`

Google Authorized redirect URI:

- `https://<project-ref>.supabase.co/auth/v1/callback`

If Google still returns to `localhost:3000`, inspect Supabase Authentication URL Configuration and the exact `redirectTo` request sent by `signInWithOAuth`.
