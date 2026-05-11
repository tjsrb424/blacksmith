# Beta Balance Pass 01

Sprint 16 focuses on the ad reward loop and the first balance pass around early enhancement, forge income, sales, and ad bonuses.

## Goals

- First 3 minutes should allow roughly 3-5 starter enhancement attempts.
- First sale should happen without a long wait.
- Forge ember should not block the early loop.
- +8 and above should feel risky because failures now threaten durability.
- +15 should stay a short-session stretch goal.
- Ads should feel useful, not mandatory.

## Changes

### Enhancement Cost

| Target Level | Before | After | Reason |
| --- | ---: | ---: | --- |
| +1 to +3 | 0.05x base | 0.045x base | Slightly faster first loop. |
| +4 to +6 | 0.08x base | 0.075x base | Smooths the middle of the starter weapon curve. |
| +7 to +9 | 0.12x base | 0.13x base | Starts the risk band with a small cost increase. |
| +10 to +12 | 0.18x base | 0.21x base | Makes late enhancement investment more deliberate. |
| +13 to +15 | 0.28x base | 0.34x base | Keeps +15 from becoming too easy in beta. |

### Enhancement Success Rate

| Target Level | Before | After | Reason |
| --- | ---: | ---: | --- |
| +6 | 78% | 80% | Reduces mid-early frustration. |
| +7 | 70% | 72% | Slightly smoother before durability risk begins. |
| +8 | 60% | 58% | Risk band starts earlier. |
| +9 | 50% | 47% | Adds tension after +8. |
| +10 | 40% | 36% | Late curve gets steeper. |
| +11 | 32% | 29% | Late curve gets steeper. |
| +12 | 25% | 22% | Late curve gets steeper. |
| +13 | 18% | 16% | Keeps +15 rare. |
| +14 | 12% | 10% | Keeps +15 rare. |
| +15 | 8% | 7% | Keeps +15 rare. |

### Sale Recovery

| Enhance Level | Before | After | Reason |
| --- | ---: | ---: | --- |
| +0 | 0.70x | 0.75x | Makes early mistakes less punishing. |
| +1 | 0.90x | 0.95x | Improves early sale feedback. |
| +2 | 1.10x | 1.15x | Improves early sale feedback. |
| +3 | 1.30x | 1.35x | Helps first sale feel worthwhile. |
| +4 | 1.60x | 1.65x | Helps next-buy progress. |
| +5 | 2.00x | 2.05x | Helps next-buy progress. |

The ad sale multiplier stays at +30%. Ranking value remains independent from the ad sale bonus.

### Forge

| Item | Before | After | Reason |
| --- | ---: | ---: | --- |
| Lv.1 per minute | 10 | 12 | First 3 minutes now yields 36 ember from forge-only income. |
| Lv.2 per minute | 15 | 18 | Keeps upgrade value aligned. |
| Lv.3 per minute | 22 | 26 | Keeps upgrade value aligned. |
| Lv.4 per minute | 32 | 38 | Keeps upgrade value aligned. |
| Lv.5 per minute | 45 | 54 | Keeps upgrade value aligned. |
| Lv.6 per minute | 62 | 74 | Keeps upgrade value aligned. |
| Lv.7 per minute | 85 | 102 | Keeps upgrade value aligned. |
| Lv.8 per minute | 115 | 138 | Keeps upgrade value aligned. |
| Lv.9 per minute | 155 | 186 | Keeps upgrade value aligned. |
| Lv.10 per minute | 200 | 240 | Keeps upgrade value aligned. |
| Upgrade cost formula | `2000 * 1.8^(level-1)` | `1800 * 1.75^(level-1)` | Makes the first upgrade less distant while preserving scaling. |

Forge 2x ad reward stays at 2x. This is strong, but it is optional because base production now covers the early loop more comfortably.

## Expected Effects

- Starter +1 to +5 should feel faster and produce a useful first sale.
- +8 remains the main transition point because failures can reduce durability.
- +10 to +15 requires more sessions or more sale/forge cycles.
- Sell +30% and Forge 2x help accelerate but are not required to progress.

## Helper

`src/lib/balance/betaBalanceSim.ts` exposes `summarizeBetaBalance()` for development checks:

- early 10-minute starter attempt estimate
- expected attempts to +8 and +15
- starter sale values around +3 and +5
- forge collection amounts by common intervals

## Additional Checks Needed

- Run a 5-10 minute beta session and record actual enhancement attempts, sale timing, and forge collects.
- Compare mock ad complete vs close/failure outcomes in `ad_reward_logs`.
- Watch whether +15 appears too often from starter weapon attempts.
- Review whether Forge upgrade costs need another pass after server authoritative upgrade lands.
