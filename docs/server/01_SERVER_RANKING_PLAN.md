# Sprint 12 Server Ranking Plan

## Current Local Save Structure

- Runtime state is held in `src/store/gameStore.ts` with Zustand.
- Persistent save uses LocalStorage through `zustand/middleware` and `SAVE_STORAGE_KEY = world-best-blacksmith-save-v1`.
- Persisted shape is `SaveDataV1` in `src/types/game.ts`.
- Local ranking values are derived from `OwnedWeapon`, `WeaponDefinition`, and balance constants in `src/lib/ranking.ts`.
- Mock ranking data lives in `src/data/mockRankings.ts`.
- Ranking UI now reads through `RankingAdapter` instead of directly reading mock tables.

## Mode Split

- `NEXT_PUBLIC_GAME_MODE=local` or unset: LocalStorage play, mock ranking adapter.
- `NEXT_PUBLIC_GAME_MODE=beta`: server ranking adapter first, local mock fallback on API failure.
- `NEXT_PUBLIC_SERVER_API_BASE_URL`: optional API host. Empty value means same origin `/api`.

## Server Authoritative Model

Recommended tables or collections:

- `players`: player id, display name, account metadata, ban state.
- `player_resources`: gold, ember, transcend stone, server updated timestamp.
- `weapon_definitions`: immutable weapon catalog copied from game data version.
- `owned_weapons`: weapon instance id, owner id, weapon id, enhance level, transcend level, durability, locked, created at.
- `game_actions`: action id, player id, action type, request hash, result, created at.
- `ranking_submissions`: player id, season id, weapon instance id, action id, status, server ranking value.
- `weekly_ranking_scores`: season id, category, player id, score, source action id.
- `world_records`: record type, player id, weapon snapshot, server score, source action id.
- `seasons`: season id, starts at, ends at, status.

## Trusted vs Display Data

Client display-only data:

- button input and selected weapon instance id
- animation and sound state
- local fallback rows
- optional display hints in ranking candidate payload

Server must not trust:

- gold, ember, transcend stone
- enhance or transcend result
- sale price
- ranking value
- best weapon record
- total sales, success counts, failure counts
- client timestamps for ordering or cooldowns

## Ranking Submission Flow

1. Client sends `RankingCandidateSubmitPayload`.
2. Server checks player ownership of `weaponInstanceId`.
3. Server checks `actionId` exists, belongs to the same player, and is not replayed.
4. Server reads the authoritative weapon state after the action.
5. Server recalculates ranking value from weapon definition, enhance level, transcend level, and durability.
6. Server writes or updates weekly/world ranking rows using idempotent logic.
7. Server returns accepted, duplicate, rejected, or queued status.

## Server Calculated Values

- enhance success or failure
- enhance cost and resource deduction
- durability loss on failure
- destruction result and scrap reward
- transcend success or failure
- transcend stone cost
- buy price and ownership creation
- sale price and sale record
- forge collect amount and ad bonus eligibility
- ranking value
- weekly ranking score
- world record score

## Client Integration State

Implemented code surface:

- `src/lib/ranking/rankingAdapter.ts`
- `src/lib/ranking/mockRankingAdapter.ts`
- `src/lib/ranking/serverRankingAdapter.ts`
- `src/lib/server/rankingApi.ts`
- `src/lib/server/playerApi.ts`
- `src/lib/server/gameActionApi.ts`
- `src/types/server.ts`

Next server step:

- Implement route handlers or external API endpoints matching `03_API_CONTRACT.md`.
- Move game actions from local-only store mutations to server-authoritative request/response reconciliation in beta mode.
