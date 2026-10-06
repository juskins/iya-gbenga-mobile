# Iya Gbenga's Store: Product Requirements Document

**Version:** 1.0 (MVP) | **Status:** Draft for build | **Date:** 2 Oct 2026 **Stack:** Next.js (App Router), TypeScript, Tailwind, Supabase (Postgres + Auth), Google OAuth, Mailgun, React Hook Form, Redux

---

## 1. Overview

Iya Gbenga's Store is a real online grocery shop for authentic Nigerian staples: yams, palm oil, garri, dried fish, crayfish, peppers, spices and soup bundles. It serves customers in Lagos (primary) and can grow to other cities. The design (7 screens: Home, Catalog, Product Detail, Cart, Checkout, Order Confirmation, Sign In/Register) establishes a green/cream, trust-focused look with Nigerian context (₦, Lagos delivery zones, WhatsApp ordering).

**Problem:** Customers who want fresh, clean, authentic produce must go to crowded markets or rely on WhatsApp chats with no order history, no structure, and no tracking.

**Solution:** A fast, mobile-first storefront with a clear path from browse to confirmed order, backed by a reliable order record the owner can fulfil from.

## 2. Goals and success metrics

| Goal | Metric (first 90 days) |
| --- | --- |
| Customers can complete an order unaided | Checkout completion rate ≥ 55% of started checkouts |
| Fast, usable on cheap phones and slow networks | LCP ≤ 2.5s on 4G mid-range Android; Lighthouse mobile ≥ 85 |
| Trustworthy ordering | Order confirmation email delivered ≥ 98%; zero lost orders |
| Owner can run the business from it | 100% of orders visible and status-updatable in an admin view |

**Non-goals (MVP):** native apps, multi-vendor marketplace, loyalty program, subscriptions, live driver GPS, reviews submission, multi-language, international shipping.

## 3. Users and personas

1. **Folake, urban professional (primary).** Orders on her phone, wants same-day delivery, trusts WhatsApp, hates watery yams.
2. **Diaspora gifter.** Orders for family in Lagos; needs clear delivery address and confirmation email.
3. **Iya Gbenga / staff (admin).** Non-technical. Needs to see new orders, update status, mark items out of stock, and edit products.

## 4. Scope

### MVP (must ship)

Browse, search, filter, sort, pagination; product detail; cart (persisted); Google sign-in; checkout with delivery details and shipping method; place order; confirmation page and email; order history in account; basic admin (products, stock, orders); WhatsApp "order help" link.

### Phase 2 (after launch)

Paystack/Flutterwave online payment, promo codes UI polish, saved addresses, wishlist, reviews, bundles with real discounting, order tracking timeline updates, phone/WhatsApp login, SMS notifications, restock alerts.

### Decision needed: payments

The stack list contains no payment provider, but the design shows Paystack, Flutterwave and a card form. **Recommendation:** MVP launches with **Pay on Delivery** and **Bank Transfer** (order is "Pending payment" until the owner confirms). Add Paystack in Phase 2 using their hosted checkout. Never build a custom card-entry form that touches your own server; remove the card number/CVV fields shown in the checkout design.

## 5. Information architecture and routes

| Route | Screen | Access |
| --- | --- | --- |
| `/` | Home | Public |
| `/groceries` | Catalog (query params: `category`, `q`, `price`, `sort`, `page`) | Public |
| `/groceries/[slug]` | Product detail | Public |
| `/cart` | Shopping cart | Public |
| `/checkout` | Checkout | Signed in |
| `/order-confirmation/[orderNumber]` | Confirmation | Owner of order |
| `/account/orders`, `/account/orders/[id]` | Order history/detail | Signed in |
| `/login` | Sign in / register | Public |
| `/auth/callback` | OAuth callback | System |
| `/admin`, `/admin/products`, `/admin/orders` | Admin | Admin role only |

## 6. Functional requirements

Priority: **P0** = MVP, **P1** = fast follow.

### 6.1 Home (`/`)

- P0: Announcement bar (free delivery threshold), header, hero with CTA to catalog, trust strip, category tiles (from DB), "Best of the Market" product grid with category tabs, "Why us" quality section, testimonials, footer.
- P0: Header on every page: logo, search, account menu, cart button showing item count and total.
- P1: "Market Insider Club" email signup (store in `newsletter_subscribers`). Hide the WhatsApp/email widget until the backend exists.

### 6.2 Catalog (`/groceries`)

