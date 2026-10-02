// ============================================================
// money.js — showing prices, riel, and dates the same way
//            everywhere in the app
// ============================================================

// How many riel to one dollar. Shops round this to a friendly
// number and change it now and then, so it lives in .env rather
// than being buried in the code.
const RIEL_PER_DOLLAR = Number(import.meta.env.VITE_RIEL_RATE) || 4100;

// Prices are kept in dollars in the database.
export function money(amount) {
  const value = Number(amount) || 0;
  return '$' + value.toFixed(2);
}

// The same amount in riel.
//
// Shops almost never hand back coins, so we round up to the
// nearest 100 riel. Rounding UP means the rounding is always in
// the customer's favour, which is the polite way round and how
// shops here actually do it.
export function riel(amountInDollars) {
  const exact = (Number(amountInDollars) || 0) * RIEL_PER_DOLLAR;
  const rounded = Math.ceil(exact / 100) * 100;

  // A space every three digits, so 41000 reads as 41 000.
  return '៛' + rounded.toLocaleString('en-US');
}

export function rielRate() {
  return RIEL_PER_DOLLAR;
}

export function shortDate(dateText) {
  if (!dateText) {
    return '';
  }
  return new Date(dateText).toLocaleDateString();
}

export function dateAndTime(dateText) {
  if (!dateText) {
    return '';
  }
  return new Date(dateText).toLocaleString();
}

// How many days from today until this date.
// A negative answer means the date has already passed.
export function daysUntil(dateText) {
  if (!dateText) {
    return null;
  }
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.round((new Date(dateText) - new Date()) / oneDay);
}
