# Sprint 18-C Mobile Performance Diagnosis

This sprint adds diagnostics rather than broad optimization. The goal is to separate auth progression, API latency, modal mount cost, deferred server snapshot sync, tab switching, and render count issues.

## 1. iPhone `checking_session` Stuck Candidates

- If the screen remains `checking_session 0ms -`, the most likely issue is that client effects/timers are not progressing after the SSR/client initial render. In that case the Supabase call may not even have started.
- If elapsed time advances and `lastAuthEvent` reaches `getSession called`, then AuthGate mounted and the issue is likely Supabase session/cookie/origin related.
- If elapsed time advances and `getSession timeout` appears, `supabase.auth.getSession()` did not resolve within the 10 second watchdog.
- If `getSession resolved` appears with `hasSession: false`, the app should move to `LoginScreen`; check Supabase redirect URL and cookies.
- If iPhone uses an internal LAN URL, Supabase Redirect URLs may need `http://PC_IP:3000/auth/callback` for local production OAuth testing.

## 2. AuthGate Stage Logs Added

Development logs use the `[diag:auth]` prefix. The overlay shows:

- `gameMode`
- `origin`
- short user agent
- auth stage and elapsed ms
- auth attempt
- last auth event
- last auth error
- bootstrap elapsed ms
- last API name/elapsed/error
- render tick
- current screen

Expected auth event order:

1. `component_mounted`
2. `checking_session started`
3. `getSession called`
4. `getSession resolved` or `getSession rejected` or `getSession timeout`
5. `bootstrap started`
6. `bootstrap resolved` or `bootstrap rejected`
7. `stage changed: ready`

## 3. Enhance Timing Breakdown

Metrics added:

- `enhanceTotalMs`
- `enhanceApiMs`
- `enhanceAnimationWaitMs`
- `enhanceModalOpenMs`
- `enhanceStoreSyncMs`
- `enhanceRenderCountDuringAction`

Interpretation:

- High `enhanceApiMs`: server/API/Supabase latency.
- Low API time but high `enhanceModalOpenMs`: modal mount/effect/image decode issue.
- High `enhanceStoreSyncMs`: snapshot mapping/store replacement issue.
- High render count: Zustand selectors or component tree rerender issue.

## 4. Ad Reward Timing Breakdown

Metrics added:

- `adCompleteApiMs`
- `adRewardModalOpenMs`
- `adRewardStoreSyncMs`
- `adStatusRefreshMs`
- `renderCountDuringAdReward`

Interpretation:

- High `adCompleteApiMs`: reward complete route or Supabase mutation latency.
- High modal open time: modal/effect mount cost.
- High store sync time: full snapshot application cost.
- High ad status fetch time: ad status should stay cached/background and not block tab entry.

## 5. Tab Timing Breakdown

Metrics added:

- `tabSwitchMs` via `tabSwitchElapsedMs`
- `tabTarget`
- `backgroundLoadedFromCache`
- `rankingCacheStatus`
- `rankingFetchMs`
- `adStatusCacheHit`
- `adStatusFetchMs`
- screen render counts

Ranking cache TTL is 90 seconds. Ad reward status cache TTL is 60 seconds and refreshes during idle time.

## 6. Store Render Count Observation

Development render counters were added for:

- `AuthGate`
- `GameRoot`
- `TopResourceBar`
- `BottomTabs`
- `ModalRoot`
- `BlacksmithScreen`
- `WeaponShopScreen`
- `AutoForgeScreen`
- `InventoryScreen`
- `RankingScreen`
- `WeaponCard`

Use the overlay `renders:` line to compare before/after one action. If `WeaponCard` climbs sharply during enhance or ad complete while not on shop/inventory, a broad store update or mounted tree subscription is too wide.

## 7. Dev/Prod Difference

Run dev:

```bash
npm run dev
```

Run production local:

```bash
npm run build
npx next start -H 0.0.0.0 -p 3000
```

On iPhone, open `http://PC_IP:3000`. For beta OAuth on the LAN URL, add `http://PC_IP:3000/auth/callback` to Supabase Redirect URLs.

Interpretation:

- Dev slow, production local fine: development server/HMR overhead.
- Production local slow too: app render/store sync/image decode issue.
- iPhone only auth stuck: mobile cookie/origin/hydration/effect issue.

## 8. Most Likely Bottlenecks Top 5

1. `checking_session 0ms -`: client effects are not running or hydration is blocked before AuthGate effects.
2. Result modal stutter: modal/effect/image decode plus store sync occurring close together.
3. Store sync cost: server snapshots replace owned weapons/player state/records and can trigger broad rerenders.
4. Ranking/ad status fetches: if cache misses happen on tab entry, they can add perceived latency.
5. Weapon cards: shop/inventory card grids can dominate render counts if mounted or invalidated often.

## 9. Immediate Fix Candidates After Measurement

- If auth overlay stays static at `0ms -`, inspect hydration/runtime errors and mobile browser console first.
- If `getSession timeout` appears, test Supabase cookies/origin/redirect URL and switch session check to a lighter client bootstrap path.
- If `enhanceStoreSyncMs` or `adRewardStoreSyncMs` is high, replace full snapshot application with action-specific minimal patches.
- If `ModalRoot` render count spikes, isolate modal state from game snapshot updates further.
- If `WeaponCard` render count spikes during unrelated actions, split mounted screens or memoize derived inventory/shop data more aggressively.

## 10. Next Sprint Proposal

Run the iPhone production local test, capture overlay values for one auth attempt, three enhances, one ad complete, and ten tab switches. Then prioritize one surgical fix based on the highest measured segment instead of applying broad optimizations.
