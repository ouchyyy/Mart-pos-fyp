create table clearance_rules (
  id          bigserial primary key,
  days_before integer not null unique,
  percent_off integer not null check (percent_off between 1 and 100)
);

insert into clearance_rules (days_before, percent_off) values
  (14, 50),
  (7, 75);

create function clearance_percent(the_expiry date)
returns integer
language sql stable
as $$
  select coalesce(
    (select max(percent_off)
       from clearance_rules
      where the_expiry is not null
        and the_expiry >= current_date
        and the_expiry <= current_date + days_before),
    0
  );
$$;

create view products_for_sale as
select p.*,
       c.name                                as category_name,
       clearance_percent(p.expiry_date)      as clearance_percent,
       round(
         p.selling_price * (1 - clearance_percent(p.expiry_date) / 100.0),
         2
       )                                     as price_today,
       (p.expiry_date - current_date)        as days_to_expiry
  from products p
  left join categories c on c.id = p.category_id;

grant select on products_for_sale to authenticated;