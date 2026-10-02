# Backend — the database

There is no server here. Everything the shop needs to enforce lives inside
Postgres: the rules are functions, the permissions are policies.

Run these in the Supabase **SQL Editor**, in order.

---

## The seven files

| # | File | What it is |
|---|---|---|
| 1 | `01_tables.sql` | the shape of the data, nothing else |
| 2 | `02_new_user.sql` | give every signup a profile row |
| 3 | `03_stock_rules.sql` | how stock moves |
| 4 | `04_sale_rules.sql` | how a sale is saved |
| 5 | `05_sample_data.sql` | twelve test products *(optional)* |
| 6 | `06_clearance.sql` | automatic markdowns near expiry |
| — | *create your account, then make it admin* | |
| 7 | `07_security.sql` | who may see and change what |

All seven are needed except file 5, which is only test data.

### Between 6 and 7

Create the account in the dashboard (Authentication → Add user, email
`admin@mart.local`, tick Auto Confirm), then:

```sql
update profiles set role = 'admin', full_name = 'Your Name'
where id = (select id from auth.users where email = 'admin@mart.local');
```

Only then run file 7. Running it earlier locks you out of your own product
screen, because only admins may edit products.

---

## What each file is about

### 1. Tables

Seven tables. The one idea to understand first: **a product does not hold
its stock as a number you type.** Stock lives in batches, and the number on
the product is added up from them.

Sales keep four money columns rather than one — subtotal, item discounts,
sale discount, total. If only the final figure were kept, nobody could
answer "how much did we give away last month?", which is the first thing an
owner asks when the takings look thin.

### 2. New user

Short and on its own, because it is the piece most likely to need running
again by itself. If signup ever fails with *"Database error creating new
user"*, this is the file.

Two lines in it matter: `security definer` lets it write to a table the new
person has no rights to, and `set search_path = public` tells it where to
look. Supabase runs it from its own auth schema, so without that line it
cannot find the table and every signup fails.

### 3. Stock rules

Four functions serving one rule: `products.stock_quantity` is never written
by hand. `recount_product` adds up the batches after every change, so the
headline number can never drift away from them.

`take_stock` sells from the batch expiring soonest — **FEFO**, First
Expired First Out. It is what a shopkeeper does when they move the old milk
to the front of the shelf. One sale can cross several batches.

Only admins may move stock by hand. Selling is the exception, since that is
how stock is meant to go down.

### 4. Sale rules

`save_sale` is the function worth reading. Selling means four jobs: make the
sale, save each item, take the stock away, write the history. All four
happen inside one function, so they either **all** happen or **none** do. If
the third product has no stock, the first two are undone with it. There is
no such thing as half a sale.

It handles two kinds of discount, and the order matters: item discounts come
off first, then the sale discount comes off what is left. The other way
round, a percentage could be taken from a price nobody ever paid.

`cancel_sale` never deletes. The sale stays, marked cancelled, and the stock
comes back as a new batch — we cannot know which batch it left, and guessing
would be worse than admitting that.

### 5. Sample data

Set up so the warnings have something to show: two products below their
stock warning, two expiring soon. Stock goes in as batches, not as a number
on the product — writing the number directly would be wiped by the next
recount, and nothing would be there to sell.

### 6. Clearance

Food about to go off is worth more sold cheap than thrown away. The steps
are a **table**, not an `IF` inside a function, so the shop can change its
own rule without anyone editing SQL: 14 days out is 50% off, 7 days is 75%.

`products_for_sale` is the view every screen reads. It adds what a product
costs *today* to what it costs normally, so the till, the reports and the
stock list cannot disagree about a price.

Two cases return zero on purpose. Something with no expiry date does not go
off. Something already expired should be written off rather than sold — a
system offering 75% off out-of-date food is nudging the shop into selling
it.

### 7. Security

Replaces what would otherwise be permission checks scattered through the
website. Two roles: admin and cashier. A cashier sees their own sales; an
admin sees the shop's.

Once this runs, **a table gives back nothing unless a policy allows it.** An
empty screen with rows visible in the Table Editor means a missing policy,
not a bug in React.

---

## Checking it worked

```sql
-- all nine functions present?
select proname from pg_proc
 where pronamespace = 'public'::regnamespace and prokind = 'f'
 order by proname;

-- ring up a test sale (use a real product id)
select save_sale('[{"product_id": 1, "quantity": 2}]'::jsonb, 10, 'cash', 0);

-- the stock should have moved, and been written down
select name, stock_quantity from products where id = 1;
select * from stock_movements order by created_at desc limit 5;
```

Then try again with an absurd quantity. You should get an error **and** no
new sale row. That rollback is the thing worth demonstrating.
