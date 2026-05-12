# Sprint 17 Ad Reward System

## Flow

1. Client calls `POST /api/ad/reward/request` with `actionId` and `rewardType`.
2. Server validates the player state and writes a pending `ad_reward_logs` row.
3. Client loads the selected ad provider and shows the rewarded ad.
4. Provider returns `completed`, `canceled`, or `failed`.
5. Client calls `POST /api/ad/reward/complete` for every provider result.
6. Server grants the reward only when the provider result is rewarded, otherwise it stores `failed` or `canceled`.
7. Completed intents replay the stored result without granting again.

The client never receives authority to grant rewards directly.

## Reward Types

- `forgeCollectDouble`: stores the expected forge collect amount at request time. Complete grants the 2x amount and advances `forge_last_collected_at`.
- `sellBonus`: stores a weapon and sale snapshot. Complete sells the weapon with +30% gold. Ranking value still uses the non-ad weapon value.
- `destructionScrapDouble`: enum and SQL support are ready. Beta UI is hidden until destruction actions have a persisted related action payload.
- `dailyTranscendStoneBox`: enum and SQL support are ready for a later Sprint.

## APIs

### POST `/api/ad/reward/request`

Request:

```json
{
  "actionId": "uuid",
  "rewardType": "forgeCollectDouble",
  "targetWeaponInstanceId": "optional"
}
```

Server request checks:

- validates `rewardType`
- expires stale pending intents before creating a new one
- enforces daily limits from completed `ad_reward_logs`
- enforces cooldowns from the latest attempt time
- reuses an active pending intent instead of creating duplicates
- blocks `sellBonus` duplicates by `targetWeaponInstanceId`
- keeps `destructionScrapDouble` disabled for this beta

Response:

```json
{
  "rewardIntentId": "uuid",
  "rewardType": "forgeCollectDouble",
  "provider": "mock",
  "expiresAt": "...",
  "displayReward": "제련의 불씨 120개",
  "clientAdConfig": {
    "provider": "mock",
    "mockDelayMs": 700
  }
}
```

### POST `/api/ad/reward/complete`

Request:

```json
{
  "rewardIntentId": "uuid",
  "completeActionId": "uuid",
  "providerResult": {
    "provider": "mock",
    "rewarded": true,
    "outcome": "completed",
    "providerRewardId": "mock_uuid"
  }
}
```

Close and failure results use `rewarded: false` with `outcome: "canceled"` or `outcome: "failed"`. The server records the terminal status and returns no reward.

### GET `/api/ad/reward/status`

Returns server-calculated status by reward type:

```json
{
  "serverTime": "...",
  "rewards": {
    "forgeCollectDouble": {
      "rewardType": "forgeCollectDouble",
      "dailyUsed": 3,
      "dailyLimit": 10,
      "cooldownRemainingMs": 120000,
      "available": false,
      "message": "2분 후 다시 이용 가능"
    }
  }
}
```

## DB

`docs/server/sql/005_ad_reward_logs.sql` creates `ad_reward_logs` with:

- `reward_status`: `pending`, `processing`, `completed`, `expired`, `failed`, `canceled`
- unique `(user_id, action_id)`
- nullable unique `provider_reward_id`
- select-own RLS
- no client insert/update/delete policies

`docs/server/sql/006_ad_reward_limits.sql` adds indexes used by daily limit, cooldown, and active pending lookups.

## Limits

Configured in `src/data/balance.ts`:

- `forgeCollectDouble`: daily 10, cooldown 3 minutes.
- `sellBonus`: daily 20, no cooldown, one active/completed reward per weapon instance.
- `destructionScrapDouble`: reserved daily 10, disabled in this beta until persisted destruction action linking is shipped.
- `dailyTranscendStoneBox`: disabled.

## Providers

Files:

- `src/lib/ads/adProvider.ts`
- `src/lib/ads/mockAdProvider.ts`
- `src/lib/ads/googleWebRewardedProvider.ts`
- `src/lib/ads/adRewardApi.ts`

Env:

```bash
NEXT_PUBLIC_AD_PROVIDER=disabled
NEXT_PUBLIC_GOOGLE_REWARDED_AD_UNIT_ID=
```

Provider behavior:

- `mock`: development/QA provider. In non-production it shows a result chooser with `광고 완료`, `광고 닫기`, and `광고 실패`.
- `googleWeb`: loads Google Publisher Tag in the browser and uses the rewarded out-of-page slot events.
- `disabled`: returns a clear failure and never grants rewards.

Production safety:

- `mock` is private local QA only. Production builds force `NEXT_PUBLIC_AD_PROVIDER=mock` to behave as `disabled`.
- Vercel public beta should use `disabled` until a real rewarded unit is ready.
- For real ad QA, set `NEXT_PUBLIC_AD_PROVIDER=googleWeb` and `NEXT_PUBLIC_GOOGLE_REWARDED_AD_UNIT_ID=<rewarded unit id>`, then redeploy.

Provider selection:

