// ============================================================
// QrPayment.jsx — shows the QR code for the customer to scan
//
// There are two ways this works:
//
//   1. If you put a photo of your bank's QR in .env, we show
//      that photo and the customer types the amount themselves.
//      This is the easy way and always works.
//
//   2. If you filled in your bank account details, we build a
//      live QR that already has the amount in it, so the
//      customer just scans and confirms.
// ============================================================

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { makeQrText, canMakeQr, savedQrImage } from '../khqr';
import { money, riel } from '../money';

export default function QrPayment({ amount, onPaid, onCancel }) {
  const [picture, setPicture] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // If there is a saved photo, we do not need to build anything.
    if (savedQrImage) {
      setPicture(savedQrImage);
      return;
    }

    if (!canMakeQr()) {
      setError(
        'QR payment is not set up yet. Add VITE_QR_IMAGE or your bank ' +
          'details to the .env file.'
      );
      return;
    }

    // Turn the payload text into a picture of a QR code.
    const text = makeQrText(amount, null);

    QRCode.toDataURL(text, { width: 260, margin: 1 })
      .then((imageData) => setPicture(imageData))
      .catch((err) => setError(err.message));
  }, [amount]);

  return (
    <div className="overlay">
      <div className="popup" style={{ maxWidth: 340, textAlign: 'center' }}>
        <h2>Scan to pay</h2>

        <div className="qr-amount number">{money(amount)}</div>
        <div className="qr-amount number">{riel(amount)}</div>

        {error && <div className="error">{error}</div>}

        {picture && <img src={picture} alt="Payment QR code" className="qr-image" />}

        {savedQrImage && (
          <p className="grey small-text">
            Ask the customer to type {money(amount)} into their banking app.
          </p>
        )}

        <p className="grey small-text">
          Wait until the payment shows in your own banking app before
          pressing the button below.
        </p>

        <div className="popup-buttons">
          <button onClick={onCancel}>Cancel</button>
          <button className="primary" onClick={onPaid}>
            Payment received
          </button>
        </div>
      </div>
    </div>
  );
}
