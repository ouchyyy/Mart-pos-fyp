// ============================================================
// database.js
//
// Every conversation with the database happens in this file.
// The pages call these functions and never talk to Supabase
// directly, so if data looks wrong, this is the file to open.
//
// The branch idea shows up here in three ways:
//   - Most read functions take a branchId (null means "all").
//   - Stock writes take a branchId.
//   - save_sale does NOT take one, because the database reads
//     it from the signed-in cashier.
// ============================================================

import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Supabase gives back { data, error } instead of throwing an error.
// This little helper throws instead, so our pages can use try/catch.
function check(result) {
  if (result.error) {
    throw new Error(result.error.message);
  }
  return result.data;
}

// Staff type a username like "admin", but Supabase needs an email.
// So we add a fake domain onto the end. No email is ever sent.
function makeEmail(username) {
  if (username.includes('@')) return username;
  return username + '@mart.local';
}

// ------------------------------------------------------------
// Signing in and out
// ------------------------------------------------------------

export async function signIn(username, password) {
  const result = await supabase.auth.signInWithPassword({
    email: makeEmail(username),
    password: password,
  });

  if (result.error) {
    throw new Error('Wrong username or password');
  }

  return getMyProfile();
}

export async function signOut() {
  await supabase.auth.signOut();
}

// Returns the signed-in person, with the branch they belong to
// flattened in, or null if nobody is signed in.
export async function getMyProfile() {
  const session = await supabase.auth.getSession();

  if (!session.data.session) return null;

  const myId = session.data.session.user.id;

  return check(
    await supabase
      .from('profiles')
      .select('*, branches(id, name, code)')
      .eq('id', myId)
      .single()
  );
}

// ------------------------------------------------------------
// Branches
// ------------------------------------------------------------

export async function getBranches() {
  return check(
    await supabase
      .from('branches')
      .select('*')
      .eq('is_active', true)
      .order('name')
  );
}

export async function getBranchSummary() {
  return check(await supabase.from('branch_summary').select('*').order('name'));
}

export async function addBranch(branch) {
  return check(
    await supabase.from('branches').insert(branch).select().single()
  );
}

export async function updateBranch(id, branch) {
  return check(
    await supabase.from('branches').update(branch).eq('id', id).select().single()
  );
}

export async function hideBranch(id) {
  return check(
    await supabase.from('branches').update({ is_active: false }).eq('id', id)
  );
}

// ------------------------------------------------------------
// Products — the catalogue is shared across all branches
// ------------------------------------------------------------

// Head-office view: all products, franchise-wide stock.
export async function getProducts(search) {
  let query = supabase
    .from('products_for_sale')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (search) {
    query = query.or('name.ilike.%' + search + '%,barcode.eq.' + search);
  }

  return check(await query);
}

// The till reads this: one branch's view of the catalogue,
// with that branch's stock and that branch's clearance prices.
export async function getProductsForBranch(branchId, search) {
  const rows = check(
    await supabase.rpc('products_for_branch', { the_branch_id: branchId })
  );

  const active = rows.filter((p) => p.is_active);
  if (!search) return active;

  const text = search.toLowerCase();
  return active.filter(
    (p) =>
      p.name.toLowerCase().includes(text) ||
      (p.barcode || '').includes(search)
  );
}

export async function getProductByBarcode(barcode, branchId) {
  const rows = check(
    await supabase.rpc('products_for_branch', { the_branch_id: branchId })
  );
  return rows.find((p) => p.barcode === barcode && p.is_active) || null;
}

export async function addProduct(product) {
  return check(
    await supabase.from('products').insert(product).select().single()
  );
}

export async function updateProduct(id, product) {
  return check(
    await supabase.from('products').update(product).eq('id', id).select().single()
  );
}

export async function hideProduct(id) {
  return check(
    await supabase.from('products').update({ is_active: false }).eq('id', id)
  );
}

// ------------------------------------------------------------
// Product pictures
// ------------------------------------------------------------

export async function uploadPicture(file) {
  const ending = file.name.split('.').pop();
  const fileName = Date.now() + '-' + Math.round(Math.random() * 10000) + '.' + ending;

  const upload = await supabase.storage.from('products').upload(fileName, file);
  if (upload.error) throw new Error(upload.error.message);

  return supabase.storage.from('products').getPublicUrl(fileName).data.publicUrl;
}

// ------------------------------------------------------------
// Categories — shared across all branches
// ------------------------------------------------------------

export async function getCategories() {
  return check(await supabase.from('categories').select('*').order('name'));
}

export async function addCategory(name) {
  return check(
    await supabase.from('categories').insert({ name }).select().single()
  );
}

export async function renameCategory(id, name) {
  return check(
    await supabase.from('categories').update({ name }).eq('id', id)
  );
}

export async function deleteCategory(id) {
  const inUse = check(
    await supabase.from('products').select('id').eq('category_id', id).limit(1)
  );

  if (inUse.length > 0) {
    throw new Error('Some products are still in this category');
  }

  return check(await supabase.from('categories').delete().eq('id', id));
}

// ------------------------------------------------------------
// Stock — per branch
// ------------------------------------------------------------

