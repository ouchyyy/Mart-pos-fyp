// ============================================================
// khqr.js — builds the QR code the customer scans
//
// This is the standard behind KHQR/Bakong, and also PromptPay and
// QRIS. The payload is a plain string made of blocks. Each block
// is a 2-digit tag, then a 2-digit length, then the value.
//
// You do not need to change anything in this file. The details
// that vary between shops go in the .env file.
//
// IMPORTANT: the account details come from your bank. Make one
// code and scan it with a real banking app before trusting it in
// a demo. If your bank does not give you those details, put a
// photo of your own bank QR in VITE_QR_IMAGE instead.
// ============================================================

// The checksum the standard requires, so a scanner can tell a
// damaged code from a good one.
function crc16(text) {
  let crc = 0xffff;

  for (let i = 0; i < text.length; i++) {
    crc = crc ^ (text.charCodeAt(i) << 8);

    for (let bit = 0; bit < 8; bit++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// One block: tag + how long the value is + the value.
// For example block('59', 'MY SHOP') gives "5907MY SHOP".
function block(tag, value) {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  const text = String(value);
  const length = String(text.length).padStart(2, '0');

  return tag + length + text;
}

const currencyNumbers = {
  USD: '840',
  KHR: '116',
  THB: '764',
  VND: '704',
};

// All the shop's details, read from the .env file.
const shop = {
  bank: import.meta.env.VITE_QR_BANK || 'kh.gov.nbc.bakong',
  account: import.meta.env.VITE_QR_ACCOUNT || '',
  merchantTag: import.meta.env.VITE_QR_TAG || '29',
  name: import.meta.env.VITE_QR_NAME || 'MART',
  city: import.meta.env.VITE_QR_CITY || 'PHNOM PENH',
  currency: import.meta.env.VITE_CURRENCY || 'USD',
};

export const savedQrImage = import.meta.env.VITE_QR_IMAGE || '';

// Is the shop set up to make live QR codes?
export function canMakeQr() {
  return shop.account !== '';
}

// Build the text that goes inside the QR picture.
export function makeQrText(amount, invoiceNumber) {
  // Tag 29 holds the bank name and the account number together.
  const accountBlock = block('00', shop.bank) + block('01', shop.account);

  let payload =
    block('00', '01') +                                  // version
    block('01', '12') +                                  // 12 means use once
    block(shop.merchantTag, accountBlock) +
    block('52', '5499') +                                // 5499 = small shop
    block('53', currencyNumbers[shop.currency] || '840') +
    block('54', Number(amount).toFixed(2)) +
    block('58', 'KH') +                                  // country
    block('59', shop.name.slice(0, 25)) +
    block('60', shop.city.slice(0, 15));

  if (invoiceNumber) {
    payload = payload + block('62', block('01', invoiceNumber));
  }

  // The checksum goes last, and covers everything before it.
  // "6304" is the start of the checksum block itself, which the
  // standard says to include when working the number out.
  payload = payload + '6304';

  return payload + crc16(payload);
}
