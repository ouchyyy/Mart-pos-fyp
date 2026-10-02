// ============================================================
// Branches.jsx — owner only
//
// Same shape as the Laravel POS branches list: breadcrumb, title,
// a section card with a titled header and a count, and a clean
// table under it.
// ============================================================

import { useState, useEffect } from 'react';
import {
  getBranchSummary,
  addBranch,
  updateBranch,
  hideBranch,
} from '../database';
import { money } from '../money';

import { PageHeader, SectionCard } from '../components/Ui';
import {
  BranchesIcon,
  PlusIcon,
  MapPinIcon,
} from '../components/Icons';

export default function Branches() {
  const [branches, setBranches] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setBranches(await getBranchSummary());
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleHide(branch) {
    if (!window.confirm('Close ' + branch.name + '?')) return;
    try {
      await hideBranch(branch.id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const activeCount = branches.filter((b) => b.is_active).length;

  return (
    <div>
      <PageHeader
        breadcrumb="Master data / Branches"
        title="Branches"
        subtitle="Manage every shop location where your chain sells and stocks."
        actions={
          <button className="primary" onClick={() => setEditing({})}>
            <PlusIcon /> Add branch
          </button>
        }
      />

      {error && <div className="error">{error}</div>}

      <SectionCard
        icon={<BranchesIcon />}
        title="Branch locations"
        count={branches.length + ' total · ' + activeCount + ' open'}
      >
        <table>
          <thead>
            <tr>
              <th>Branch</th>
              <th>Code</th>
              <th className="right">Staff</th>
              <th className="right">Stock (units)</th>
              <th className="right">Sales</th>
              <th className="right">Takings</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.id} style={{ opacity: b.is_active ? 1 : 0.55 }}>
                <td>
                  <div className="name-with-photo">
                    <span
                      className="section-card-icon"
                      style={{ width: 30, height: 30 }}
                    >
                      <MapPinIcon />
                    </span>
                    <div>
                      <div style={{ fontWeight: 500 }}>{b.name}</div>
                      {!b.is_active && (
                        <div className="grey small-text">Closed</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="grey small-text number">{b.code || '—'}</td>
                <td className="right number">{b.staff_count}</td>
                <td className="right number">{b.stock_units}</td>
                <td className="right number">{b.sale_count}</td>
                <td className="right number">{money(b.takings)}</td>
                <td className="right" style={{ whiteSpace: 'nowrap' }}>
                  <button className="small" onClick={() => setEditing(b)}>
                    Edit
                  </button>{' '}
                  {b.is_active && (
                    <button
                      className="small danger"
                      onClick={() => handleHide(b)}
                    >
                      Close
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {branches.length === 0 && (
          <div className="empty">
            No branches yet. Press "Add branch" to create the first one.
          </div>
        )}
      </SectionCard>

      {editing && (
        <BranchForm
          branch={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function BranchForm({ branch, onClose, onSaved }) {
  const isNew = !branch.id;
  const [form, setForm] = useState({
    name: branch.name || '',
    code: branch.code || '',
    address: branch.address || '',
    phone: branch.phone || '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function update(field, value) {
    setForm({ ...form, [field]: value });
  }

  async function save() {
    setError('');
    setBusy(true);
    try {
      if (isNew) await addBranch(form);
      else await updateBranch(branch.id, form);
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="popup" onClick={(e) => e.stopPropagation()}>
        <h2>{isNew ? 'Add branch' : 'Edit branch'}</h2>
        {error && <div className="error">{error}</div>}

        <label>
          <span>Name</span>
          <input
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            autoFocus
          />
        </label>
        <label>
          <span>Code</span>
          <input
            value={form.code}
            onChange={(e) => update('code', e.target.value)}
            placeholder="PP01"
          />
        </label>
        <label>
          <span>Address</span>
          <input
            value={form.address}
            onChange={(e) => update('address', e.target.value)}
          />
        </label>
        <label>
          <span>Phone</span>
          <input
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
          />
        </label>

        <div className="popup-buttons">
          <button onClick={onClose}>Cancel</button>
          <button
            className="primary"
            onClick={save}
            disabled={busy || form.name.trim() === ''}
          >
            {busy ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}