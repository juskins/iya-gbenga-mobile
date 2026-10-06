# Prompt: build the Iya Gbenga's Store mobile app (React Native / Expo)

> **How to use this file.** Start a NEW Claude Code session in an EMPTY folder for the mobile app, then:
> 1. Copy these from the website project into the new folder first, so Claude can read them:
>    - `designs/` (all 8 folders: `screen.png` + `code.html` per screen, plus `designs/brand/`)
>    - `Iya Gbenga's Store_ PRD.md`
>    - `supabase/migrations/` → into `backend-reference/migrations/` (READ-ONLY reference, never edited or run from the app)
>    - `public/logo.png`
> 2. Paste everything below the line into the first message.
> 3. Put the values from the website's `.env.local` into the app's `.env` yourself (names listed in section 3). Never paste secrets into the chat.

---

You are building the **customer mobile app** (iOS + Android) for **Iya Gbenga's Store**, a real online shop for authentic Nigerian groceries (yams, palm oil, garri, dried fish, crayfish, peppers, soup bundles) serving Lagos. A website for the same shop already exists and is live. **The app must use the exact same backend as the website: the same Supabase project (Postgres + Auth + Realtime) and the same website API routes. Do not create a new backend, a new database, or a second source of truth.** Build the app from start to finish: project setup, every screen, auth, cart, checkout, orders, polish, tests, and build instructions.

Work autonomously, but stop and ask me before anything that changes the backend (see section 12).

## 1. Ground rules (read twice)

1. **One backend.** Supabase is the database and auth. Orders are created through the website's HTTP API (section 8). Everything else the app reads/writes with `@supabase/supabase-js` and the **anon key**, protected by Row Level Security (RLS) exactly like the website.
2. **Never put the Supabase service-role key, Mailgun/Resend/SMTP keys or any secret in the app.** Only `EXPO_PUBLIC_*` variables below. If you find yourself needing a secret, you are doing it wrong: call the website API instead.
3. **Money is integer kobo everywhere** (₦1 = 100 kobo). Never use floats for money. Display with a `formatNaira(kobo)` helper: `₦` + thousands separators, no decimals (e.g. 1480000 → `₦14,800`).
4. **Prices, stock and shipping fees are decided by the server.** The app shows numbers for display only and never sends a price to the server.
5. **Follow the designs** in `designs/` (see section 10): layout, spacing, type, colours, components, flows. The designs are desktop; produce good mobile layouts. Where a design conflicts with this prompt or the PRD, this prompt/PRD wins functionally and the design wins visually. Do not invent features.
6. **Do not build** (explicitly out of scope): admin screens, card entry / online payments, Paystack/Flutterwave, wishlist/favourites, reviews/ratings (the database has none; show no star ratings), promo codes, live driver tracking/"call rider", invoices/PDF receipts, phone/password sign-in. Delivery is **Lagos only**.
7. TypeScript strict, small focused components, no dead code, no `any`. Accessibility: labels, 44pt touch targets, screen-reader labels on icon buttons, sufficient contrast.

## 2. Stack (use these)

