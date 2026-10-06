-- Cross-device cart sync (website + mobile app).
-- The database is the source of truth for SIGNED-IN users. Every client (web, mobile)
-- reads/writes the cart ONLY through these functions, so stock and per-order limits are
-- enforced identically everywhere. Functions run as the caller (SECURITY INVOKER), so the
-- existing RLS policies ("owner only") still apply.

alter table public.cart_items add column if not exists created_at timestamptz not null default now();
alter table public.cart_items add column if not exists updated_at timestamptz not null default now();

-- ------------------------------------------------------------------ realtime
-- Clients subscribe to UPDATE/INSERT events on THEIR row of public.carts (filter: user_id=eq.<uid>).
-- Realtime cannot reliably deliver filtered DELETE events, so instead of listening to cart_items
-- we bump carts.updated_at (trigger below) on EVERY cart_items insert/update/delete. That makes
-- every change, including removals and writes made by server code, arrive as a filterable UPDATE.
-- The event is only a signal: clients then call get_cart() to read the real state.
alter table public.carts replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'carts') then
    alter publication supabase_realtime add table public.carts;
  end if;
end $$;

create or replace function public.touch_cart()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.carts set updated_at = now() where user_id = coalesce(new.user_id, old.user_id);
  return null;
end;
$$;

drop trigger if exists cart_items_touch_cart on public.cart_items;
create trigger cart_items_touch_cart
  after insert or update or delete on public.cart_items
  for each row execute function public.touch_cart();

-- ----------------------------------------------------------------- functions
-- Error codes (exception message prefixes): UNAUTHENTICATED, INVALID_QUANTITY,
-- VARIANT_UNAVAILABLE, OUT_OF_STOCK.

-- Adds p_quantity to the line (delta). Returns the new quantity, clamped to
-- min(max_per_order, stock).
create or replace function public.add_to_cart(p_variant_id uuid, p_quantity int default 1)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_limit int;
  v_new   int;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_quantity is null or p_quantity < 1 then raise exception 'INVALID_QUANTITY'; end if;

  select least(v.max_per_order, v.stock_qty) into v_limit
    from public.product_variants v
    join public.products p on p.id = v.product_id
   where v.id = p_variant_id and v.is_active and p.is_active;
  if not found then raise exception 'VARIANT_UNAVAILABLE'; end if;
  if v_limit < 1 then raise exception 'OUT_OF_STOCK'; end if;

  insert into public.carts (user_id) values (v_uid)
    on conflict (user_id) do update set updated_at = now();

  insert into public.cart_items (user_id, variant_id, quantity)
  values (v_uid, p_variant_id, least(p_quantity, v_limit))
  on conflict (user_id, variant_id) do update
    set quantity = least(cart_items.quantity + p_quantity, v_limit), updated_at = now()
  returning quantity into v_new;

  return v_new;
end;
$$;

-- Sets the line to an absolute quantity (<= 0 removes it). Returns the final quantity.
create or replace function public.set_cart_quantity(p_variant_id uuid, p_quantity int)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_limit int;
  v_new   int;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_quantity is null then raise exception 'INVALID_QUANTITY'; end if;

  if p_quantity <= 0 then
    delete from public.cart_items where user_id = v_uid and variant_id = p_variant_id;
    return 0;
  end if;

  select least(v.max_per_order, v.stock_qty) into v_limit
    from public.product_variants v
    join public.products p on p.id = v.product_id
   where v.id = p_variant_id and v.is_active and p.is_active;
  if not found then raise exception 'VARIANT_UNAVAILABLE'; end if;
  if v_limit < 1 then raise exception 'OUT_OF_STOCK'; end if;

  insert into public.carts (user_id) values (v_uid)
    on conflict (user_id) do update set updated_at = now();

  insert into public.cart_items (user_id, variant_id, quantity)
  values (v_uid, p_variant_id, least(p_quantity, v_limit))
  on conflict (user_id, variant_id) do update
    set quantity = least(p_quantity, v_limit), updated_at = now()
  returning quantity into v_new;

  return v_new;
end;
$$;

