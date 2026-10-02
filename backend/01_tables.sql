create table branches (
  id         bigserial primary key,
  name       text not null,
  code       text unique,
  address    text,
  phone      text,
  is_active  boolean not null default true,
  created_at timestamptz default now()
);

create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  role       text not null default 'cashier',
  branch_id  bigint references branches(id) on delete set null,
  is_active  boolean not null default true,
  created_at timestamptz default now()
);

create table categories (
  id   bigserial primary key,
  name text not null unique
);

create table products (
  id             bigserial primary key,
  name           text not null,
  barcode        text unique,
  category_id    bigint references categories(id),
  image_url      text,
  cost_price     numeric(10,2) not null default 0,
  selling_price  numeric(10,2) not null default 0,
  stock_quantity integer not null default 0,
  low_stock_at     integer not null default 10,
  expiry_warn_days integer not null default 14,
  expiry_date    date,
  is_active      boolean not null default true,
  created_at     timestamptz default now()
);

create table product_batches (
  id                bigserial primary key,
  product_id        bigint not null references products(id) on delete cascade,
  branch_id         bigint not null references branches(id) on delete cascade,
  batch_no          text,
  quantity_received integer not null,
  quantity_left     integer not null,
  cost_price        numeric(10,2) not null default 0,
  expiry_date       date,
  note              text,
  received_at       timestamptz default now()
);

create table branch_stock (
  product_id     bigint not null references products(id) on delete cascade,
  branch_id      bigint not null references branches(id) on delete cascade,
  stock_quantity integer not null default 0,
  expiry_date    date,
  primary key (product_id, branch_id)
);

create table sales (
  id             bigserial primary key,
  invoice_no     text not null,
  cashier_id     uuid references profiles(id),
  branch_id      bigint not null references branches(id),
  subtotal       numeric(10,2) not null default 0,
  item_discount  numeric(10,2) not null default 0,
  discount       numeric(10,2) not null default 0,
  total          numeric(10,2) not null default 0,
  paid           numeric(10,2) not null default 0,
  change_given   numeric(10,2) not null default 0,
  payment_method text not null default 'cash',
  status         text not null default 'completed',
  created_at     timestamptz default now()
);

create table sale_items (
  id           bigserial primary key,
  sale_id      bigint not null references sales(id) on delete cascade,
  product_id   bigint not null references products(id),
  product_name text not null,
  price        numeric(10,2) not null,
  quantity     integer not null,
  discount     numeric(10,2) not null default 0,
  line_total   numeric(10,2) not null
);

create table stock_movements (
  id          bigserial primary key,
  product_id  bigint not null references products(id) on delete cascade,
  branch_id   bigint not null references branches(id) on delete cascade,
  staff_id    uuid references profiles(id),
  batch_id    bigint references product_batches(id) on delete set null,
  change      integer not null,
  reason      text not null,
  stock_after integer not null,
  note        text,
  created_at  timestamptz default now()
);

create index on products (name);
create index on products (barcode);
create index on profiles (branch_id);
create index on sales (branch_id, created_at);
create index on sale_items (sale_id);
create index on stock_movements (branch_id, product_id, created_at desc);
create index on product_batches (branch_id, product_id, expiry_date, received_at);