export async function addBatch(productId, branchId, quantity, details) {
  return check(
    await supabase.rpc('add_batch', {
      the_product_id: productId,
      the_branch_id:  branchId,
      how_many:       quantity,
      the_cost:       Number(details.cost) || 0,
      the_expiry:     details.expiry || null,
      the_batch_no:   details.batchNo || null,
      the_reason:     details.reason || 'restock',
      the_note:       details.note || null,
    })
  );
}

export async function takeStock(productId, branchId, quantity, reason, note) {
  return check(
    await supabase.rpc('take_stock', {
      the_product_id: productId,
      the_branch_id:  branchId,
      how_many:       quantity,
      the_reason:     reason,
      the_note:       note || null,
    })
  );
}

export async function getBatches(productId, branchId) {
  return check(
    await supabase
      .from('product_batches')
      .select('*')
      .eq('product_id', productId)
      .eq('branch_id', branchId)
      .gt('quantity_left', 0)
      .order('expiry_date', { ascending: true, nullsFirst: false })
      .order('received_at')
  );
}

// branchId == null means "every branch I can see" (owner only).
export async function getStockHistory(branchId, productId) {
  let query = supabase
    .from('stock_movements')
    .select('*, products(name), profiles(full_name), branches(name)')
    .order('created_at', { ascending: false })
    .limit(300);

  if (branchId)  query = query.eq('branch_id', branchId);
  if (productId) query = query.eq('product_id', productId);

  return check(await query);
}

// ------------------------------------------------------------
// Sales
// ------------------------------------------------------------

export async function saveSale(cart, moneyReceived, paymentMethod, discount) {
  const saleId = check(
    await supabase.rpc('save_sale', {
      cart: cart,
      money_received: moneyReceived,
      how_they_paid:  paymentMethod || 'cash',
      the_discount:   Number(discount) || 0,
    })
  );

  return getSale(saleId);
}

export async function getSale(id) {
  return check(
    await supabase
      .from('sales')
      .select('*, sale_items(*), profiles(full_name), branches(name, code)')
      .eq('id', id)
      .single()
  );
}

export async function getSales(branchId, fromDate, toDate) {
  let query = supabase
    .from('sales')
    .select('*, profiles(full_name), branches(name, code)')
    .order('created_at', { ascending: false })
    .limit(300);

  if (branchId) query = query.eq('branch_id', branchId);
  if (fromDate) query = query.gte('created_at', fromDate);
  if (toDate)   query = query.lte('created_at', toDate + 'T23:59:59');

  return check(await query);
}

export async function cancelSale(id, reason) {
  return check(
    await supabase.rpc('cancel_sale', {
      the_sale_id: id,
      the_reason:  reason,
    })
  );
}

// ------------------------------------------------------------
// Sales by product — every product that sold in a period
//
// Groups sale_items by product and totals the units sold, the
// funds received, and how many distinct sales contained the
// product. That last number is what the "Times sold" column
// shows — three bottles in one sale is one sale, not three.
// ------------------------------------------------------------
export async function getSalesByProduct(branchId, fromDate, toDate) {
  let q = supabase
    .from('sale_items')
    .select(
      'product_id, product_name, price, quantity, line_total, sales!inner(id, created_at, status, branch_id)'
    )
    .eq('sales.status', 'completed');

  if (branchId) q = q.eq('sales.branch_id', branchId);
  if (fromDate) q = q.gte('sales.created_at', fromDate);
  if (toDate)   q = q.lte('sales.created_at', toDate + 'T23:59:59');

  const rows = check(await q);

  const totals = {};

  for (const row of rows) {
    const key = row.product_id;

    if (!totals[key]) {
      totals[key] = {
        product_id: row.product_id,
        product_name: row.product_name,
        unit_cost: Number(row.price),
        quantity_sold: 0,
        funds_received: 0,
        sale_ids: new Set(),
      };
    }

    totals[key].quantity_sold += row.quantity;
    totals[key].funds_received += Number(row.line_total);
    totals[key].sale_ids.add(row.sales.id);
  }

  const list = Object.values(totals).map((t) => ({
    product_id: t.product_id,
    product_name: t.product_name,
    unit_cost: t.unit_cost,
    quantity_sold: t.quantity_sold,
    funds_received: t.funds_received,
    sales_count: t.sale_ids.size,
  }));

  // Best-earning product first.
  list.sort((a, b) => b.funds_received - a.funds_received);

  return list;
}

// ------------------------------------------------------------
// Reports
// ------------------------------------------------------------

export async function getSalesSince(branchId, fromDate) {
  let query = supabase
    .from('sales')
    .select('*')
    .eq('status', 'completed')
    .gte('created_at', fromDate);

  if (branchId) query = query.eq('branch_id', branchId);

  return check(await query);
}