create or replace function public.remove_from_cart(p_variant_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  delete from public.cart_items where user_id = auth.uid() and variant_id = p_variant_id;
end;
$$;

-- Order note (max 250 chars). Pass null/'' to clear.
create or replace function public.set_cart_note(p_note text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  insert into public.carts (user_id, note)
  values (v_uid, nullif(left(trim(coalesce(p_note, '')), 250), ''))
  on conflict (user_id) do update
    set note = nullif(left(trim(coalesce(p_note, '')), 250), ''), updated_at = now();
end;
$$;

create or replace function public.clear_cart()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  delete from public.cart_items where user_id = auth.uid();
  update public.carts set note = null, updated_at = now() where user_id = auth.uid();
end;
$$;

-- Merges a guest (local) cart into the signed-in cart, e.g. right after sign-in.
-- p_items: [{"variant_id": "<uuid>", "quantity": 2}, ...]
-- Idempotent: quantity = max(existing, incoming), clamped to the limit, so a retried merge
-- never doubles anything. Unavailable variants are skipped. Keeps an existing note.
create or replace function public.merge_cart(p_items jsonb, p_note text default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_item  jsonb;
  v_vid   uuid;
  v_qty   int;
  v_limit int;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;

  insert into public.carts (user_id) values (v_uid)
    on conflict (user_id) do update set updated_at = now();

  if p_items is not null and jsonb_typeof(p_items) = 'array' then
    for v_item in select * from jsonb_array_elements(p_items) loop
      begin
        v_vid := (v_item ->> 'variant_id')::uuid;
        v_qty := (v_item ->> 'quantity')::int;
      exception when others then
        continue;
      end;
      continue when v_qty is null or v_qty < 1;

      select least(v.max_per_order, v.stock_qty) into v_limit
        from public.product_variants v
        join public.products p on p.id = v.product_id
       where v.id = v_vid and v.is_active and p.is_active;
      continue when not found or v_limit < 1;

      insert into public.cart_items (user_id, variant_id, quantity)
      values (v_uid, v_vid, least(v_qty, v_limit))
      on conflict (user_id, variant_id) do update
        set quantity = least(greatest(cart_items.quantity, v_qty), v_limit), updated_at = now();
    end loop;
  end if;

  if nullif(trim(coalesce(p_note, '')), '') is not null then
    update public.carts
       set note = left(trim(p_note), 250)
     where user_id = v_uid and note is null;
  end if;
end;
$$;

-- Returns the whole cart in one call, with LIVE prices and limits:
-- { "note": string|null, "items": [ { variantId, productSlug, name, variantLabel, image,
--   unitPriceKobo, quantity, maxPerOrder, stockQty, available } ] }
-- Lines are ordered oldest first. `available` is false when the variant is out of stock.
create or replace function public.get_cart()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_note  text;
  v_items jsonb;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;

  select c.note into v_note from public.carts c where c.user_id = v_uid;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'variantId',     v.id,
      'productSlug',   p.slug,
      'name',          p.name,
      'variantLabel',  v.label,
      'image',         (select pi.url from public.product_images pi
                         where pi.product_id = p.id order by pi.sort_order limit 1),
      'unitPriceKobo', v.price_kobo,
      'quantity',      case when v.stock_qty > 0
                            then least(ci.quantity, v.max_per_order, v.stock_qty)
                            else ci.quantity end,
      'maxPerOrder',   greatest(least(v.max_per_order, v.stock_qty), 0),
      'stockQty',      v.stock_qty,
      'available',     v.stock_qty > 0
    ) order by ci.created_at, ci.id
  ), '[]'::jsonb)
  into v_items
  from public.cart_items ci
  join public.product_variants v on v.id = ci.variant_id
  join public.products p on p.id = v.product_id
  where ci.user_id = v_uid;

  return jsonb_build_object('note', v_note, 'items', v_items);
end;
$$;

-- Only signed-in users may call these (never anon).
revoke all on function public.add_to_cart(uuid, int)        from public, anon;
revoke all on function public.set_cart_quantity(uuid, int)  from public, anon;
revoke all on function public.remove_from_cart(uuid)        from public, anon;
revoke all on function public.set_cart_note(text)           from public, anon;
revoke all on function public.clear_cart()                  from public, anon;
revoke all on function public.merge_cart(jsonb, text)       from public, anon;
revoke all on function public.get_cart()                    from public, anon;

grant execute on function public.add_to_cart(uuid, int)        to authenticated;
grant execute on function public.set_cart_quantity(uuid, int)  to authenticated;
grant execute on function public.remove_from_cart(uuid)        to authenticated;
grant execute on function public.set_cart_note(text)           to authenticated;
grant execute on function public.clear_cart()                  to authenticated;
grant execute on function public.merge_cart(jsonb, text)       to authenticated;
grant execute on function public.get_cart()                    to authenticated;
