// ============================================================
// cartChannel.js — sending the cart to the customer's screen
//
// The till and the customer display are two separate browser
// windows, so they need a way to pass messages. Nothing goes
// through the database: the display only ever shows what the till
// tells it, so there is no delay and nothing to keep in step.
//
// Two ways of sending, on purpose:
//
//   BroadcastChannel  the proper tool for this, but some browsers
//                     and privacy settings block it
//   localStorage      writing to it fires an event in every other
//                     window on the same site, which does the
//                     same job and is much harder to block
//
// The till sends both. The display listens for both and ignores
// whichever arrives second.
// ============================================================

const CHANNEL_NAME = 'mart-pos-cart';
const STORAGE_KEY = 'mart-pos-last-cart';

let channel = null;

function getChannel() {
  if (channel) {
    return channel;
  }

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(CHANNEL_NAME);
    }
  } catch (err) {
    channel = null;
  }

  return channel;
}

// Called by the till whenever the cart changes.
export function sendToCustomerScreen(state) {
  const message = JSON.stringify({ at: Date.now(), state: state });

  // Saving it also means a display opened halfway through a sale
  // shows the cart instead of an empty box.
  try {
    window.localStorage.setItem(STORAGE_KEY, message);
  } catch (err) {
    // Private browsing can refuse this. Not worth stopping for.
  }

  const c = getChannel();

  if (c) {
    try {
      c.postMessage(state);
    } catch (err) {
      // The localStorage write above still gets there.
    }
  }
}

// Called by the customer screen. Returns the function that stops
// listening, which React runs when the page closes.
export function listenForCart(onChange) {
  const c = getChannel();

  if (c) {
    c.onmessage = (event) => onChange(event.data);
  }

  // Fires in this window when another window writes to
  // localStorage. The event does not fire in the window that did
  // the writing, which is exactly what we want.
  function onStorage(event) {
    if (event.key !== STORAGE_KEY || !event.newValue) {
      return;
    }

    try {
      onChange(JSON.parse(event.newValue).state);
    } catch (err) {
      // A half-written value. The next message will be along.
    }
  }

  window.addEventListener('storage', onStorage);

  return () => {
    if (c) {
      c.onmessage = null;
    }
    window.removeEventListener('storage', onStorage);
  };
}

// Whatever was last sent, for a screen that has just opened.
export function lastKnownCart() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).state : null;
  } catch (err) {
    return null;
  }
}
