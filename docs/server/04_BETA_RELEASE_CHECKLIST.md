# Beta Release Checklist

## Client Mode

- Default mode is local when `NEXT_PUBLIC_GAME_MODE` is unset.
- Set `NEXT_PUBLIC_GAME_MODE=beta` only for builds that should attempt server ranking.
- Set `NEXT_PUBLIC_SERVER_API_BASE_URL` when the API is not same-origin.
- Confirm beta fallback copy clearly says Mock/local ranking is being shown.

## Ranking

- Weekly ranking uses `RankingAdapter`.
- Mock adapter still works with current LocalStorage records.
- Server adapter calls `/api/ranking/weekly`, `/api/ranking/world`, `/api/player/me`, and `/api/ranking/submit`.
- Ranking candidate payload contains `playerId`, `weaponInstanceId`, `seasonId`, `actionId`, and `clientCreatedAt`.
- Client does not send authoritative `rankingValue`.

## Game Actions

- Keep localMode unchanged for MVP play.
- Before competitive beta, move enhance/transcend/sell/buy/forge collect to server-authoritative APIs.
- Every mutating API must use idempotent `actionId`.
- Server must return full resource and owned weapon state after each action.

## Security

- Production build must not show DEV panel.
- Production store dev mutations must no-op.
- No secret values may use `NEXT_PUBLIC_*`.
- Server must reject replayed or mismatched action ids.
- Rate limits must be active for mutation and ranking endpoints.
- Server time must define season boundaries and offline rewards.

## UX Hardening

- Weapon images, frame images, background images, icons, cards, and buttons reduce drag/selection behavior.
- Buttons use `touch-action: manipulation`.
- Do not disable selection for future text inputs or accessibility-critical controls.

## Build Gates

- `npm run lint`
- `npm run build`
- Manual localMode smoke test: buy, enhance, transcend, sell, forge collect, ranking, sound, LocalStorage reload.
- Manual betaServerMode smoke test without API: app renders, ranking fallback appears, local play is not blocked.