- `NEXT_PUBLIC_AD_PROVIDER=mock`: force mock only outside production.
- `NEXT_PUBLIC_AD_PROVIDER=googleWeb`: force Google Web when a unit id exists.
- `NEXT_PUBLIC_AD_PROVIDER=disabled`: turn ad rewards off.
- unset in local mode: mock outside production, disabled in production builds.
- unset in beta mode: Google Web first, disabled when the unit id is missing.

Legacy `NEXT_PUBLIC_GOOGLE_AD_UNIT_ID` is still accepted, but new environments should use `NEXT_PUBLIC_GOOGLE_REWARDED_AD_UNIT_ID`.

## Mode Difference

local mode:

- Existing Mock convenience rewards remain available.
- No server ad reward log is required.

beta mode:

- Forge 2x and sell +30% must pass through `ad_reward_logs`.
- Ad close/failure calls complete with a non-rewarded provider result and does not grant rewards.
- Server snapshots are applied after completion.
- Public production beta must not use `mock`.

## Google Web Notes

`googleWebRewardedProvider` is client-only and guards every browser API access. It loads:

```text
https://securepubads.g.doubleclick.net/tag/js/gpt.js
```

The provider listens for:

- `rewardedSlotReady`: calls `makeRewardedVisible()`.
- `rewardedSlotGranted`: marks the reward as earned.
- `rewardedSlotClosed`: completes only if a grant event happened; otherwise canceled.
- `slotRenderEnded` with `isEmpty`: failed/no fill.

Development logs expose these states with `[ads.googleWeb]`: `script_loading`, `script_loaded`, `provider_unavailable`, `missing_ad_unit_id`, `no_fill`, `ad_ready`, `ad_shown`, `rewarded`, `closed_without_reward`, and `error`.

No Google ad unit, no fill, or an unapproved unit should fail safely. That is expected during beta setup.

Granting rule:

- The client calls the reward-granting complete path only after the provider result has `rewarded: true`.
- Close, no fill, missing unit, and provider errors are sent as non-rewarded terminal results only to mark `ad_reward_logs` as `canceled` or `failed`; they never grant rewards.

## QA

1. Set `NEXT_PUBLIC_GAME_MODE=beta`.
2. For private local QA only, set `NEXT_PUBLIC_AD_PROVIDER=mock`; for public beta use `disabled` until a real unit is ready.
3. Login with Google.
4. Try Forge 2x and choose `광고 완료`; confirm `completed` and doubled forge ember.
5. Repeat within 3 minutes; confirm request is blocked by cooldown.
6. Choose `광고 닫기`; confirm `canceled` and no reward.
7. Choose `광고 실패`; confirm `failed` and no reward.
7. Try Sell +30%; confirm the weapon is removed, gold uses the ad sale value, and ranking value uses the non-ad weapon value.
8. Set `NEXT_PUBLIC_AD_PROVIDER=googleWeb` without a unit id; confirm the app shows the unavailable message and does not grant rewards.
9. Add `NEXT_PUBLIC_GOOGLE_REWARDED_AD_UNIT_ID`; confirm the GPT script loads and provider events are attempted.

## Sprint 20 Google Web QA

1. Set `NEXT_PUBLIC_GAME_MODE=beta`.
2. For private local QA only, set `NEXT_PUBLIC_AD_PROVIDER=mock`, then verify complete/close/failure paths.
3. For public beta before ad approval, set `NEXT_PUBLIC_AD_PROVIDER=disabled`; confirm ad buttons show unavailable state and no reward is granted.
4. For Google Web QA, set `NEXT_PUBLIC_AD_PROVIDER=googleWeb` and `NEXT_PUBLIC_GOOGLE_REWARDED_AD_UNIT_ID`.
5. Login with Google.
6. Try Forge 2x; confirm `pending -> processing -> completed` and doubled forge ember only when a rewarded grant occurs.
7. Repeat within 3 minutes; confirm request is blocked by cooldown.
8. Close/no fill/failure; confirm `canceled` or `failed` and no reward.
9. Try Sell +30%; confirm the weapon is removed, gold uses the ad sale value, and ranking value uses the non-ad weapon value only after rewarded completion.
10. Set `NEXT_PUBLIC_AD_PROVIDER=googleWeb` without a unit id; confirm the app shows the unavailable message and does not grant rewards.
11. Resend the same complete payload for a completed `rewardIntentId`; confirm replay returns the stored result and does not grant a second reward.

SQL checks:

```sql
SELECT id, user_id, reward_type, reward_status, action_id, provider, requested_at, completed_at, reward_result
FROM ad_reward_logs
ORDER BY created_at DESC
LIMIT 20;

SELECT user_id, gold, forge_ember, transcend_stone, forge_level, updated_at
FROM player_states
ORDER BY updated_at DESC
LIMIT 10;

SELECT id, user_id, weapon_id, enhance_level, transcend_level, durability, created_at
FROM owned_weapons
ORDER BY created_at DESC
LIMIT 20;
```

## Remaining Work

- Add server-side verification or SSV callback when the provider supports it.
- Add app AdMob integration in a later mobile/PWA Sprint.
- Connect `destructionScrapDouble` to a persisted destruction action payload.