- P0: Product grid (responsive 1/2/3-4 columns), badge (Best Seller, Sold Out, etc.), price, Add button.
- P0: Filters: category (multi), price range, stock availability. P1: processing style, origin.
- P0: Sort (Featured, Price low-high, high-low, Newest), per-page (12/24/48), pagination.
- P0: Search with debounce (300ms) over name, description and category; empty state ("No groceries matched…") with suggested searches and a Reset Filters button.
- P0: Filter/sort/page state lives in the URL so pages are shareable and the back button works.
- P0: Sold-out items show "Notify When Restocked" (P1 functionality; P0 can show a disabled state).
- P0: In-grid quantity stepper replaces Add once an item is in the cart.
- Mobile: filters open in a bottom sheet (shadcn Sheet).

### 6.3 Product detail (`/groceries/[slug]`)

- P0: Image gallery with thumbnails, name, origin, SKU, price (and compare-at price if set), stock status, **variant selector** (e.g. 1L / 2.5L / 5L), quantity with per-customer max, Add to Cart, Buy Now (adds then goes to checkout).
- P0: Tabs: Description, Sourcing and Freshness, Storage and Shelf Life. P1: Customer Reviews.
- P0: "Frequently bought together" showing 2-3 related products. P1: add-bundle-to-cart at a discounted price.
- P0: "Order via WhatsApp" opens `wa.me` with a prefilled message (product, size, quantity, link).
- P0: Dynamic SEO metadata and Product JSON-LD.

### 6.4 Cart (`/cart`)

- P0: Line items with image, name, variant, price, quantity stepper (min 1, max by stock/limit), remove. P1: save for later.
- P0: Order summary: subtotal, delivery estimate, discount, total. Totals are recalculated server-side at checkout; the client figure is display only.
- P0: Free-delivery progress bar (threshold from config, ₦35,000 in design).
- P0: Order note field (max 250 chars).
- P0: Empty state with CTA to browse.
- P0: Recommended add-ons.
- P0: Cart persists in `localStorage` for guests and syncs to the database for signed-in users (merge on login).
- P1: Promo code input. Remove the "Reserved fresh for 18:24 mins" timer unless stock is truly reserved.

### 6.5 Authentication

- P0: **Google OAuth only** via Supabase Auth. The design shows phone/password and "Create Account" tabs; simplify to a single "Continue with Google" screen for MVP.
- P0: On first sign-in create a `profiles` row (trigger on `auth.users`).
- P0: Redirect back to the page the user came from (`next` param). Guests can browse and fill a cart; checkout requires sign-in.
- P0: Sign out; session refreshed via Supabase SSR cookies.
- P1: Phone/WhatsApp login.

### 6.6 Checkout (`/checkout`)

- P0: Steps: Delivery, Shipping, Review and Place (design shows 4 steps; payment collapses into a method choice for MVP).
- P0: Delivery form (React Hook Form + Zod): first/last name, Nigerian mobile (`+234`, validated `0[7-9][01]\d{8}`), street address, apartment/gate, state, LGA/area, landmark/instructions. Prefill from profile; option to save as default address.
- P0: Shipping methods loaded from DB: same-day express, next-day, self-pickup, each with price and cut-off time. Lagos-only at launch; show a clear message for unsupported areas.
- P0: Payment method: Pay on Delivery or Bank Transfer (see section 4).
- P0: Order review sidebar: items, subtotal, delivery, discount, total; "Place Order" button with loading and double-submit protection (idempotency key).
- P0: On submit a server action/route handler **re-validates prices, stock and shipping fee from the database**, creates the order and items in one transaction, decrements stock, clears the cart, and triggers the email.
- P0: Clear inline errors; on failure the cart and form values are preserved.

### 6.7 Order confirmation (`/order-confirmation/[orderNumber]`)

- P0: Success banner, order number (e.g. `IG-2026-000123`), email and phone shown, items, totals, payment method and instructions (bank details if transfer), delivery address, status timeline (Received, Packing, Dispatched, Delivered), Print/Download invoice (P1), Continue Shopping, View in Account.
- P0: Only the order owner can view it (RLS).

### 6.8 Order confirmation email (Mailgun)

- P0: Sent after order creation from a server-side function; HTML + plain-text; includes order number, items, totals, address, payment instructions, support contact.
- P0: Log send result in `email_events`; retry up to 3 times with backoff; a failed email must never fail the order.
- P1: Status-change emails (dispatched, delivered). Verify SPF/DKIM on the sending domain.

### 6.9 Account (`/account/orders`)

- P0: List of the user's orders (number, date, status, total) with pagination; detail view; "Reorder" (adds items to cart). P1: saved addresses, track order.

### 6.10 Admin (`/admin`)

The design has an "Admin Portal" link; keep it hidden from non-admins.

