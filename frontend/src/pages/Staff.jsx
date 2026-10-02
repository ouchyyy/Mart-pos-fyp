// ============================================================
// Staff.jsx — see who works here, manage every account
//
// Four things the page does, all from the app:
//
//   Add staff       button opens the Add popup
//   Change role     inline dropdown, one click
//   Change branch   inline dropdown (owner only)
//   Reset password  key icon on the row
//   Remove / restore  bin / undo icons on the row
//
// "Remove" is a soft delete — the login is banned so they cannot
// sign in, and the row is flagged inactive. Their sales and
// movements are preserved, so the history stays honest.
// ============================================================

import { useState, useEffect } from 'react';
import {
  getStaff,
  changeStaffRole,
  changeStaffBranch,
  getBranches,
  createStaff,
  removeStaff,
  restoreStaff,
  resetStaffPassword,
} from '../database';
import { shortDate } from '../money';

import { PageHeader, SectionCard } from '../components/Ui';
import {
  StaffIcon,
  ShieldIcon,
  CashierIcon,
  UsersIcon,
  SearchIcon2,
  PlusIcon,
  KeyIcon,
  TrashIcon,
  RotateIcon,
} from '../components/Icons';

export default function Staff({ user, branchId }) {
  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [resetting, setResetting] = useState(null);
  const [removing, setRemoving] = useState(null);

  const isOwner = user.role === 'owner';

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, showInactive]);

  async function load() {
    setLoading(true);
    try {
      setStaff(await getStaff(isOwner ? null : branchId, showInactive));
      if (isOwner) setBranches(await getBranches());
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  async function handleRoleChange(person, newRole) {
    try {
      await changeStaffRole(person.id, newRole);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleBranchChange(person, newBranchId) {
    try {
      await changeStaffBranch(person.id, Number(newBranchId));
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRestore(person) {
    try {
      await restoreStaff(person.id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const shown = staff.filter((person) => {
    if (roleFilter && person.role !== roleFilter) return false;
    if (search === '') return true;
    const text = search.toLowerCase();
    const name = (person.full_name || '').toLowerCase();
    const branch = person.branches ? person.branches.name.toLowerCase() : '';
    return name.includes(text) || branch.includes(text);
  });

  const counts = {
    all: staff.length,
    owner: staff.filter((p) => p.role === 'owner').length,
    admin: staff.filter((p) => p.role === 'admin').length,
    cashier: staff.filter((p) => p.role === 'cashier').length,
  };

  function initials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function roleTone(role) {
    if (role === 'owner') return 'owner';
    if (role === 'admin') return 'admin';
    return 'cashier';
  }

  return (
    <div>
      <PageHeader
        breadcrumb="Setting / Staff"
        title="Staff"
        subtitle={
          isOwner
            ? 'Everyone who works at any of your branches, and what they may do.'
            : 'Everyone at this branch, and what they may do.'
        }
        actions={
          <button className="primary" onClick={() => setShowAdd(true)}>
            <PlusIcon /> Add staff
          </button>
        }
      />

      {error && <div className="error">{error}</div>}

      <SectionCard
        icon={<UsersIcon />}
        title="Team members"
        count={
          staff.length +
          (staff.length === 1 ? ' person' : ' people') +
          (isOwner ? ' across all branches' : ' at this branch')
        }
      >
        <div className="staff-filters">
          <div className="staff-search">
            <SearchIcon2 />
            <input
              type="text"
              placeholder="Search by name or branch"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="staff-role-chips">
            <button
              className={'chip' + (roleFilter === '' ? ' on' : '')}
              onClick={() => setRoleFilter('')}
            >
              All <span className="chip-count">{counts.all}</span>
            </button>
            {counts.owner > 0 && (
              <button
                className={'chip' + (roleFilter === 'owner' ? ' on' : '')}
                onClick={() => setRoleFilter('owner')}
              >
                Owners <span className="chip-count">{counts.owner}</span>
              </button>
            )}
            <button
              className={'chip' + (roleFilter === 'admin' ? ' on' : '')}
              onClick={() => setRoleFilter('admin')}
            >
              Admins <span className="chip-count">{counts.admin}</span>
            </button>
            <button
              className={'chip' + (roleFilter === 'cashier' ? ' on' : '')}
              onClick={() => setRoleFilter('cashier')}
            >
              Cashiers <span className="chip-count">{counts.cashier}</span>
            </button>
          </div>

          <button
            className={'chip' + (showInactive ? ' on' : '')}
            onClick={() => setShowInactive(!showInactive)}
            title="Include people who have been removed"
          >
            {showInactive ? 'Active only' : 'Show removed'}
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Name</th>
              {isOwner && <th>Branch</th>}
              <th>Role</th>
              <th className="right">Joined</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((person) => {
              const isMe = person.id === user.id;
              const isInactive = person.is_active === false;

              return (
                <tr
                  key={person.id}
                  style={{ opacity: isInactive ? 0.55 : 1 }}
                >
                  <td>
                    <div className="staff-cell">
                      <div
                        className={
                          'staff-avatar tone-' + roleTone(person.role)
                        }
                      >
                        {initials(person.full_name)}
                      </div>
                      <div>
                        <div className="staff-name">
                          {person.full_name || 'No name yet'}
                          {isMe && (
                            <span className="tag" style={{ marginLeft: 8 }}>
                              you
                            </span>
                          )}
                          {isInactive && (
                            <span
                              className="tag warning"
                              style={{ marginLeft: 8 }}
                            >
                              removed
                            </span>
                          )}
                        </div>
                        <div className="grey small-text">
                          {person.role === 'owner'
                            ? 'Whole franchise'
                            : person.branches
                            ? person.branches.name
                            : 'Unassigned'}
                        </div>
                      </div>
                    </div>
                  </td>

                  {isOwner && (
                    <td>
                      {person.role === 'owner' || isMe ? (
                        <span className="grey small-text">—</span>
                      ) : (
                        <select
                          className="staff-select"
                          value={person.branch_id || ''}
                          onChange={(e) =>
                            handleBranchChange(person, e.target.value)
                          }
                        >
                          <option value="">Unassigned</option>
                          {branches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  )}

                  <td>
                    {isMe || person.role === 'owner' ? (
                      <span
                        className={
                          'role-pill tone-' + roleTone(person.role)
                        }
                      >
                        {person.role === 'owner' ? (
                          <ShieldIcon />
                        ) : person.role === 'admin' ? (
                          <StaffIcon />
                        ) : (
                          <CashierIcon />
                        )}
                        {person.role}
                      </span>
                    ) : (
                      <select
                        className="staff-select"
                        value={person.role}
                        onChange={(e) =>
                          handleRoleChange(person, e.target.value)
                        }
                      >
                        <option value="cashier">cashier</option>
                        <option value="admin">admin</option>
                        {isOwner && <option value="owner">owner</option>}
                      </select>
                    )}
                  </td>

                  <td className="right small-text grey">
                    {shortDate(person.created_at)}
                  </td>

                  <td className="right" style={{ whiteSpace: 'nowrap' }}>
                    {isInactive ? (
                      <button
                        className="small"
                        onClick={() => handleRestore(person)}
                        title="Let this person sign in again"
                      >
                        <RotateIcon /> Restore
                      </button>
                    ) : (
                      <>
                        <button
                          className="small"
                          onClick={() => setResetting(person)}
                          title="Set a new password"
                        >
                          <KeyIcon />
                        </button>{' '}
                        {!isMe && person.role !== 'owner' && (
                          <button
                            className="small danger"
                            onClick={() => setRemoving(person)}
                            title="Remove this person"
                          >
                            <TrashIcon />
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!loading && shown.length === 0 && (
          <div className="empty small-text">
            {staff.length === 0
              ? 'No staff yet. Press "Add staff" to make the first account.'
              : 'No one matches the filter.'}
          </div>
        )}
      </SectionCard>

      {showAdd && (
        <AddStaffPopup
          user={user}
          branches={branches}
          defaultBranchId={branchId}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}

      {resetting && (
        <ResetPasswordPopup
          person={resetting}
          onClose={() => setResetting(null)}
          onSaved={() => setResetting(null)}
        />
      )}

      {removing && (
        <RemoveStaffPopup
          person={removing}
          onClose={() => setRemoving(null)}
          onSaved={() => {
            setRemoving(null);
            load();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------
   Add staff popup
   ------------------------------------------------------------ */
function AddStaffPopup({ user, branches, defaultBranchId, onClose, onSaved }) {
  const isOwner = user.role === 'owner';

  const [form, setForm] = useState({
    username: '',
    password: '',
    fullName: '',
    role: 'cashier',
    branchId: isOwner
      ? String(defaultBranchId || '')
      : String(user.branch_id || ''),
  });

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState('');

  function update(field, value) {
    setForm({ ...form, [field]: value });
  }

  function suggestPassword() {
    const words = ['sun', 'cat', 'leaf', 'salt', 'milk', 'rain', 'corn'];
    const a = words[Math.floor(Math.random() * words.length)];
    const b = words[Math.floor(Math.random() * words.length)];
    const n = Math.floor(1000 + Math.random() * 9000);
    const pw = a + '-' + b + '-' + n;
    setGenerated(pw);
    update('password', pw);
  }

  async function save() {
    setError('');
    setBusy(true);
    try {
      await createStaff({
        username: form.username.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        role: form.role,
        branchId: form.role === 'owner' ? null : Number(form.branchId),
      });
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const canSave =
    form.username.trim() !== '' &&
    form.password.length >= 6 &&
    (form.role === 'owner' || form.branchId !== '') &&
    !busy;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="popup" onClick={(e) => e.stopPropagation()}>
        <h2>Add staff</h2>
        {error && <div className="error">{error}</div>}

        <label>
          <span>Username</span>
          <input
            value={form.username}
            onChange={(e) => update('username', e.target.value)}
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>

        <label>
          <span>Full name</span>
          <input
            value={form.fullName}
            onChange={(e) => update('fullName', e.target.value)}
          />
        </label>

        <label>
          <span>Password</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
            />
            <button
              type="button"
              onClick={suggestPassword}
              style={{ whiteSpace: 'nowrap' }}
            >
              Suggest
            </button>
          </div>
          {generated && form.password === generated && (
            <span
              className="grey small-text"
              style={{ display: 'block', marginTop: 6 }}
            >
              Write this down and give it to them.
            </span>
          )}
        </label>

        <div className="two-columns">
          <label>
            <span>Role</span>
            <select
              value={form.role}
              onChange={(e) => update('role', e.target.value)}
            >
              <option value="cashier">cashier</option>
              <option value="admin">admin</option>
              {isOwner && <option value="owner">owner</option>}
            </select>
          </label>

          {form.role !== 'owner' && (
            <label>
              <span>Branch</span>
              <select
                value={form.branchId}
                onChange={(e) => update('branchId', e.target.value)}
                disabled={!isOwner}
              >
                <option value="">Choose a branch</option>
                {(isOwner
                  ? branches
                  : branches.filter((b) => b.id === user.branch_id)
                ).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="popup-buttons">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={save} disabled={!canSave}>
            {busy ? 'Creating...' : 'Create account'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   Reset password popup
   ------------------------------------------------------------ */
function ResetPasswordPopup({ person, onClose, onSaved }) {
  const [password, setPassword] = useState('');
  const [generated, setGenerated] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function suggest() {
    const words = ['sun', 'cat', 'leaf', 'salt', 'milk', 'rain', 'corn'];
    const a = words[Math.floor(Math.random() * words.length)];
    const b = words[Math.floor(Math.random() * words.length)];
    const n = Math.floor(1000 + Math.random() * 9000);
    const pw = a + '-' + b + '-' + n;
    setGenerated(pw);
    setPassword(pw);
  }

  async function save() {
    setError('');
    setBusy(true);
    try {
      await resetStaffPassword(person.id, password);
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="popup" onClick={(e) => e.stopPropagation()}>
        <h2>New password</h2>

        <p className="small-text grey" style={{ marginTop: 0 }}>
          Setting a new password for <strong>{person.full_name}</strong>.
          Their old password stops working right away.
        </p>

        {error && <div className="error">{error}</div>}

        <label>
          <span>New password</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoFocus
            />
            <button
              type="button"
              onClick={suggest}
              style={{ whiteSpace: 'nowrap' }}
            >
              Suggest
            </button>
          </div>
          {generated && password === generated && (
            <span
              className="grey small-text"
              style={{ display: 'block', marginTop: 6 }}
            >
              Write this down and give it to them.
            </span>
          )}
        </label>

        <div className="popup-buttons">
          <button onClick={onClose}>Cancel</button>
          <button
            className="primary"
            onClick={save}
            disabled={busy || password.length < 6}
          >
            {busy ? 'Saving...' : 'Set password'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   Remove staff popup
   ------------------------------------------------------------ */
function RemoveStaffPopup({ person, onClose, onSaved }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setError('');
    setBusy(true);
    try {
      await removeStaff(person.id);
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="popup" onClick={(e) => e.stopPropagation()}>
        <h2>Remove {person.full_name}?</h2>

        <p className="small-text grey" style={{ marginTop: 0 }}>
          This person will not be able to sign in again. Their past
          sales and stock movements stay in the records, so the
          history is not affected.
        </p>

        <p className="small-text grey">
          You can let them back in at any time with <strong>Restore</strong>.
        </p>

        {error && <div className="error">{error}</div>}

        <div className="popup-buttons">
          <button onClick={onClose}>Cancel</button>
          <button
            className="primary"
            onClick={confirm}
            disabled={busy}
            style={{ background: 'var(--red)', borderColor: 'var(--red)' }}
          >
            {busy ? 'Removing...' : 'Remove staff'}
          </button>
        </div>
      </div>
    </div>
  );
}
