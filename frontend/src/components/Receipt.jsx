// The receipt that pops up after a sale is saved.

import { money, riel, dateAndTime } from '../money';

export default function Receipt({ sale, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      {/* stopPropagation stops a click inside the box from closing it */}
      <div
        className="popup"
        style={{ maxWidth: 340 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Sale complete</h2>
        <p className="grey small-text" style={{ marginTop: 0 }}>
          {sale.invoice_no} &middot; {dateAndTime(sale.created_at)}
          {sale.profiles && sale.profiles.full_name && (
            <>
              <br />
              Served by {sale.profiles.full_name}
            </>
          )}
        </p>

        <hr />

        {sale.sale_items.map((item) => (
          <div key={item.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>
                {item.quantity} &times; {item.product_name}
              </span>
              <span className="number">{money(item.line_total)}</span>
            </div>

            {/* Only printed when this line had money taken off it. */}
            {Number(item.discount) > 0 && (
              <div
                className="discount-line small-text"
                style={{ display: 'flex', justifyContent: 'space-between' }}
              >
                <span>&nbsp;&nbsp;discount</span>
                <span className="number">-{money(item.discount)}</span>
              </div>
            )}
          </div>
        ))}

        <hr />

        {/* Only shown when something was actually taken off, so a
            normal receipt stays short. */}
        {(Number(sale.discount) > 0 || Number(sale.item_discount) > 0) && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal</span>
              <span className="number">{money(sale.subtotal)}</span>
            </div>

            {Number(sale.item_discount) > 0 && (
              <div
                style={{ display: 'flex', justifyContent: 'space-between' }}
                className="discount-line"
              >
                <span>Item discounts</span>
                <span className="number">-{money(sale.item_discount)}</span>
              </div>
            )}

            {Number(sale.discount) > 0 && (
              <div
                style={{ display: 'flex', justifyContent: 'space-between' }}
                className="discount-line"
              >
                <span>Sale discount</span>
                <span className="number">-{money(sale.discount)}</span>
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <strong>Total</strong>
          <strong className="number">{money(sale.total)}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <strong>In riel</strong>
          <strong className="number">{riel(sale.total)}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Cash</span>
          <span className="number">{money(sale.paid)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Change</span>
          <span className="number">{money(sale.change_given)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Change in riel</span>
          <span className="number">{riel(sale.change_given)}</span>
        </div>

        <div className="popup-buttons">
          <button onClick={() => window.print()}>Print</button>
          <button className="primary" onClick={onClose}>
            Next customer
          </button>
        </div>
      </div>
    </div>
  );
}
