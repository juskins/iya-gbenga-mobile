-- Atomic, idempotent order creation. Prices, stock and shipping fees are read
-- from the database here; nothing the browser sends is trusted except
-- variant ids and quantities.

create or replace function public.next_order_number()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'IG-' || to_char(now() at time zone 'Africa/Lagos', 'YYYY') || '-'
         || lpad(nextval('public.order_number_seq')::text, 6, '0');
$$;

-- p_items: [{"variant_id": "<uuid>", "quantity": 2}, ...]
-- Raises exceptions with a stable prefix the app can map to messages:
--   EMPTY_CART, INVALID_QUANTITY, VARIANT_UNAVAILABLE, OUT_OF_STOCK,
--   MAX_PER_ORDER, SHIPPING_UNAVAILABLE, INVALID_PAYMENT_METHOD
create or replace function public.create_order(
  p_user_id            uuid,
  p_idempotency_key    text,
  p_items              jsonb,
  p_shipping_method_id uuid,
  p_payment_method     text,
  p_address            jsonb,
  p_contact_email      text,
  p_contact_phone      text,
  p_note               text
)
returns table (order_id uuid, order_number text, total_kobo int)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_existing  public.orders%rowtype;
  v_ship      public.shipping_methods%rowtype;
  v_subtotal  int := 0;
  v_shipping  int := 0;
  v_order_id  uuid;
  v_number    text;
  v_line      record;
begin
  if p_payment_method not in ('pay_on_delivery', 'bank_transfer') then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;

  -- Idempotency: a repeated submit returns the order already created.
  select * into v_existing from public.orders where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.user_id <> p_user_id then
      raise exception 'IDEMPOTENCY_KEY_CONFLICT';
    end if;
    return query select v_existing.id, v_existing.order_number, v_existing.total_kobo;
    return;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  select * into v_ship from public.shipping_methods where id = p_shipping_method_id and is_active;
  if not found then
    raise exception 'SHIPPING_UNAVAILABLE';
  end if;

  -- Merge duplicate variants, lock the rows, validate, and total up from DB prices.
  create temp table _order_lines on commit drop as
  select
    (i ->> 'variant_id')::uuid as variant_id,
    sum((i ->> 'quantity')::int) as quantity
  from jsonb_array_elements(p_items) as i
  group by 1;

  for v_line in
    select l.variant_id, l.quantity, v.label, v.price_kobo, v.stock_qty, v.max_per_order,
           v.is_active as variant_active, p.is_active as product_active, p.name as product_name
    from _order_lines l
    join public.product_variants v on v.id = l.variant_id
    join public.products p on p.id = v.product_id
    order by l.variant_id
    for update of v
  loop
    if v_line.quantity < 1 then raise exception 'INVALID_QUANTITY'; end if;
    if not (v_line.variant_active and v_line.product_active) then
      raise exception 'VARIANT_UNAVAILABLE:%', v_line.variant_id;
    end if;
    if v_line.quantity > v_line.max_per_order then
      raise exception 'MAX_PER_ORDER:%', v_line.variant_id;
    end if;
    if v_line.quantity > v_line.stock_qty then
      raise exception 'OUT_OF_STOCK:%', v_line.variant_id;
    end if;
    v_subtotal := v_subtotal + v_line.price_kobo * v_line.quantity;
  end loop;

  -- Any requested variant that did not join (deleted/unknown) is unavailable.
  if (select count(*) from _order_lines) <>
     (select count(*) from _order_lines l join public.product_variants v on v.id = l.variant_id) then
    raise exception 'VARIANT_UNAVAILABLE';
  end if;

  v_shipping := case
    when v_ship.free_above_kobo is not null and v_subtotal >= v_ship.free_above_kobo then 0
    else v_ship.price_kobo
  end;

  v_number := public.next_order_number();

  begin
    insert into public.orders (
      order_number, user_id, payment_method, subtotal_kobo, shipping_kobo, total_kobo,
      shipping_address, shipping_method_id, shipping_method_name,
      contact_email, contact_phone, note, idempotency_key
    ) values (
      v_number, p_user_id, p_payment_method, v_subtotal, v_shipping, v_subtotal + v_shipping,
      p_address, v_ship.id, v_ship.name,
      p_contact_email, p_contact_phone, nullif(left(trim(coalesce(p_note, '')), 250), ''), p_idempotency_key
    )
    returning id into v_order_id;
  exception when unique_violation then
    -- Lost a race with a concurrent identical submit: return that order.
    select * into v_existing from public.orders where idempotency_key = p_idempotency_key;
    return query select v_existing.id, v_existing.order_number, v_existing.total_kobo;
    return;
  end;

  insert into public.order_items (order_id, variant_id, product_name, variant_label, unit_price_kobo, quantity)
  select v_order_id, l.variant_id, p.name, v.label, v.price_kobo, l.quantity
  from _order_lines l
  join public.product_variants v on v.id = l.variant_id
  join public.products p on p.id = v.product_id;

  update public.product_variants v
     set stock_qty = v.stock_qty - l.quantity
    from _order_lines l
   where v.id = l.variant_id;

  insert into public.order_events (order_id, status, note) values (v_order_id, 'pending', 'Order received');

  return query select v_order_id, v_number, v_subtotal + v_shipping;
end;
$$;

-- Server-only: the browser must never call this directly.
revoke all on function public.create_order(uuid, text, jsonb, uuid, text, jsonb, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_order(uuid, text, jsonb, uuid, text, jsonb, text, text, text)
  to service_role;

-- Log every status change; put stock back when an order is cancelled.
create or replace function public.on_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.order_events (order_id, status) values (new.id, new.status);
    if new.status = 'cancelled' and old.status <> 'cancelled' then
      update public.product_variants v
         set stock_qty = v.stock_qty + oi.quantity
        from public.order_items oi
       where oi.order_id = new.id and oi.variant_id = v.id;
    end if;
  end if;
  return new;
end;
$$;

create trigger orders_status_change
  after update of status on public.orders
  for each row execute function public.on_order_status_change();
