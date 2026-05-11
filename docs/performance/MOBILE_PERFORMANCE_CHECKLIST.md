# Mobile Performance Checklist

Use this checklist before external beta testing.

## iPhone First Entry

1. Clear Safari website data for the beta domain.
2. Open the app and complete Google login.
3. Confirm the saved-data loading screen does not remain longer than 12 seconds.
4. Confirm session, bootstrap, and player sync errors show retry, sign-out, and server reload options.
5. Confirm OAuth callback returns to `/` and `/api/player/bootstrap` or `/api/player/me` does not remain pending forever.

## Server Latency

- Development logs should show elapsed time for player bootstrap/me, game actions, forge upgrade, ad reward request/complete/status, and ranking weekly/world.
- Any request above 1000ms should log as a slow request.
- The development performance panel should show last API name, elapsed time, error code, bootstrap time, player sync time, tab switch time, and ad reward complete time.

## Action UX

- Enhance starts animation and sound immediately.
- Enhance result modal appears only after the server response.
- Slow enhance responses show a server-result checking state.
- Server action failures show a reload-server-data path.
- Ad reward completion shows reward verification immediately.
- Ad reward result modal opens from lightweight result data first; full server snapshot sync runs in the next frame or idle time.
- Ad close/failure never opens a reward modal.

## Tab Switching And Assets

- Core background images, tab icons, currency icons, current equipped weapon, modal frame, and key effects preload early.
- Remaining backgrounds/effects preload during idle time.
- Do not preload every weapon image on first entry.
- Weapon card/image components should avoid unnecessary rerenders during fast tab changes.
- Ranking data should use a short cache to avoid refetching on every tab mount.
- Ranking cache TTL is 90 seconds; cached data should appear before any background refresh.
- Ad reward status should use cached/background refresh and must not block tab entry.
- On mobile, modal backdrop blur and background saturation should be lighter than desktop.

## Mobile Safari

- Use `100dvh` or safe-area aware layouts for full-screen states.
- Bottom tabs must respect `env(safe-area-inset-bottom)`.
- Buttons should keep `touch-manipulation` and block duplicate inputs during pending server actions.
- Loading overlays must not remain forever after timeout/error.

## Production Local iPhone Test

Development mode can feel slower than the deployed bundle. Always compare against a local production build before judging mobile performance.

1. Find the PC IP on the same Wi-Fi:
   - Windows PowerShell: `ipconfig`
   - Use the IPv4 address for the active Wi-Fi adapter.
2. Build and serve production locally:
   - `npm run build`
   - `npx next start -H 0.0.0.0 -p 3000`
3. Open `http://<PC-IP>:3000` on iPhone Chrome/Safari.
4. For beta OAuth, add `http://<PC-IP>:3000/auth/callback` to Supabase Authentication > URL Configuration > Redirect URLs if Google login returns to the internal IP.
5. Test `NEXT_PUBLIC_GAME_MODE=local` for pure rendering/tap performance.
6. Test `NEXT_PUBLIC_GAME_MODE=beta` for auth, bootstrap, action latency, ad reward complete, ranking cache, and tab switching.
7. If dev mode stutters but production local is smooth, treat the issue as development overhead unless production logs show slow API requests.
8. If production local still stalls on `checking_session`, capture the visible auth stage, elapsed time, origin, and Supabase redirect URL list.
