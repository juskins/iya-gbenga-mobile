-- Row Level Security on EVERY table, plus profile creation on first sign-in.

-- Admin check. SECURITY DEFINER so policies can read profiles without recursion.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Create a profiles row whenever a user signs up (Google OAuth or otherwise).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Enable RLS everywhere.
alter table public.profiles               enable row level security;
alter table public.categories             enable row level security;
alter table public.products               enable row level security;
alter table public.product_variants       enable row level security;
alter table public.product_images         enable row level security;
alter table public.product_related        enable row level security;
alter table public.carts                  enable row level security;
alter table public.cart_items             enable row level security;
alter table public.addresses              enable row level security;
alter table public.shipping_methods       enable row level security;
alter table public.orders                 enable row level security;
alter table public.order_items            enable row level security;
alter table public.order_events           enable row level security;
alter table public.email_events           enable row level security;
alter table public.newsletter_subscribers enable row level security;

-- ---------------------------------------------------------------- profiles
create policy "profiles: read own or admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles: update own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
-- Customers may edit only these columns. 'role' can never be changed from the client.
revoke update on public.profiles from authenticated, anon;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;

-- ------------------------------------------- catalog: public read, admin write
create policy "categories: public read active" on public.categories
  for select using (is_active or public.is_admin());
create policy "categories: admin write" on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

create policy "products: public read active" on public.products
  for select using (is_active or public.is_admin());
create policy "products: admin write" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

create policy "variants: public read active" on public.product_variants
  for select using (is_active or public.is_admin());
create policy "variants: admin write" on public.product_variants
  for all using (public.is_admin()) with check (public.is_admin());

create policy "images: public read" on public.product_images
  for select using (true);
create policy "images: admin write" on public.product_images
  for all using (public.is_admin()) with check (public.is_admin());

create policy "related: public read" on public.product_related
  for select using (true);
create policy "related: admin write" on public.product_related
  for all using (public.is_admin()) with check (public.is_admin());

create policy "shipping: public read active" on public.shipping_methods
  for select using (is_active or public.is_admin());
create policy "shipping: admin write" on public.shipping_methods
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------- cart + addresses: owner only
create policy "carts: owner" on public.carts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "cart_items: owner" on public.cart_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "addresses: owner" on public.addresses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ------------------------------------------------------------------ orders
-- No INSERT policy on purpose: orders are created ONLY by public.create_order()
-- (called from server code with the service-role key). Customers read their own;
-- admins read and update status/payment_status.
create policy "orders: owner read" on public.orders
  for select using (user_id = auth.uid());
create policy "orders: admin read" on public.orders
  for select using (public.is_admin());
create policy "orders: admin update" on public.orders
  for update using (public.is_admin()) with check (public.is_admin());
-- Admins may change ONLY status and payment_status.
revoke update on public.orders from authenticated, anon;
grant update (status, payment_status) on public.orders to authenticated;

create policy "order_items: owner read" on public.order_items
  for select using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy "order_items: admin read" on public.order_items
  for select using (public.is_admin());

create policy "order_events: owner read" on public.order_events
  for select using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy "order_events: admin read" on public.order_events
  for select using (public.is_admin());

create policy "email_events: admin read" on public.email_events
  for select using (public.is_admin());

-- newsletter_subscribers: no policies = no client access; server inserts via service role.