export async function getBestSellers(branchId, fromDate) {
  let query = supabase
    .from('sale_items')
    .select('product_name, quantity, line_total, sales!inner(created_at, status, branch_id)')
    .eq('sales.status', 'completed')
    .gte('sales.created_at', fromDate);

  if (branchId) query = query.eq('sales.branch_id', branchId);

  const rows = check(await query);

  const totals = {};
  for (const row of rows) {
    if (!totals[row.product_name]) {
      totals[row.product_name] = { name: row.product_name, sold: 0, money: 0 };
    }
    totals[row.product_name].sold += row.quantity;
    totals[row.product_name].money += Number(row.line_total);
  }

  const list = Object.values(totals);
  list.sort((a, b) => b.sold - a.sold);
  return list;
}

export async function getSalesByCategory(branchId, fromDate) {
  let query = supabase
    .from('sale_items')
    .select('quantity, line_total, products(categories(name)), sales!inner(created_at, status, branch_id)')
    .eq('sales.status', 'completed')
    .gte('sales.created_at', fromDate);

  if (branchId) query = query.eq('sales.branch_id', branchId);

  const rows = check(await query);

  const totals = {};
  for (const row of rows) {
    const category = row.products && row.products.categories
      ? row.products.categories.name
      : 'No category';

    if (!totals[category]) {
      totals[category] = { name: category, sold: 0, money: 0 };
    }

    totals[category].sold += row.quantity;
    totals[category].money += Number(row.line_total);
  }

  const list = Object.values(totals);
  list.sort((a, b) => b.money - a.money);
  return list;
}

export async function getBusiestHours(branchId, fromDate) {
  let query = supabase
    .from('sales')
    .select('total, created_at')
    .eq('status', 'completed')
    .gte('created_at', fromDate);

  if (branchId) query = query.eq('branch_id', branchId);

  const sales = check(await query);

  const hours = [];
  for (let hour = 0; hour < 24; hour++) {
    hours.push({ hour, sales: 0, money: 0 });
  }

  for (const sale of sales) {
    const hour = new Date(sale.created_at).getHours();
    hours[hour].sales += 1;
    hours[hour].money += Number(sale.total);
  }

  return hours;
}

export async function getPaymentSplit(branchId, fromDate) {
  let query = supabase
    .from('sales')
    .select('total, payment_method')
    .eq('status', 'completed')
    .gte('created_at', fromDate);

  if (branchId) query = query.eq('branch_id', branchId);

  const sales = check(await query);

  const totals = {};
  for (const sale of sales) {
    const how = sale.payment_method || 'cash';
    if (!totals[how]) totals[how] = { name: how, sold: 0, money: 0 };
    totals[how].sold += 1;
    totals[how].money += Number(sale.total);
  }

  return Object.values(totals);
}

export async function getLowStock(branchId) {
  const rows = check(
    await supabase.rpc('products_for_branch', { the_branch_id: branchId })
  );

  return rows
    .filter((p) => p.is_active && p.stock_quantity <= p.low_stock_at)
    .sort((a, b) => a.stock_quantity - b.stock_quantity);
}

export async function getExpiringSoon(branchId) {
  const rows = check(
    await supabase.rpc('products_for_branch', { the_branch_id: branchId })
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const oneDay = 1000 * 60 * 60 * 24;

  return rows
    .filter((p) => p.is_active && p.stock_quantity > 0 && p.expiry_date)
    .filter((p) => {
      const daysLeft = Math.round((new Date(p.expiry_date) - today) / oneDay);
      return daysLeft <= p.expiry_warn_days;
    })
    .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));
}

// ------------------------------------------------------------
// Staff
// ------------------------------------------------------------

export async function getStaff(branchId, includeInactive = false) {
  let query = supabase
    .from('profiles')
    .select('*, branches(id, name, code)')
    .order('full_name');

  if (branchId) query = query.eq('branch_id', branchId);
  if (!includeInactive) query = query.eq('is_active', true);

  return check(await query);
}

export async function changeStaffRole(id, role) {
  return check(
    await supabase.from('profiles').update({ role }).eq('id', id)
  );
}

export async function changeStaffBranch(id, branchId) {
  return check(
    await supabase.from('profiles').update({ branch_id: branchId }).eq('id', id)
  );
}

// ------------------------------------------------------------
// Staff — creating, removing, restoring, resetting
//
// All of it goes through the create-staff Edge Function, because
// every one of these needs the service role key, which only the
// server holds. The browser just sends a request.
// ------------------------------------------------------------

async function callStaffFunction(payload) {
  const { data, error } = await supabase.functions.invoke('create-staff', {
    body: payload,
  });

  if (error) {
    let message = error.message;
    try {
      const ctx = error.context;
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.json();
        if (body && body.error) message = body.error;
      }
    } catch (_) {
      // fall back
    }
    throw new Error(message);
  }

  if (data && data.error) throw new Error(data.error);
  return data;
}

export function createStaff({ username, password, fullName, role, branchId }) {
  return callStaffFunction({
    action: 'create',
    username,
    password,
    full_name: fullName,
    role,
    branch_id: branchId,
  });
}

export function removeStaff(userId) {
  return callStaffFunction({ action: 'remove', user_id: userId });
}

export function restoreStaff(userId) {
  return callStaffFunction({ action: 'restore', user_id: userId });
}

export function resetStaffPassword(userId, password) {
  return callStaffFunction({
    action: 'reset-password',
    user_id: userId,
    password,
  });
}
