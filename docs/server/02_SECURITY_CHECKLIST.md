# Security Checklist

## Required Before Beta Ranking Is Competitive

1. LocalStorage manipulation risk
   - Current local save is useful for localMode only.
   - betaServerMode must treat all LocalStorage data as display/cache data.

2. Ranking value client submission ban
   - Client must not submit authoritative `rankingValue`.
   - Optional display values are untrusted and must be recomputed server-side.

3. Server authoritative actions
   - Enhance, transcend, sell, buy, forge collect, and reward claims must be finalized by the server.

4. DEV panel production removal
   - DEV panel must be hidden when `process.env.NODE_ENV === "production"`.
   - Store-level dev mutations must also no-op in production.

5. Environment variable exposure
   - Only `NEXT_PUBLIC_*` values can be read in client bundles.
   - Secrets must not use `NEXT_PUBLIC_*`.

6. Ad reward duplicate payment prevention
   - Reward grant must use server-side ad verification or a signed reward token.
   - One reward action id must grant at most once.

7. Replay prevention
   - Every mutating request needs `actionId`.
   - Server must store consumed ids and reject mismatched repeated payloads.

8. Rate limit
   - Apply per-player and per-IP limits for game actions and ranking submits.

9. actionId/idempotency key
   - `actionId` is required for every mutating endpoint.
   - Duplicate requests should return the first result, not roll RNG again.

10. Season ranking duplicate submit prevention
    - A weapon/action pair can only produce one accepted ranking candidate per category.
    - Higher valid scores may replace lower scores according to server rules.

11. Server time 기준 사용
    - Season boundaries, cooldowns, offline rewards, and ranking order use server time.

12. Client time 신뢰 금지
    - `clientCreatedAt` is telemetry only.
    - It must not decide reward amounts or ranking ordering.

13. Server RNG for enhance/transcend
    - Client cannot roll success or failure.
    - Server should log RNG version and balance version per action.

14. API error handling
    - Client should show retryable errors clearly.
    - betaServerMode may show local fallback ranking, but not mark fallback rows as verified.

15. Data migration strategy
    - Local save can be imported only as a beta onboarding hint.
    - Server migrations need versioned weapon definitions, balance constants, and action history.

## Values Never Trusted From Client

- gold
- ember
- transcend stone
- enhance result
- transcend result
- sale price
- ranking value
- best weapon record
- total sales
- enhance success/failure count
- transcend success/failure count
