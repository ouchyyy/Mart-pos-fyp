create function my_branch()
returns bigint
language sql stable security definer set search_path = public
as $$ select branch_id from profiles where id = auth.uid(); $$;

create function is_owner()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from profiles where id = auth.uid() and role = 'owner'
); $$;

create function is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from profiles where id = auth.uid() and role in ('admin', 'owner')
); $$;

alter table branches        enable row level security;
alter table profiles        enable row level security;
alter table categories      enable row level security;
alter table products        enable row level security;
alter table product_batches enable row level security;
alter table branch_stock    enable row level security;
alter table sales           enable row level security;
alter table sale_items      enable row level security;
alter table stock_movements enable row level security;
alter table clearance_rules enable row level security;

create policy "read own branch" on branches
  for select to authenticated
  using (id = my_branch() or is_owner());

create policy "owner manages branches" on branches
  for all using (is_owner()) with check (is_owner());

create policy "read profiles" on profiles
  for select to authenticated
  using (
    id = auth.uid() or is_owner()
    or (is_admin() and branch_id = my_branch())
  );

create policy "manage profiles" on profiles
  for all using (is_owner() or (is_admin() and branch_id = my_branch()))
  with check (is_owner() or (is_admin() and branch_id = my_branch()));

create policy "everyone reads categories" on categories
  for select to authenticated using (true);
create policy "admin changes categories" on categories
  for all using (is_admin()) with check (is_admin());

create policy "everyone reads products" on products
  for select to authenticated using (true);
create policy "admin changes products" on products
  for all using (is_admin()) with check (is_admin());

create policy "read batches" on product_batches
  for select to authenticated
  using (branch_id = my_branch() or is_owner());

create policy "read branch stock" on branch_stock
  for select to authenticated
  using (branch_id = my_branch() or is_owner());

create policy "read stock history" on stock_movements
  for select to authenticated
  using (branch_id = my_branch() or is_owner());

create policy "read sales" on sales
  for select using (
    is_owner() or cashier_id = auth.uid()
    or (is_admin() and branch_id = my_branch())
  );

create policy "read sale items" on sale_items
  for select using (
    exists (
      select 1 from sales
       where sales.id = sale_items.sale_id
         and (is_owner()
              or sales.cashier_id = auth.uid()
              or (is_admin() and sales.branch_id = my_branch()))
    )
  );

create policy "everyone reads clearance rules" on clearance_rules
  for select to authenticated using (true);
create policy "owner changes clearance rules" on clearance_rules
  for all using (is_owner()) with check (is_owner());

drop policy if exists "staff upload pictures" on storage.objects;
drop policy if exists "staff replace pictures" on storage.objects;
drop policy if exists "staff delete pictures" on storage.objects;

create policy "staff upload pictures" on storage.objects
  for insert to authenticated with check (bucket_id = 'products');
create policy "staff replace pictures" on storage.objects
  for update to authenticated using (bucket_id = 'products');
create policy "staff delete pictures" on storage.objects
  for delete to authenticated using (bucket_id = 'products');