- P0: Role check (`profiles.role = 'admin'`) enforced in middleware and RLS.
- P0: Products CRUD (images to Supabase Storage, variants, price, stock, active flag, category), orders list with filters, status updates, view customer and address.
- P1: Dashboard totals, CSV export, manage shipping methods and delivery zones.

## 7. Data model (Supabase PostgreSQL)

| Table | Key fields |
| --- | --- |
| `profiles` | id (= auth.users.id), full_name, email, phone, avatar_url, role (`customer`/`admin`), created_at |
| `categories` | id, name, slug, image_url, sort_order, is_active |
| `products` | id, category_id, name, slug, description, origin, badge, is_active, created_at |
| `product_variants` | id, product_id, label (e.g. "5 Litres Keg"), sku, price_kobo, compare_at_price_kobo, stock_qty, max_per_order |
| `product_images` | id, product_id, url, alt, sort_order |
| `product_related` | product_id, related_product_id |
| `carts`, `cart_items` | user_id, variant_id, quantity (signed-in sync) |
| `addresses` | id, user_id, recipient, phone, street, unit, state, lga, landmark, is_default |
| `shipping_methods` | id, name, price_kobo, eta_text, cutoff_time, is_active |
| `orders` | id, order_number, user_id, status, payment_method, payment_status, subtotal_kobo, shipping_kobo, discount_kobo, total_kobo, shipping_address (jsonb snapshot), shipping_method_id, note, idempotency_key, created_at |
| `order_items` | id, order_id, variant_id, product_name, variant_label, unit_price_kobo, quantity (snapshots) |
| `order_events` | id, order_id, status, note, created_at |
| `email_events` | id, order_id, type, status, provider_id, error, created_at |
| `newsletter_subscribers` | id, email, created_at |

**Rules:** store money as integer **kobo** (never floats); snapshot names, prices and address on the order; `order_number` from a Postgres sequence; order statuses: `pending`, `confirmed`, `packing`, `dispatched`, `delivered`, `cancelled`. Index `products(slug)`, `products(category_id)`, `orders(user_id, created_at desc)`; add a full-text search column on products.

## 8. Security and privacy

- **Row Level Security on every table.** Customers read/write only their own profile, cart, addresses, orders; catalog tables are public read, admin write.
- Service-role key and Mailgun key live only in server environment variables; never exposed to the client.
- Order creation only via server code (RPC/transaction), never direct client inserts to `orders`.
- Validate all input with Zod on the server; sanitize the order note; rate-limit order creation and auth callbacks.
- Google OAuth: configure consent screen, authorised domains and redirect URIs (local, preview, production) in Google Cloud Console and the Supabase dashboard.
- Privacy policy and terms pages, since phone numbers and addresses are collected (NDPR/NDPA compliance). Only claim "256-bit encryption", "Level 1 PCI" or similar if literally true of what you ship.

## 9. Technical architecture

- **Next.js App Router:** server components for catalog and product pages (cached with revalidation); client components for cart, filters, forms. Server actions or route handlers for mutations.
- **Supabase clients:** `@supabase/ssr` for server/browser clients; middleware refreshes sessions and protects `/checkout`, `/account`, `/admin`.
- **Redux Toolkit:** `cartSlice` (items, quantities, derived totals, hydrate from localStorage, sync to DB on login), `uiSlice` (cart drawer, filter sheet). Server data is not duplicated into Redux; fetch it on the server.
- **React Hook Form + Zod:** checkout, address and admin product forms; shadcn `Form`, `Input`, `Select`, `RadioGroup`, `Sheet`, `Dialog`, `Tabs`, `Toast`.
- **Images:** Supabase Storage with `next/image`; WebP, explicit sizes, blur placeholders.
- **Mailgun:** server-side module `lib/email` with templates; domain verified.
- **Hosting:** Vercel (or similar) with separate dev/preview/prod Supabase projects; migrations in version control (Supabase CLI); seed script with \~30 real products.
- **Suggested structure:** `app/(store)/…`, `app/(auth)/…`, `app/admin/…`, `components/ui` (shadcn), `components/store`, `lib/supabase`, `lib/email`, `lib/validators`, `store/` (Redux), `supabase/migrations`.

## 10. Design system (from the screens)

- **Colour:** deep forest green (primary, headers, CTAs), WhatsApp green (secondary CTA), burnt orange/amber (accents, badges, labels), pale blue-lavender page tint, white cards. Define as Tailwind theme tokens and verify WCAG AA contrast (small orange-on-white labels need checking).
- **Type:** Inter for UI; larger bold headings; uppercase micro-labels for eyebrows.
- **Components:** rounded cards (12-16px), pill badges, 44px minimum touch targets, consistent product card, sticky header, toast on add-to-cart.
- **Responsive:** design is desktop-only; produce mobile layouts (bottom sheet filters, collapsed nav in a hamburger drawer, sticky "Add to Cart" bar on product page, single-column checkout with collapsible order summary).
- **States to design:** loading skeletons, empty cart, empty search, out of stock, error, offline.