- **Expo (current SDK) + TypeScript + Expo Router** (file-based routing, tabs + stacks).
- `@supabase/supabase-js`, `@react-native-async-storage/async-storage` (session + guest cart storage), `react-native-url-polyfill`.
- `expo-auth-session` or `expo-web-browser` + `expo-linking` for Google sign-in (section 6).
- `@tanstack/react-query` for server data (catalog, orders); the **cart** is its own small store (section 7).
- `react-hook-form` + `zod` for forms (mirror the website's validation, section 9).
- `expo-image` for images, `@expo-google-fonts/inter` and `@expo-google-fonts/plus-jakarta-sans` for fonts, `expo-secure-store` optional.
- Styling: StyleSheet or NativeWind (your choice, but define the design tokens in ONE theme file, section 10).

## 3. Environment variables (`.env`, git-ignored; commit a `.env.example` with names only)

```
EXPO_PUBLIC_SUPABASE_URL=            # same as the website's NEXT_PUBLIC_SUPABASE_URL (https://<ref>.supabase.co)
EXPO_PUBLIC_SUPABASE_ANON_KEY=       # same as the website's NEXT_PUBLIC_SUPABASE_ANON_KEY (public by design)
EXPO_PUBLIC_API_URL=                 # the website's live URL, no trailing slash, e.g. https://iyagbengastore.netlify.app
```

Create `lib/supabase.ts`:

```ts
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

export const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

// Only refresh tokens while the app is in the foreground.
AppState.addEventListener("change", (s) => (s === "active" ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh()));
```

## 4. Backend contract: database (READ THIS BEFORE WRITING ANY QUERY)

The full SQL is in `backend-reference/migrations/` (0001 schema, 0002 RLS, 0003 order function, 0004 storage, 0005 cart sync). Summary of what the app may touch:

**Public read (no sign-in needed; RLS returns active rows only)**
- `categories` (id, name, slug, image_url, sort_order, is_active)
- `products` (id, category_id, name, slug, description, origin, badge, badge_tone ∈ secondary|primary|tertiary|orange|error|mint, is_active, created_at, search_tsv)
- `product_variants` (id, product_id, label, sku, price_kobo, compare_at_price_kobo, stock_qty, max_per_order, is_active)
- `product_images` (id, product_id, url, alt, sort_order), `product_related` (product_id, related_product_id)
- `shipping_methods` (id, name, price_kobo, free_above_kobo, eta_text, cutoff_time, sort_order, is_active)

Catalog query (same shape the website uses):

```ts
const { data } = await supabase
  .from("products")
  .select(`id, name, slug, description, origin, badge, badge_tone, created_at,
    category:categories(slug, name),
    variants:product_variants(id, label, sku, price_kobo, compare_at_price_kobo, stock_qty, max_per_order),
    images:product_images(url, sort_order),
    related:product_related!product_related_product_id_fkey(related_product_id)`)
  .eq("is_active", true)
  .order("created_at", { ascending: false });
```

Rules: a product is shown only if it has ≥1 variant and ≥1 image; sort variants by price; the card shows the cheapest in-stock variant with "From ₦x" when there are several; a variant with `stock_qty = 0` is **Sold Out** (disabled add button); the effective per-order limit of a variant is `min(max_per_order, stock_qty)`; show `compare_at_price_kobo` struck through when present. Search: filter by name/description/category (debounce 300 ms); the catalog supports filters (category multi-select, max price, in-stock), sort (Featured/newest, price low-high, high-low) and pagination, mirroring `designs/shop`. The catalog is small (tens of rows): fetching all active products once and filtering/sorting on the device is acceptable.

**Signed-in only (RLS = owner only; the app acts as the user)**
- `profiles` (id = auth user id, full_name, email, phone, avatar_url, role). The app may update only `full_name`, `phone`, `avatar_url`. Never read or send `role` for any purpose. A profile row is created automatically on first sign-in.
- `addresses` (id, user_id, recipient, phone, street, unit, state, lga, landmark, is_default): prefill checkout from the default address; one default per user.
- `orders`, `order_items`, `order_events`: **read-only** for the app (own rows only). Never insert/update them from the app; orders are created via the API (section 8).
  - `orders`: id, order_number (e.g. `IG-2026-000123`), status ∈ pending|confirmed|packing|dispatched|delivered|cancelled, payment_method ∈ pay_on_delivery|bank_transfer, payment_status ∈ pending|paid, subtotal_kobo, shipping_kobo, discount_kobo, total_kobo, shipping_address (jsonb: recipient, phone, street, unit, state, lga, landmark), shipping_method_name, contact_email, contact_phone, note, created_at.
  - `order_items`: order_id, variant_id (nullable), product_name, variant_label, unit_price_kobo, quantity (price snapshots).
  - `order_events`: order_id, status, note, created_at (the status timeline).

```ts
const { data } = await supabase.from("orders")
  .select(`id, order_number, status, payment_method, payment_status, subtotal_kobo, shipping_kobo, total_kobo,
    shipping_method_name, shipping_address, contact_email, contact_phone, note, created_at,
    order_items(variant_id, product_name, variant_label, unit_price_kobo, quantity),
    order_events(status, created_at)`)
  .order("created_at", { ascending: false }).range(from, to);   // 10 per page
```

## 5. Backend contract: cart functions (the heart of cross-device sync)

For a **signed-in** user the cart lives in the database (`carts`, `cart_items`) and is read/written **only through these RPC functions**, which enforce stock and per-order limits identically for the website and the app:

| Call | Meaning | Returns |
|---|---|---|
| `supabase.rpc("get_cart")` | whole cart with LIVE prices | `{ note: string\|null, items: [{ variantId, productSlug, name, variantLabel, image, unitPriceKobo, quantity, maxPerOrder, stockQty, available }] }` (oldest line first; `available` is false when out of stock) |
| `rpc("add_to_cart", { p_variant_id, p_quantity })` | **add** p_quantity (delta), clamped to min(max_per_order, stock) | new quantity (int) |
| `rpc("set_cart_quantity", { p_variant_id, p_quantity })` | set an **absolute** quantity; ≤ 0 removes the line | final quantity (int) |
| `rpc("remove_from_cart", { p_variant_id })` | remove a line | void |
| `rpc("set_cart_note", { p_note })` | order note, max 250 chars; ''/null clears | void |
| `rpc("clear_cart")` | empty the cart and note | void |
| `rpc("merge_cart", { p_items: [{ variant_id, quantity }], p_note })` | merge a guest cart after sign-in; idempotent (max of existing/incoming), skips unavailable variants | void |

Errors come back as `error.message` starting with a code: `UNAUTHENTICATED`, `INVALID_QUANTITY`, `VARIANT_UNAVAILABLE`, `OUT_OF_STOCK`. Map them to friendly messages ("Sorry, that item is out of stock.").

### Realtime: how the app and website stay in sync instantly

Every change to a user's cart (from any device, or server code after an order) updates that user's single row in `public.carts` (a database trigger bumps `updated_at`). So:

1. Subscribe to **UPDATE/INSERT on `carts` filtered to the user** (`user_id=eq.<uid>`). The event is only a **signal**.
2. On every event (debounce ~150 ms), call `get_cart` and replace the local cart with the result. Never try to patch local state from the event payload.
3. Also call `get_cart` after (re)subscribing (status `SUBSCRIBED`), when the app returns to the foreground (`AppState` → `active`), and when connectivity returns. Phones suspend websockets in the background, so this catch-up is essential.

```ts
const channel = supabase
  .channel(`cart-${uid}`)
  .on("postgres_changes", { event: "*", schema: "public", table: "carts", filter: `user_id=eq.${uid}` }, () => scheduleRefetch(150))
  .subscribe((status) => { if (status === "SUBSCRIBED") scheduleRefetch(0); });
// cleanup on sign-out/unmount: supabase.removeChannel(channel)
```

### Cart store behaviour (implement exactly)

- **Optimistic UI:** update the local cart immediately when the user taps +/−/remove/add, then send the matching RPC. **Serialise writes** (a single promise queue) so they reach the server in the order the user made them. While writes are pending, ignore refetch results; when the queue drains, refetch once to converge. On an RPC error: show a toast, then refetch.
- Use `set_cart_quantity` for steppers (absolute) and `add_to_cart` for "Add" buttons (delta). Debounce the note ~700 ms before `set_cart_note`.
- **Guest** (signed out): keep the cart only in AsyncStorage (`{items, note}` using the same line fields as `get_cart` minus `stockQty/available`); guests can browse and fill a cart, but checkout requires sign-in.
- **On sign-in:** read the guest cart → `merge_cart` → on success clear the guest storage → `get_cart` → subscribe. After that, signed-in carts are **never** stored locally. **On sign-out:** stop the subscription and show an empty guest cart.
- Hide lines with `available = false` behind a "Sold out, remove" affordance or remove them automatically (call `remove_from_cart`); never let the user check out with them.
- The tab bar / header cart badge shows total quantity and subtotal (sum of `unitPriceKobo × quantity`).
- Acceptance: adding an item on the website appears in the app within about a second **without a manual refresh**, and vice versa (add, change quantity, remove, note, and the cart emptying after an order).

## 6. Authentication (Google only, same Supabase project and same users as the website)

The same Google account must resolve to the **same Supabase user** on both platforms (that is what makes the cart shared). Use Supabase's browser OAuth flow with PKCE and a deep link:

1. Pick an app scheme in `app.json` (e.g. `iyagbenga`). Redirect URL: `makeRedirectUri({ scheme: "iyagbenga", path: "auth/callback" })` (in Expo Go this is an `exp://…` URL; in builds `iyagbenga://auth/callback`).
2. `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo, skipBrowserRedirect: true } })` → open `data.url` with `WebBrowser.openAuthSessionAsync(data.url, redirectTo)` → read `code` from the returned URL → `supabase.auth.exchangeCodeForSession(code)`.
3. **Tell me** the exact redirect URLs you used (dev and production). I must add them in Supabase → Authentication → URL Configuration → **Redirect URLs**. Nothing needs to change in Google Cloud Console (Google still redirects to Supabase's own callback).
4. UI: one "Continue with Google" button (the website's login also has Sign In / Create Account tabs with email+phone forms, but those are **not connected to any backend**, so do NOT build them; Google is the only way in). Show the signed-in name/avatar on an Account screen with "Sign out" and "My orders".
5. Gate: browsing, product pages and the cart work signed out; **checkout and order history require sign-in** (redirect to Login and return to where the user was).
6. Handle session restore on launch (`getSession`), refresh, and sign-out cleanly. Never decode JWTs yourself; always let Supabase validate.

## 7. Navigation (suggested)

Bottom tabs: **Home**, **Shop**, **Cart** (badge), **Orders**, **Account**. Stacks for Product detail, Checkout (modal or stack), Order confirmation, Order detail, Login.

## 8. Backend contract: website API (only for things that need the server's secrets)

Base URL = `EXPO_PUBLIC_API_URL`. Always send `Authorization: Bearer <supabase access token>` (`(await supabase.auth.getSession()).data.session?.access_token`) and `Content-Type: application/json`. If the token is expired, refresh the session and retry once.

### `POST /api/orders` — place an order
Request body (prices are deliberately absent):

```json
{
  "values": {
    "firstName": "Folake", "lastName": "Adeyemi", "email": "folake@example.com",
    "phone": "0803 456 7890",
    "street": "12 Admiralty Way", "unit": "", "state": "Lagos", "lga": "Ikeja", "landmark": "",
    "shippingMethod": "<shipping_methods.id uuid>",
    "paymentMethod": "pay_on_delivery",
    "saveAsDefault": false
  },
  "idempotencyKey": "<uuid v4, generated once per checkout attempt>",
  "items": [{ "variantId": "<uuid>", "quantity": 2 }],
  "note": ""
}
```

Success `201`: `{ "ok": true, "orderNumber": "IG-2026-000123", "orderId": "<uuid>", "totalKobo": 2780000 }`.
Failure: `{ "ok": false, "code": "...", "message": "<friendly, show it>", "fieldErrors": { "<field>": "<message>" } }` with HTTP status: `401 UNAUTHENTICATED`, `400 INVALID_INPUT | INVALID_QUANTITY | EMPTY_CART | INVALID_PAYMENT_METHOD`, `409 OUT_OF_STOCK | MAX_PER_ORDER | VARIANT_UNAVAILABLE | SHIPPING_UNAVAILABLE | IDEMPOTENCY_KEY_CONFLICT`, `429 RATE_LIMITED` (max 5 orders per 10 minutes), `500 UNKNOWN`.

Rules: generate the idempotency key once per checkout attempt and **reuse it on retries and double taps** (the server returns the same order instead of creating a second); rotate it only after success. Send the items from the local cart (`variantId` = the database variant uuid). The server re-prices everything from the database and, on success, clears the user's cart (the realtime signal then empties the cart on every device); also clear the local view. On failure keep the cart and form values and show `message` / `fieldErrors`. The confirmation email is sent by the server; the app does nothing for email.

### `GET /api/store-config` — website-side settings
Response: `{ ok, whatsappNumber: string|null, supportPhone: string, freeDeliveryThresholdKobo: number, bankTransfer: { bankName, accountNumber, accountName } | null }`. Fetch it after sign-in (cache it). Use `freeDeliveryThresholdKobo` for the free-delivery progress bar, `whatsappNumber` for the "Order on WhatsApp" links (`https://wa.me/<digits>?text=<prefilled message>`), and `bankTransfer` for bank-transfer payment instructions (if null: "We will contact you shortly with our payment details").

There are **no other website endpoints** to call. Anything else is Supabase.

## 9. Screens and behaviour (see `designs/<name>/screen.png` + `code.html`, and the PRD §6)

1. **Home** (`designs/home`): hero + CTA to Shop, trust strip, category tiles (from `categories`, link to Shop filtered), "Best of the Market" grid with category tabs (first 8 newest products), why-us, testimonials (illustrative copy; no invented statistics), WhatsApp contact card. No newsletter form, no fake claims ("18,000+ families", ratings, ₦2,000 voucher are removed from the product).
2. **Shop** (`designs/shop`): grid (2 columns on phones), search (300 ms debounce), filter sheet (bottom sheet: category multi-select, max price, in-stock), sort, per-page/pagination or infinite scroll, empty state ("No groceries matched…" + reset + suggested searches), in-grid quantity stepper replacing "Add" once in the cart, Sold Out state.
3. **Product detail** (`designs/productDetail`): image gallery with thumbnails, name, origin, SKU, price (+ compare-at), stock status ("In stock", "Low stock, only N left" when ≤ 10, "Out of stock"), **variant selector** (price/SKU/stock/limits update per variant), quantity stepper (max = min(max_per_order, stock_qty)), Add to Cart, Buy Now (add then open checkout), tabs (Description, Sourcing & Freshness, Storage & Shelf Life — keep copy modest and generic), "Frequently bought together" (up to 3 related), "Order via WhatsApp" (prefilled with product, size, quantity). Sticky bottom Add to Cart bar.
4. **Cart** (`designs/cart`): line items (image, name, variant, price, stepper min 1 / max `maxPerOrder`, remove), order note (≤ 250 chars with counter), summary (subtotal; delivery "calculated at checkout"), free-delivery progress bar, recommended add-ons, empty state with CTA, skeleton until loaded. Proceed to Checkout.
5. **Checkout** (`designs/checkout`): 3 steps (Delivery → Shipping → Review & Place). Delivery form (React Hook Form + Zod, inline errors): firstName, lastName (≤ 60), email, phone (Nigerian mobile regex `^0[7-9][01]\d{8}$` after removing spaces/dashes), street (5–150), unit (≤ 100), state (**Lagos only**, show "We only deliver within Lagos for now" otherwise), lga, landmark (≤ 250). LGAs for Lagos: Lekki / Eti-Osa, Ajah / Sangotedo, Ikoyi / Victoria Island, Ikeja, Surulere, Yaba / Mainland, Maryland / Ikorodu Road, Festac / Amuwo-Odofin. Prefill from `profiles` and the default `addresses` row; "Save as my default address" checkbox. Shipping methods from `shipping_methods` (name, price, ETA, cut-off time; free when subtotal ≥ `free_above_kobo`). Payment: **Pay on Delivery** or **Bank Transfer** only (NO card fields). Review summary (items, subtotal, delivery, total). "Place Order" with loading state and double-submit protection. Show the server's `totalKobo` on the confirmation.
6. **Order confirmation** (`designs/ConfirmationScreen`): success banner, order number (copy button), email/phone, items, totals, payment instructions (bank details from `/api/store-config` for bank transfer), delivery address, status timeline (Received, Packing, Dispatched, Delivered), Continue Shopping, View my orders. Load the order from `orders` by `order_number` (RLS makes it owner-only).
7. **Orders** (`designs/Orders`) — My Orders & Purchases: search (order number / product name), status chips with counts (All, In Transit = confirmed+packing+dispatched, Delivered, Cancelled), an active-order card for the most recent non-delivered/non-cancelled order with the timeline, past orders list (number, status badge, date in Africa/Lagos, payment method + status, total, item chips, **Reorder**, View details), cancelled-order style, 10 per page, empty state. **Reorder** = fetch current variants, call `add_to_cart` for each still-available line at CURRENT prices (never old prices), report skipped items, open the Cart. Order detail: items, totals, shipping method, payment, address, timeline.
8. **Login** (`designs/Auth`): see section 6 (Google only).
9. **Account**: name, email, Sign out, My orders, WhatsApp help link, app version.

Cross-cutting UX: loading skeletons, empty states, error states with retry, offline banner, toasts ("Added to cart"), pull-to-refresh on lists, safe-area handling, keyboard-aware forms, haptics optional.

## 10. Design system (put these in one `theme.ts`)

Source of truth for exact values: the `<script id="tailwind-config">` block at the top of each `designs/*/code.html`. Key tokens:

- **Colours:** background `#f8f9ff`; surface-container-low `#eff4ff`; surface-container `#e6eeff`; surface-container-high `#dee9fc`; white cards `#ffffff`; **primary (deep forest green) `#00361f`**; primary-container `#164e33`; primary-fixed `#b6f0ca`; primary-fixed-dim `#9ad3af`; on-primary `#ffffff`; **secondary (burnt orange) `#944a00`**; secondary-container `#fc8f34`; secondary-fixed `#ffdcc5`; tertiary `#003809`; on-surface `#121c2a`; on-surface-variant `#404942`; outline `#717972`; outline-variant `#c0c9c0`; error `#ba1a1a`; error-container `#ffdad6`; inverse-surface `#27313f`.
- **Fonts:** headings **Plus Jakarta Sans** (600/700/800), UI/body **Inter** (400/600/700). Type scale: display-hero 56/64 (36/44 mobile) 800; headline-xl 40/48 (28/36 mobile) 700; headline-lg 28/36; headline-sm 20/28 600; title-md 16/24 600; body-lg 18/28; body-md 15/22; body-sm 13/18; label-md 13/16 600; label-caps 11/14 700 uppercase tracking .06em; price-card 17/22 700; price-xl 24/30 700.
- **Shape:** cards radius 12–16 (`rounded-2xl` = 16), pills fully rounded, badges pill, 44pt minimum touch targets, subtle shadows.
- **Icons:** Material Symbols (the designs use them); use `@expo/vector-icons` MaterialIcons/MaterialCommunityIcons equivalents with the same meaning.
- **Brand:** logo at `public/logo.png` (copy into `assets/`), source in `designs/brand/logo-original.png`. Use a square crop of the head/headwrap for the app icon and splash (the website favicon is a crop at x=330,y=0, 640×640 of the 1254×1254 original). Name: **Iya Gbenga's Store**. Use one name consistently (never "Mama Gbenga").
- Product badges use `badge` + `badge_tone` from the database: secondary → orange text-on-orange, primary → dark green container, tertiary → deep green, orange → secondary-container, error → error red, mint → primary-fixed.

## 11. Quality bar and deliverables

- Project structure you propose and keep tidy (e.g. `app/`, `components/`, `lib/` (supabase, api, format, cart), `hooks/`, `theme.ts`), with `README.md` covering: setup, env vars, running on a device/emulator, Google redirect URL setup, and EAS build commands (`eas build -p android --profile preview` for an installable APK, plus iOS notes).
- Unit tests for pure logic (formatNaira, cart merge/clamp, validators, order-status grouping) and a **manual test checklist** in the README, including the cross-device sync scenarios below.
- Lint + type check clean. No secrets committed. `.env.example` provided.
- Commit in small feature-by-feature commits.

**Cross-device acceptance tests (must all pass, website open in a browser while the app runs):**
1. Sign in with the same Google account on both → same cart contents.
2. Add an item on the website → it appears in the app ≤ ~1 s without refresh; change quantity/remove → same; and the reverse (app → website).
3. Edit the order note on one → appears on the other.
4. Put the app in the background, change the cart on the website, bring the app back → it catches up immediately.
5. Add items signed out in the app, then sign in → they merge into the account cart (no duplicates when signing in twice).
6. Place an order from the app → the cart empties on both; the order appears in the website's `/account/orders`; and vice versa an order placed on the website appears in the app's Orders.
7. Out-of-stock / over-limit items are rejected with friendly messages; retrying the same checkout (same idempotency key) never creates two orders.

## 12. When something is missing: STOP, do not work around it

You must **not** modify the database, RLS policies, functions, or the website. If you believe the backend needs a change (a missing column, endpoint, policy, redirect URL, CORS, etc.), do not hack around it with the service-role key or a second backend. Instead stop and give me a short, precise note ("Backend change needed: …, because …") that I can take to the website project's Claude session, then continue with the rest.

Start by (1) reading `designs/`, the PRD and `backend-reference/migrations/`, (2) proposing the project structure and the build order in a few lines, then (3) building. Ask me only for things you truly cannot decide (e.g. the app scheme/bundle id, Apple/Google developer accounts).
