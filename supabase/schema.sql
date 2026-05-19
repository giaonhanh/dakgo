-- ==============================================
-- GIAO NHANH KRONG PAC - Database Schema v1.2
-- Reset & Recreate (dung cho lan setup dau tien)
-- ==============================================

-- Enable PostGIS
create extension if not exists postgis;

-- ==============================================
-- DROP (thu tu nguoc de tranh loi FK)
-- ==============================================
drop trigger if exists trg_update_shop_rating on reviews;
drop function if exists update_shop_rating();

drop table if exists vouchers      cascade;
drop table if exists reviews       cascade;
drop table if exists blacklist     cascade;
drop table if exists drivers       cascade;
drop table if exists order_items   cascade;
drop table if exists orders        cascade;
drop table if exists products      cascade;
drop table if exists shops         cascade;
drop table if exists profiles      cascade;

drop type if exists pay_method     cascade;
drop type if exists service_type   cascade;
drop type if exists order_status   cascade;
drop type if exists user_role      cascade;

-- ==============================================
-- ENUM TYPES
-- ==============================================
create type user_role    as enum ('customer', 'driver', 'shop', 'admin');
create type order_status as enum ('pending', 'accepted', 'delivering', 'done', 'cancelled');
create type service_type as enum ('food', 'buy_for', 'xe_om', 'taxi');
create type pay_method   as enum ('cash', 'vietqr');

-- ==============================================
-- PROFILES
-- ==============================================
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        user_role not null default 'customer',
  full_name   text,
  phone       text unique,
  avatar_url  text,
  address     text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table profiles enable row level security;
create policy "Users see own profile"    on profiles for select using (auth.uid() = id);
create policy "Users update own profile" on profiles for update using (auth.uid() = id);

-- ==============================================
-- SHOPS
-- ==============================================
create table shops (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid references profiles(id) on delete set null,
  name          text not null,
  description   text,
  address       text,
  location      geography(point, 4326),
  phone         text,
  avatar_url    text,
  cover_url     text,
  is_open       boolean not null default true,
  rating        numeric(3,2) default 5.0,
  rating_count  int default 0,
  created_at    timestamptz not null default now()
);
alter table shops enable row level security;
create policy "Anyone can view open shops" on shops for select using (is_open = true);
create policy "Owner manages shop"         on shops for all    using (auth.uid() = owner_id);

-- ==============================================
-- PRODUCTS
-- ==============================================
create table products (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid references shops(id) on delete cascade,
  name         text not null,
  description  text,
  price        int not null,
  image_url    text,
  category     text,
  is_available boolean not null default true,
  discount     int default 0,
  sold_count   int default 0,
  created_at   timestamptz not null default now()
);
alter table products enable row level security;
create policy "Anyone views available products" on products for select using (is_available = true);
create policy "Shop owner manages products"     on products for all
  using (auth.uid() = (select owner_id from shops where id = shop_id));

-- ==============================================
-- ORDERS
-- ==============================================
create table orders (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid references profiles(id),
  driver_id       uuid references profiles(id),
  shop_id         uuid references shops(id),
  service_type    service_type not null default 'food',
  status          order_status not null default 'pending',
  pay_method      pay_method   not null default 'cash',
  total           int not null,
  ship_fee        int not null default 15000,
  note            text,
  cancel_reason   text,
  pickup_address  text,
  drop_address    text,
  pickup_location geography(point, 4326),
  drop_location   geography(point, 4326),
  scheduled_at    timestamptz,
  accepted_at     timestamptz,
  delivered_at    timestamptz,
  cancelled_at    timestamptz,
  created_at      timestamptz not null default now()
);
alter table orders enable row level security;
create policy "Customer sees own orders"    on orders for select using (auth.uid() = customer_id);
create policy "Driver sees assigned orders" on orders for select using (auth.uid() = driver_id);
create policy "Customer creates order"      on orders for insert with check (auth.uid() = customer_id);
create policy "Driver updates order"        on orders for update using (auth.uid() = driver_id);

-- ==============================================
-- ORDER ITEMS
-- ==============================================
create table order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid references orders(id)   on delete cascade,
  product_id  uuid references products(id),
  name        text not null,
  price       int  not null,
  qty         int  not null default 1
);
alter table order_items enable row level security;
create policy "Order owner sees items" on order_items for select
  using (auth.uid() = (select customer_id from orders where id = order_id));

-- ==============================================
-- DRIVERS (realtime location)
-- ==============================================
create table drivers (
  id          uuid primary key references profiles(id),
  is_online   boolean not null default false,
  is_busy     boolean not null default false,
  location    geography(point, 4326),
  updated_at  timestamptz not null default now()
);
alter table drivers enable row level security;
create policy "Driver manages own data"          on drivers for all    using (auth.uid() = id);
create policy "Anyone sees online drivers"       on drivers for select using (is_online = true);

-- ==============================================
-- BLACKLIST
-- ==============================================
create table blacklist (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete cascade,
  reason      text,
  blocked_by  uuid references profiles(id),
  created_at  timestamptz not null default now()
);
alter table blacklist enable row level security;
create policy "Admin manages blacklist" on blacklist for all using (auth.uid() = blocked_by);

-- ==============================================
-- REVIEWS
-- ==============================================
create table reviews (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid references orders(id)   on delete cascade,
  customer_id  uuid references profiles(id),
  shop_id      uuid references shops(id),
  driver_id    uuid references profiles(id),
  shop_stars   int check (shop_stars   between 1 and 5),
  driver_stars int check (driver_stars between 1 and 5),
  comment      text,
  created_at   timestamptz not null default now()
);
alter table reviews enable row level security;
create policy "Customer creates review" on reviews for insert with check (auth.uid() = customer_id);
create policy "Anyone views reviews"    on reviews for select using (true);

-- ==============================================
-- VOUCHERS
-- ==============================================
create table vouchers (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,
  discount_pct  int not null check (discount_pct between 1 and 100),
  max_uses      int default 100,
  used_count    int default 0,
  min_order     int default 0,
  expires_at    timestamptz,
  is_active     boolean default true
);
alter table vouchers enable row level security;
create policy "Anyone views active vouchers" on vouchers for select using (is_active = true);

-- ==============================================
-- TRIGGER: auto update shop rating
-- ==============================================
create or replace function update_shop_rating()
returns trigger language plpgsql as $$
begin
  update shops set
    rating       = (select avg(shop_stars)  from reviews where shop_id = new.shop_id),
    rating_count = (select count(*)         from reviews where shop_id = new.shop_id)
  where id = new.shop_id;
  return new;
end;
$$;

create trigger trg_update_shop_rating
after insert on reviews
for each row execute function update_shop_rating();

-- ==============================================
-- REALTIME
-- ==============================================
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table drivers;