## 11. Issues found in the current designs (fix before build)

1. **Inconsistent data:** the header cart shows 4 items / ₦48,500 while the cart page totals ₦27,800 and the confirmation ₦28,300; checkout prices (palm oil ₦11,800, yam ₦11,000, crayfish ₦5,000) differ from the cart (₦14,800, ₦9,600, ₦3,400). Item counts conflict (4 vs 3 unique). Real data will resolve this, but align the mock-ups.
2. **Prototype leftovers to remove:** "Toggle Empty State Test", "Query Search Demo", the nav containing every funnel page (Shopping Cart, Secure Checkout, Order Confirmation, Login/Register), and the "Admin Portal" link in the public nav.
3. **Cart discount** `FIRSTHARVEST` (-₦2,000) appears in every screen: needs a real coupons table and rules (first order only) or should be removed from MVP.
4. **Marketing claims** ("18,000+ families", "4.9/5", "100% sand-free", "same-day for every order") must be true or removed; testimonials must be real customers.
5. **Duplicate brand text** in the header ("Iya Gbenga's Store" logo plus "Iya Gbenga's Authentic Groceries") and the "Estimated VAT ... Covered by Mama" line should be simplified.
6. **Unsupported features in the design:** driver tracking, "Call Driver", GPS tracking, Google Pay, Flutterwave: out of MVP; hide them to avoid broken promises.
7. **Terminology:** pick one name ("Iya Gbenga" vs "Mama Gbenga") and use it consistently.
8. Sign-in screen implies phone and password accounts; MVP is Google only.

## 12. Non-functional requirements

- **Performance:** server-render catalog, lazy-load below-fold images, bundle budget \< 200 KB JS on the home route.
- **Accessibility:** WCAG 2.1 AA, keyboard-navigable filters and steppers, labelled form fields, alt text on all product images.
- **SEO:** sitemap, robots, canonical URLs, Open Graph images, Product structured data.
- **Reliability:** order creation is atomic and idempotent; error monitoring (Sentry); structured logging for email and order flows; daily Supabase backups.
- **Analytics:** privacy-friendly analytics with events: `view_item`, `add_to_cart`, `begin_checkout`, `purchase`, `search`.
- **Browser support:** last 2 versions of Chrome, Safari, Firefox, Samsung Internet; 360px minimum width.

## 13. Milestones (suggested, \~6 weeks part-time)

| Phase | Deliverables |
| --- | --- |
| 0. Setup | Repo, Tailwind/shadcn theme tokens, Supabase projects, env config, Google OAuth wired, CI |
| 1. Catalog | Schema + seed, home, catalog with filters/search/pagination, product detail |
| 2. Cart and auth | Redux cart, persistence, Google sign-in, profile creation, cart merge |
| 3. Checkout and orders | Address form, shipping methods, server-side order creation, confirmation page, Mailgun email |
| 4. Account and admin | Order history, admin products/orders, stock updates |
| 5. Hardening | RLS audit, mobile polish, accessibility, performance, SEO, error monitoring, UAT with Iya Gbenga, launch |

## 14. Acceptance criteria (launch checklist)

- A new user can sign in with Google, add 3 items, check out with Pay on Delivery, see the confirmation page, receive the email, and find the order under My Orders, on a 360px phone and on desktop.
- Tampering with prices or quantity in the browser cannot change what is charged; out-of-stock items cannot be ordered.
- A user can never read another user's order (verified with RLS tests).
- Admin can add a product, change stock and move an order through statuses.
- No prototype/demo UI or unverifiable claims remain; legal pages exist.
- Lighthouse mobile: Performance ≥ 85, Accessibility ≥ 95, SEO ≥ 95.

## 15. Risks and open questions

| Risk / question | Mitigation / owner |
| --- | --- |
| Payment approach at launch (COD vs Paystack) | Confirm with Iya Gbenga; default COD + transfer |
| Real inventory and photography (design images are illustrative) | Photograph real stock; start with 20-30 SKUs |
| Delivery zones, fees and cut-off times | Owner to define; store in `shipping_methods` |
| Who confirms bank transfers and updates orders | Admin workflow and daily routine |
| Email deliverability for new domain | Verify domain, warm up, send plain-text fallback |
| Overselling stock | Decrement in the order transaction; low-stock alerts to admin |
| Scope creep from the polished designs | Hold to the MVP list; log extras in Phase 2 |