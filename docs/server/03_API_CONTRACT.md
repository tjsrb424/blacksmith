# API Contract

All mutating requests require `playerId`, `actionId`, and `clientCreatedAt`. Server responses must contain server-calculated resource and weapon state. `clientCreatedAt` is telemetry only.

## POST /api/game/enhance

Request:

```json
{ "playerId": "p1", "weaponInstanceId": "w1", "actionId": "a1", "clientCreatedAt": "2026-05-09T00:00:00.000Z" }
```

Response:

```json
{ "actionId": "a1", "result": { "type": "success", "beforeLevel": 7, "afterLevel": 8 }, "player": {}, "ownedWeapons": [], "serverCreatedAt": "..." }
```

Server validation:

- player owns weapon
- weapon is not destroyed or already max enhance
- player has enough ember
- `actionId` is new or idempotent duplicate
- server rolls RNG and applies cost/durability/destruction

Client should not trust: enhance result, cost, durability, destruction, resources.

Failure cases: insufficient ember, missing weapon, max level, duplicate action mismatch, rate limited.

## POST /api/game/transcend

Request:

```json
{ "playerId": "p1", "weaponInstanceId": "w1", "actionId": "a2", "clientCreatedAt": "2026-05-09T00:00:00.000Z" }
```

Response:

```json
{ "actionId": "a2", "result": { "type": "fail", "beforeDurability": 3, "afterDurability": 2 }, "player": {}, "ownedWeapons": [], "serverCreatedAt": "..." }
```

Server validation:

- weapon is eligible for transcend
- player has enough transcend stones
- server rolls RNG
- durability/destruction is server-applied

Client should not trust: transcend result, stone cost, durability, destruction, resources.

Failure cases: insufficient stones, not eligible, max star, duplicate action mismatch, rate limited.

## POST /api/game/sell

Request:

```json
{ "playerId": "p1", "weaponInstanceId": "w1", "adBonusRequested": false, "actionId": "a3", "clientCreatedAt": "2026-05-09T00:00:00.000Z" }
```

Response:

```json
{ "actionId": "a3", "saleGold": 12000, "rankingValue": 15000, "player": {}, "ownedWeapons": [], "serverCreatedAt": "..." }
```

Server validation:

- player owns weapon
- locked weapons cannot be sold
- sale price and ranking value are recalculated
- ad bonus is verified before applying

Client should not trust: sale price, ad bonus, ranking value, resource total.

Failure cases: missing weapon, locked weapon, invalid ad reward, duplicate action mismatch.

## POST /api/game/buy

Request:

```json
{ "playerId": "p1", "weaponId": "iron_sword", "actionId": "a4", "clientCreatedAt": "2026-05-09T00:00:00.000Z" }
```

Response:

```json
{ "actionId": "a4", "weapon": {}, "player": {}, "ownedWeapons": [], "serverCreatedAt": "..." }
```

Server validation:

- weapon definition exists for current data version
- player has enough gold
- server creates weapon instance with initial durability/state

Client should not trust: price, owned weapon state, resource total.

Failure cases: insufficient gold, unknown weapon id, inventory cap, duplicate action mismatch.

## POST /api/game/forge/collect

Request:

```json
{ "playerId": "p1", "adBonusRequested": true, "actionId": "a5", "clientCreatedAt": "2026-05-09T00:00:00.000Z" }
```

Response:

```json
{ "actionId": "a5", "gainedEmber": 300, "basePending": 150, "adBonusGranted": true, "player": {}, "ownedWeapons": [], "serverCreatedAt": "..." }
```

Server validation:

- pending forge amount uses server time
- forge level is authoritative
- ad bonus token is valid and unused

Client should not trust: elapsed time, pending ember, ad result.

Failure cases: no pending reward, invalid ad token, duplicate action mismatch, rate limited.

## POST /api/ranking/submit

Request:

```json
{ "playerId": "p1", "weaponInstanceId": "w1", "seasonId": "2026-W19", "actionId": "a6", "clientCreatedAt": "2026-05-09T00:00:00.000Z" }
```

Response:

```json
{ "status": "accepted", "seasonId": "2026-W19", "actionId": "a6", "serverRankingValue": 150000, "serverRank": 12 }
```

Server validation:

- player owns weapon
- season is active
- action id is valid and belongs to player
- ranking value is recalculated from authoritative weapon state
- duplicate submit is idempotent

Client should not trust: ranking value, rank, best weapon state.

Failure cases: invalid season, missing weapon, duplicate, stale action, rate limited.

## GET /api/ranking/weekly

Query:

```text
category=weeklyStrongestWeapon&seasonId=2026-W19&playerId=p1
```

Response:

```json
{ "category": "weeklyStrongestWeapon", "seasonId": "2026-W19", "rows": [], "playerRank": null, "serverCalculatedAt": "..." }
```

Server validation:

- category is supported
- season exists
- rows are sorted by server score and tie-break rules

Client should not trust: cached local ranking rows as verified server state.

Failure cases: invalid category, unknown season, service unavailable.

## GET /api/ranking/world

Query:

```text
playerId=p1
```

Response:

```json
{ "highestWeapon": {}, "bestTranscend": {}, "bestSale": {}, "mostEnhanceAttempts": {}, "mostTranscendSuccesses": {}, "destroyedLegend": {}, "serverCalculatedAt": "..." }
```

Server validation:

- world record rows are generated from accepted actions only
- display snapshots are sanitized

Client should not trust: local world records as server records.

Failure cases: service unavailable, stale materialized view.

## GET /api/player/me

Response:

```json
{ "playerId": "p1", "displayName": "name", "resources": { "gold": 0, "ember": 0, "transcendStone": 0 }, "records": {}, "weeklySeasonStats": {}, "bestWeaponSnapshot": null }
```

Server validation:

- player identity comes from auth/session, not only query string
- resources and records are server state

Client should not trust: LocalStorage player state in betaServerMode.

Failure cases: unauthorized, missing player, migration required.
