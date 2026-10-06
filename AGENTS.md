# Iya Gbenga's Store (Mobile App) - Agent Instructions

## Project Context

This is the customer mobile app (React Native / Expo, TypeScript) for Iya Gbenga's Store, a Nigerian
grocery shop serving Lagos. A website already exists. **The app uses the SAME backend as the website:
the same Supabase project (Postgres, Auth, Realtime) and the same website API routes.** Never create a
second backend or database.

Before making any changes, read and understand:

- `docs/BUILD_PROMPT.md` - the full build brief and backend contract (tables, cart functions, API
  endpoints, auth flow, screens, acceptance tests). It is the source of truth for behaviour.
- `Iya Gbenga's Store_ PRD.md` - product requirements.
- `designs/` - approved designs, the source of truth for the visual implementation.
- `backend-reference/migrations/` - the website's SQL, READ-ONLY reference.

## Backend Rules (most important)

- Supabase is accessed ONLY with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
  Row Level Security protects the data.
- NEVER use or embed the Supabase service-role key or any other secret (email, Resend, SMTP keys) in
  the app. If you think you need a secret, call the website API instead.
- Orders are created ONLY via `POST {EXPO_PUBLIC_API_URL}/api/orders` with a bearer token. Never insert
  into `orders`, `order_items` or `order_events` from the app.
- Signed-in carts are read and written ONLY through the cart RPCs: `get_cart`, `add_to_cart`,
  `set_cart_quantity`, `remove_from_cart`, `set_cart_note`, `clear_cart`, `merge_cart`. Never write
  `cart_items` or `carts` directly.
- Do NOT modify the database, RLS policies, SQL functions or the website. If a backend change is needed
  (column, endpoint, policy, redirect URL), STOP and write a short note: "Backend change needed: ...,
  because ...". Then continue with other work.
- The app never decides prices, stock or shipping fees. Display only; the server prices everything.

## Cart Sync Rules

- Signed in: the database is the source of truth. Update the UI optimistically, send writes through a
  single serialised queue, ignore refetches while writes are pending, then refetch once.
- Subscribe to realtime `postgres_changes` on the user's row in `carts` (`user_id=eq.<uid>`). The event is
  only a signal: always re-read with `get_cart`, never patch state from the payload.
- Refetch on subscribe, on app foreground (`AppState` = active) and when connectivity returns.
- Signed out: the guest cart lives only in AsyncStorage. On sign-in: `merge_cart` -> clear local ->
  `get_cart` -> subscribe. Signed-in carts are never stored locally.

## Auth Rules

- Google sign-in ONLY, via Supabase OAuth (PKCE + deep link). Same Supabase users as the website.
- Do not build email/phone/password sign-in (it is not connected to any backend).
- Browsing and the cart work signed out; checkout and orders require sign-in.
- Never decode or trust JWTs yourself; Supabase validates them.

## Design Requirements

Follow the designs in `designs/` closely. Do not redesign or introduce a different visual direction
unless explicitly requested. The designs are desktop; adapt them sensibly to mobile (bottom sheets,
sticky bars, single-column forms). Use the design tokens (colours, fonts, spacing, radii) from ONE
`theme.ts`; do not hard-code colours or font sizes in components.

If a design and the PRD/build brief conflict:
1. Identify the conflict.
2. Prefer the explicit functional requirement.
3. Preserve the visual design unless told otherwise.

## Development Rules

- Expo + TypeScript (strict) + Expo Router. No `any`. Small, focused components. Reuse before creating.
- Money is integer kobo everywhere. Use a single `formatNaira(kobo)` helper. Never use floats for money.
- Do not build features outside the PRD / build brief. Out of scope: admin screens, card payments,
  Paystack/Flutterwave, wishlist, reviews/ratings, promo codes, driver tracking, invoices.
- Delivery is Lagos only. Payment methods: Pay on Delivery and Bank Transfer only.
- Keep secrets out of the repo. `.env` is git-ignored; commit `.env.example` (names only).
- Accessibility: labels, screen-reader names on icon buttons, 44pt touch targets, good contrast.
- Handle loading, empty, error and offline states on every data screen.
- Write unit tests for pure logic (formatNaira, cart clamp/merge, validators, order-status grouping).

## Before Starting a Task

1. Read the relevant section of `docs/BUILD_PROMPT.md` and the PRD.
2. Inspect the relevant design files.
3. Inspect the existing implementation.
4. Implement the smallest complete solution.
5. Run type check, lint and tests. Verify on a device/emulator (not only in code) before calling it done.

## Git

- Small, feature-by-feature commits with clear messages. Never commit `.env` or any secret.
- Only commit or push when asked.

## Important

Do not assume missing requirements. If something is unclear, check the build brief, PRD, designs and
existing code first. If still unclear, ask.
