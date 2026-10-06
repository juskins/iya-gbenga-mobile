# Iya Gbenga's Store (mobile app)

Customer app (Expo SDK 57, React Native, TypeScript, Expo Router) for Iya Gbenga's Store. It uses the **same Supabase project and website API** as the website. There is no second backend.

## Setup

```bash
npm install
cp .env.example .env   # then fill in the three values
npx expo start
```

| Variable | Value |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | same as the website's `NEXT_PUBLIC_SUPABASE_URL` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | same as the website's `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `EXPO_PUBLIC_API_URL` | the website's live URL, no trailing slash |

Never put the service-role key or any other secret in the app. `.env` is git-ignored.

Scripts: `npm run typecheck`, `npm run lint`, `npm test`.

## Google sign-in redirect URLs

Sign-in uses Supabase OAuth (PKCE) and a deep link with the scheme `iyagbenga`. Add these in Supabase, under Authentication, URL Configuration, Redirect URLs:

- Production / EAS build: `iyagbenga://auth/callback`
- Expo Go (dev): the `exp://<your-lan-ip>:8081/--/auth/callback` URL (it is `Linking.createURL("auth/callback")`; log it once to read the exact value)

Nothing changes in Google Cloud Console.

## Builds (EAS)

```bash
npm i -g eas-cli && eas login && eas build:configure
eas build -p android --profile preview   # installable APK
eas build -p ios --profile preview       # needs an Apple developer account
```

Bundle id / package: `com.iyagbengastore.app` (change in `app.json` if needed).

## Structure

`app/` routes, `components/`, `providers/` (auth, cart store, toast), `hooks/`, `lib/` (supabase, api, cart RPCs, catalog, orders, pure logic), `theme.ts` (all design tokens), `__tests__/`.

## Manual test checklist (website open in a browser while the app runs)

1. Sign in with the same Google account on both: same cart.
2. Add / change quantity / remove on the website: the app updates within about a second, with no refresh. Repeat app to website.
3. Edit the order note on one: it appears on the other.
4. Background the app, change the cart on the website, return: it catches up immediately.
5. Add items signed out, then sign in: they merge with no duplicates (sign in twice to check).
6. Place an order from the app: the cart empties on both, and the order shows on the website. An order placed on the website shows in the app's Orders.
7. Out-of-stock and over-limit items show friendly messages. Retrying checkout never creates two orders.
8. Offline: the banner appears, and data refreshes when the connection returns.
