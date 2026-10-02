// ============================================================
// CustomerScreen.jsx — the screen facing the customer
//
// Opened in its own window and dragged onto a second monitor. It
// shows what has been scanned, what it comes to, and the QR code
// when they are paying that way.
//
// No sign-in, no buttons. A customer should never be able to
// change anything, and a cashier should never have to touch it.
// ============================================================

import { useState, useEffect } from 'react';
import { listenForCart, lastKnownCart } from '../cartChannel';
import { money, riel } from '../money';
import QRCode from 'qrcode';
import { makeQrText, canMakeQr, savedQrImage } from '../khqr';

export default function CustomerScreen() {
  const [state, setState] = useState(lastKnownCart());
  const [qrPicture, setQrPicture] = useState('');

  useEffect(() => {
    // listenForCart returns the function that stops listening,
    // which React runs when this page closes.
    return listenForCart((incoming) => setState(incoming));
  }, []);

  // Build the QR whenever the till says to show one.
  useEffect(() => {
    if (!state || !state.showQr) {
      setQrPicture('');
      return;
    }

    if (savedQrImage) {
      setQrPicture(savedQrImage);
      return;
    }

    if (!canMakeQr()) {
      return;
    }

    QRCode.toDataURL(makeQrText(state.total, null), { width: 300, margin: 1 })
      .then((image) => setQrPicture(image))
      .catch(() => setQrPicture(''));
  }, [state]);

  const items = state && state.items ? state.items : [];

  // Nothing scanned yet.
  if (items.length === 0) {
    return (
      <div className="customer-screen">
        <div className="customer-welcome">
          <h1>Welcome</h1>
          <p>Your items will appear here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-screen">
      <div className="customer-items">
        {items.map((item, index) => (
          <div className="customer-line" key={index}>
            {/* A picture is worth more here than on the till. The
                customer is checking we scanned the right thing,
                and they recognise the packet long before they
                finish reading the name. */}
            {item.image ? (
              <img src={item.image} alt="" className="customer-photo" />
            ) : (
              <div className="customer-photo missing">?</div>
            )}

            <div className="customer-text">
              <div className="customer-name">{item.name}</div>
              <div className="customer-each number">
                {item.quantity} × {money(item.price)}
                {item.discount > 0 && (
                  <span className="customer-saved">
                    &nbsp;· saved {money(item.discount)}
                  </span>
                )}
              </div>
            </div>

            <div className="customer-line-total number">{money(item.lineTotal)}</div>
          </div>
        ))}
      </div>

      <div className="customer-summary">
        {(state.itemDiscounts > 0 || state.discount > 0) && (
          <>
            <div className="customer-sub">
              <span>Subtotal</span>
              <span className="number">{money(state.subtotal)}</span>
            </div>
            <div className="customer-sub saved">
              <span>You saved</span>
              <span className="number">
                -{money(state.itemDiscounts + state.discount)}
              </span>
            </div>
          </>
        )}

        <div className="customer-total">
          <span>Total</span>
          <div className="customer-amounts">
            <span className="number">{money(state.total)}</span>
            <span className="number">{riel(state.total)}</span>
          </div>
        </div>
      </div>

      {/* Only while the cashier has the QR screen open. */}
      {state.showQr && (
        <div className="customer-qr">
          {qrPicture ? (
            <>
              <img src={qrPicture} alt="Payment QR code" />
              <p>Scan to pay {money(state.total)}</p>
            </>
          ) : (
            <p>Preparing the code…</p>
          )}
        </div>
      )}
    </div>
  );
}
