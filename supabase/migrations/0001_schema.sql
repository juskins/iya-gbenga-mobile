-- Iya Gbenga's Store: core schema (PRD section 7).
-- Money is ALWAYS integer kobo. Orders snapshot names, prices and address.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  email       text,
  phone       text,
  avatar_url  text,
  role        text not null default 'customer' check (role in ('customer', 'admin')),
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------- catalog
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  image_url   text,
  sort_order  int  not null default 0,
  is_active   boolean not null default true
);

create table public.products (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references public.categories (id),
  name         text not null,
  slug         text not null unique,
  description  text not null default '',
  origin       text,
  badge        text,
  badge_tone   text check (badge_tone in ('secondary', 'primary', 'tertiary', 'orange', 'error', 'mint')),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  search_tsv   tsvector generated always as (
    to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(origin, ''))
  ) stored
);
create index products_category_idx on public.products (category_id);
create index products_search_idx   on public.products using gin (search_tsv);

create table public.product_variants (
  id                    uuid primary key default gen_random_uuid(),
  product_id            uuid not null references public.products (id) on delete cascade,
  label                 text not null,
  sku                   text not null unique,
  price_kobo            int  not null check (price_kobo >= 0),
  compare_at_price_kobo int  check (compare_at_price_kobo is null or compare_at_price_kobo > price_kobo),
  stock_qty             int  not null default 0 check (stock_qty >= 0),
  max_per_order         int  not null default 10 check (max_per_order > 0),
  is_active             boolean not null default true
);
create index product_variants_product_idx on public.product_variants (product_id);

create table public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  url         text not null,
  alt         text,
  sort_order  int not null default 0
);
create index product_images_product_idx on public.product_images (product_id, sort_order);

create table public.product_related (
  product_id          uuid not null references public.products (id) on delete cascade,
  related_product_id  uuid not null references public.products (id) on delete cascade,
  primary key (product_id, related_product_id),
  check (product_id <> related_product_id)
);

-- ------------------------------------------------------------ cart (synced)
create table public.carts (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  note        text check (note is null or char_length(note) <= 250),
  updated_at  timestamptz not null default now()
);

create table public.cart_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.carts (user_id) on delete cascade,
  variant_id  uuid not null references public.product_variants (id) on delete cascade,
  quantity    int  not null check (quantity > 0),
  unique (user_id, variant_id)
);

-- --------------------------------------------------------------- addresses
create table public.addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  recipient   text not null,
  phone       text not null,
  street      text not null,
  unit        text,
  state       text not null,
  lga         text not null,
  landmark    text,
  is_default  boolean not null default false
);
create index addresses_user_idx on public.addresses (user_id);
create unique index addresses_one_default_idx on public.addresses (user_id) where is_default;

-- ---------------------------------------------------------------- shipping
create table public.shipping_methods (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  price_kobo       int  not null check (price_kobo >= 0),
  free_above_kobo  int  check (free_above_kobo is null or free_above_kobo > 0),
  eta_text         text not null,
  cutoff_time      time,
  sort_order       int not null default 0,
  is_active        boolean not null default true
);

-- ------------------------------------------------------------------ orders
create sequence public.order_number_seq start 1;

create table public.orders (
  id                    uuid primary key default gen_random_uuid(),
  order_number          text not null unique,
  user_id               uuid not null references public.profiles (id),
  status                text not null default 'pending'
                          check (status in ('pending', 'confirmed', 'packing', 'dispatched', 'delivered', 'cancelled')),
  payment_method        text not null check (payment_method in ('pay_on_delivery', 'bank_transfer')),
  payment_status        text not null default 'pending' check (payment_status in ('pending', 'paid')),
  subtotal_kobo         int  not null check (subtotal_kobo >= 0),
  shipping_kobo         int  not null check (shipping_kobo >= 0),
  discount_kobo         int  not null default 0 check (discount_kobo >= 0),
  total_kobo            int  not null check (total_kobo >= 0),
  shipping_address      jsonb not null,
  shipping_method_id    uuid references public.shipping_methods (id),
  shipping_method_name  text not null,
  contact_email         text not null,
  contact_phone         text not null,
  note                  text check (note is null or char_length(note) <= 250),
  idempotency_key       text not null unique,
  created_at            timestamptz not null default now()
);
create index orders_user_created_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);

create table public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders (id) on delete cascade,
  variant_id       uuid references public.product_variants (id) on delete set null,
  product_name     text not null,
  variant_label    text not null,
  unit_price_kobo  int  not null check (unit_price_kobo >= 0),
  quantity         int  not null check (quantity > 0)
);
create index order_items_order_idx on public.order_items (order_id);

create table public.order_events (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  status      text not null,
  note        text,
  created_at  timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);

create table public.email_events (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid references public.orders (id) on delete set null,
  type         text not null,
  status       text not null check (status in ('sent', 'failed')),
  provider_id  text,
  error        text,
  created_at   timestamptz not null default now()
);

create table public.newsletter_subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  created_at  timestamptz not null default now()
);
