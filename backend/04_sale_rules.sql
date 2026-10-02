create sequence invoice_counter;

create function make_invoice_no(the_branch_id bigint)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  the_code text;
begin
  select code into the_code from branches where id = the_branch_id;
  return 'INV-'
      || coalesce(the_code, 'X')
      || '-' || to_char(now(), 'YYYYMMDD')
      || '-' || lpad(nextval('invoice_counter')::text, 4, '0');
end;
$$;

create function save_sale(
  cart           jsonb,
  money_received numeric,
  how_they_paid  text    default 'cash',
  the_discount   numeric default 0
)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  new_sale_id          bigint;
  my_branch            bigint;
  item                 jsonb;
  the_product          products%rowtype;
  how_many             integer;
  line_before          numeric(10,2);
  line_discount        numeric(10,2);
  sale_subtotal        numeric(10,2) := 0;
  sale_item_discount   numeric(10,2) := 0;
  after_item_discounts numeric(10,2);
  sale_discount        numeric(10,2);
  sale_total           numeric(10,2);
begin
  select branch_id into my_branch from profiles where id = auth.uid();
  if my_branch is null then
    raise exception 'You are not assigned to a branch';
  end if;
  if jsonb_array_length(cart) = 0 then
    raise exception 'The cart is empty';
  end if;
  if the_discount < 0 then
    raise exception 'A discount cannot be a negative number';
  end if;

  insert into sales (invoice_no, cashier_id, branch_id, paid, payment_method)
  values (make_invoice_no(my_branch), auth.uid(), my_branch,
          money_received, how_they_paid)
  returning id into new_sale_id;

  for item in select * from jsonb_array_elements(cart)
  loop
    how_many := (item->>'quantity')::int;
    select * into the_product
      from products where id = (item->>'product_id')::bigint;
    if not found then
      raise exception 'One of the products no longer exists';
    end if;

    line_before   := the_product.selling_price * how_many;
    line_discount := coalesce((item->>'discount')::numeric, 0);
    if line_discount < 0 then
      raise exception 'A discount cannot be a negative number';
    end if;
    line_discount := least(line_discount, line_before);

    insert into sale_items
      (sale_id, product_id, product_name, price, quantity, discount, line_total)
    values
      (new_sale_id, the_product.id, the_product.name,
       the_product.selling_price, how_many, line_discount,
       line_before - line_discount);

    perform take_stock(the_product.id, my_branch, how_many, 'sale', null);

    sale_subtotal      := sale_subtotal + line_before;
    sale_item_discount := sale_item_discount + line_discount;
  end loop;

  after_item_discounts := sale_subtotal - sale_item_discount;
  sale_discount        := least(the_discount, after_item_discounts);
  sale_total           := after_item_discounts - sale_discount;

  if how_they_paid = 'cash' and money_received < sale_total then
    raise exception 'The customer gave % but the total is %',
      money_received, sale_total;
  end if;

  update sales
     set subtotal      = sale_subtotal,
         item_discount = sale_item_discount,
         discount      = sale_discount,
         total         = sale_total,
         change_given  = greatest(money_received - sale_total, 0)
   where id = new_sale_id;

  return new_sale_id;
end;
$$;

create function cancel_sale(the_sale_id bigint, the_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  the_sale      sales%rowtype;
  caller_role   text;
  caller_branch bigint;
  item          record;
begin
  select role, branch_id into caller_role, caller_branch
    from profiles where id = auth.uid();

  select * into the_sale from sales where id = the_sale_id;
  if not found then raise exception 'Sale not found'; end if;

  if caller_role <> 'owner' then
    if caller_role <> 'admin' then
      raise exception 'Only an admin or the owner can cancel a sale';
    end if;
    if caller_branch <> the_sale.branch_id then
      raise exception 'You can only cancel sales at your own branch';
    end if;
  end if;

  if the_sale.status <> 'completed' then
    raise exception 'This sale was already cancelled';
  end if;

  for item in select product_id, quantity from sale_items where sale_id = the_sale_id
  loop
    perform add_batch(item.product_id, the_sale.branch_id, item.quantity,
                      0, null, null, 'cancelled sale', the_reason);
  end loop;

  update sales set status = 'cancelled' where id = the_sale_id;
end;
$$;