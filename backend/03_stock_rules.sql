create function recount_product(the_product_id bigint, the_branch_id bigint)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  branch_total    integer;
  franchise_total integer;
  soonest_expiry  date;
begin
  select coalesce(sum(quantity_left), 0),
         min(expiry_date) filter (where quantity_left > 0)
    into branch_total, soonest_expiry
    from product_batches
   where product_id = the_product_id
     and branch_id  = the_branch_id;

  insert into branch_stock (product_id, branch_id, stock_quantity, expiry_date)
  values (the_product_id, the_branch_id, branch_total, soonest_expiry)
  on conflict (product_id, branch_id)
  do update set stock_quantity = excluded.stock_quantity,
                expiry_date    = excluded.expiry_date;

  select coalesce(sum(stock_quantity), 0)
    into franchise_total
    from branch_stock
   where product_id = the_product_id;

  update products set stock_quantity = franchise_total
   where id = the_product_id;

  return branch_total;
end;
$$;

create function add_batch(
  the_product_id bigint,
  the_branch_id  bigint,
  how_many       integer,
  the_cost       numeric default 0,
  the_expiry     date    default null,
  the_batch_no   text    default null,
  the_reason     text    default 'restock',
  the_note       text    default null
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  caller_role   text;
  caller_branch bigint;
  stock_after   integer;
  new_batch_id  bigint;
begin
  select role, branch_id into caller_role, caller_branch
    from profiles where id = auth.uid();

  if caller_role = 'owner' then
    null;
  elsif caller_role = 'admin' then
    if caller_branch <> the_branch_id then
      raise exception 'You can only add stock at your own branch';
    end if;
  else
    raise exception 'Only an admin or the owner can add stock';
  end if;

  if how_many <= 0 then
    raise exception 'The quantity must be more than zero';
  end if;

  insert into product_batches
    (product_id, branch_id, batch_no, quantity_received, quantity_left,
     cost_price, expiry_date, note)
  values
    (the_product_id, the_branch_id, the_batch_no, how_many, how_many,
     the_cost, the_expiry, the_note)
  returning id into new_batch_id;

  stock_after := recount_product(the_product_id, the_branch_id);

  insert into stock_movements
    (product_id, branch_id, staff_id, batch_id, change, reason, stock_after, note)
  values
    (the_product_id, the_branch_id, auth.uid(), new_batch_id,
     how_many, the_reason, stock_after, the_note);

  return stock_after;
end;
$$;

create function take_stock(
  the_product_id bigint,
  the_branch_id  bigint,
  how_many       integer,
  the_reason     text default 'sale',
  the_note       text default null
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  caller_role      text;
  caller_branch    bigint;
  stock_before     integer;
  stock_after      integer;
  still_needed     integer := how_many;
  take_this_many   integer;
  the_batch        record;
  the_product_name text;
  last_batch_id    bigint;
begin
  if the_reason <> 'sale' then
    select role, branch_id into caller_role, caller_branch
      from profiles where id = auth.uid();

    if caller_role = 'owner' then
      null;
    elsif caller_role = 'admin' then
      if caller_branch <> the_branch_id then
        raise exception 'You can only change stock at your own branch';
      end if;
    else
      raise exception 'Only an admin or the owner can take stock out by hand';
    end if;
  end if;

  select name into the_product_name from products where id = the_product_id;
  if the_product_name is null then
    raise exception 'Product not found';
  end if;

  select coalesce(sum(quantity_left), 0) into stock_before
    from product_batches
   where product_id = the_product_id
     and branch_id  = the_branch_id;

  if stock_before < how_many then
    raise exception 'Not enough stock for %. Only % left at this branch.',
      the_product_name, stock_before;
  end if;

  for the_batch in
    select id, quantity_left
      from product_batches
     where product_id = the_product_id
       and branch_id  = the_branch_id
       and quantity_left > 0
     order by expiry_date asc nulls last, received_at asc
     for update
  loop
    exit when still_needed <= 0;
    take_this_many := least(the_batch.quantity_left, still_needed);

    update product_batches
       set quantity_left = quantity_left - take_this_many
     where id = the_batch.id;

    still_needed  := still_needed - take_this_many;
    last_batch_id := the_batch.id;
  end loop;

  stock_after := recount_product(the_product_id, the_branch_id);

  insert into stock_movements
    (product_id, branch_id, staff_id, batch_id, change, reason, stock_after, note)
  values
    (the_product_id, the_branch_id, auth.uid(), last_batch_id,
     -how_many, the_reason, stock_after, the_note);

  return stock_after;
end;
$$;

create function change_stock(
  the_product_id bigint,
  the_branch_id  bigint,
  the_change     integer,
  the_reason     text,
  the_note       text default null
)
returns integer
language plpgsql security definer set search_path = public
as $$
begin
  if the_change > 0 then
    return add_batch(the_product_id, the_branch_id, the_change,
                     0, null, null, the_reason, the_note);
  else
    return take_stock(the_product_id, the_branch_id, -the_change,
                      the_reason, the_note);
  end if;
end;
$$;