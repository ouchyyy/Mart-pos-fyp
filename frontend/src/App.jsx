// ============================================================
// App.jsx
//
// The menu has three kinds of item now:
//
//   MenuButton   a plain page link
//   MenuGroup    a parent with a chevron, expanding to children
//   MenuChild    an item inside a group, indented
//
// Groups remember whether they are open, and auto-open when the
// page you are on is one of their children — so reloading the
// app on "Stock out" leaves the Movements group expanded.
// ============================================================

import { useState, useEffect } from 'react';
import { getMyProfile, signOut, getBranches } from './database';

import {
  DashboardIcon,
  SellIcon,
  SalesIcon,
  StockIcon,
  MovementsIcon,
  ProductsIcon,
  ReportsIcon,
  StaffIcon,
  BranchesIcon,
  SignOutIcon,
  ChevronDownIcon,
  SettingsIcon,
  ArrowDownIcon,
  ArrowUpIcon,
} from './components/Icons';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sell from './pages/Sell';
import Products from './pages/Products';
import Stock from './pages/Stock';
import Movements from './pages/Movements';
import Sales from './pages/Sales';
import Reports from './pages/Reports';
import Staff from './pages/Staff';
import Branches from './pages/Branches';
import CustomerScreen from './pages/CustomerScreen';

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('sell');
  const [loading, setLoading] = useState(true);

  const [branchId, setBranchId] = useState(null);
  const [branches, setBranches] = useState([]);

  // Which groups are open. Keyed by the group's name so adding
  // another one later is a one-line change.
  const [openGroups, setOpenGroups] = useState({
    movements: false,
    setting: false,
  });

  useEffect(() => {
    getMyProfile()
      .then(async (profile) => {
        setUser(profile);
        if (!profile) return;

        if (profile.role === 'owner') {
          setPage('dashboard');
        } else if (profile.role === 'admin') {
          setPage('reports');
        }

        if (profile.role === 'owner') {
          const list = await getBranches();
          setBranches(list);
          if (list.length > 0) setBranchId(list[0].id);
        } else {
          setBranchId(profile.branch_id);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // Auto-open whichever group the current page belongs to. This
  // is what makes a hard refresh land on the right page with its
  // parent already expanded.
  useEffect(() => {
    if (page === 'movements-in' || page === 'movements-out') {
      setOpenGroups((g) => (g.movements ? g : { ...g, movements: true }));
    }
    if (page === 'staff' || page === 'branches') {
      setOpenGroups((g) => (g.setting ? g : { ...g, setting: true }));
    }
  }, [page]);

  function toggleGroup(name) {
    setOpenGroups((g) => ({ ...g, [name]: !g[name] }));
  }

  async function handleSignOut() {
    await signOut();
    setUser(null);
    setPage('sell');
    setBranchId(null);
  }

  if (window.location.search.includes('customer')) {
    return <CustomerScreen />;
  }

  if (loading) {
    return <div className="empty">Loading...</div>;
  }

  if (!user) {
    return (
      <Login
        onSignedIn={async (profile) => {
          setUser(profile);

          if (profile.role === 'owner') {
            const list = await getBranches();
            setBranches(list);
            setBranchId(list[0] ? list[0].id : null);
            setPage('dashboard');
          } else {
            setBranchId(profile.branch_id);
            setPage(profile.role === 'admin' ? 'reports' : 'sell');
          }
        }}
      />
    );
  }

  const isOwner = user.role === 'owner';
  const isAdmin = user.role === 'admin' || isOwner;

  // Reports and Sales have their own branch selector.
  const showBranchPicker =
    isOwner &&
    page !== 'dashboard' &&
    page !== 'reports' &&
    page !== 'sales';

  return (
    <div className="app">
      <div className="menu">
        <h2>Mart POS</h2>

        {showBranchPicker ? (
          <div className="branch-picker">
            <label>
              <span>Branch</span>
              <select
                value={branchId || ''}
                onChange={(e) => setBranchId(Number(e.target.value))}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : !isOwner && user.branches ? (
          <div className="branch-name">{user.branches.name}</div>
        ) : null}

        {/* ---------- Main ---------- */}
        <div className="menu-section">
          <div className="menu-section-label">Main</div>

          {isOwner && (
            <MenuButton
              name="dashboard"
              label="Dashboard"
              Icon={DashboardIcon}
              page={page}
              setPage={setPage}
            />
          )}

          {!isAdmin && (
            <MenuButton
              name="sell"
              label="Sell"
              Icon={SellIcon}
              page={page}
              setPage={setPage}
            />
          )}

          <MenuButton
            name="sales"
            label="Sales"
            Icon={SalesIcon}
            page={page}
            setPage={setPage}
          />
        </div>

        {/* ---------- Manage ---------- */}
        {isAdmin && (
          <div className="menu-section">
            <div className="menu-section-label">Manage</div>

            <MenuButton
              name="stock"
              label="Stock"
              Icon={StockIcon}
              page={page}
              setPage={setPage}
            />

            <MenuGroup
              name="movements"
              label="Movements"
              Icon={MovementsIcon}
              open={openGroups.movements}
              onToggle={() => toggleGroup('movements')}
              page={page}
            >
              <MenuChild
                name="movements-in"
                label="Stock in"
                Icon={ArrowDownIcon}
                page={page}
                setPage={setPage}
              />
              <MenuChild
                name="movements-out"
                label="Stock out"
                Icon={ArrowUpIcon}
                page={page}
                setPage={setPage}
              />
            </MenuGroup>

            <MenuButton
              name="products"
              label="Products"
              Icon={ProductsIcon}
              page={page}
              setPage={setPage}
            />
            <MenuButton
              name="reports"
              label="Reports"
              Icon={ReportsIcon}
              page={page}
              setPage={setPage}
            />
          </div>
        )}

        {/* ---------- Setting ---------- */}
        {isAdmin && (
          <div className="menu-section">
            <div className="menu-section-label">Setting</div>

            <MenuGroup
              name="setting"
              label="Setting"
              Icon={SettingsIcon}
              open={openGroups.setting}
              onToggle={() => toggleGroup('setting')}
              page={page}
            >
              <MenuChild
                name="staff"
                label="Staff"
                Icon={StaffIcon}
                page={page}
                setPage={setPage}
              />
              {isOwner && (
                <MenuChild
                  name="branches"
                  label="Branches"
                  Icon={BranchesIcon}
                  page={page}
                  setPage={setPage}
                />
              )}
            </MenuGroup>
          </div>
        )}

        <div className="bottom">
          <div className="user-name">{user.full_name || 'Staff'}</div>
          <div className="user-role">{user.role}</div>

          <button className="signout" onClick={handleSignOut}>
            <SignOutIcon />
            <span>Sign out</span>
          </button>
        </div>
      </div>

      <div
        className={page === 'sell' && !isAdmin ? '' : 'page'}
        style={{ flex: 1 }}
      >
        {isOwner && page === 'dashboard' && (
          <Dashboard branches={branches} onGo={setPage} user={user} />
        )}

        {page === 'sell' && !isAdmin && <Sell branchId={branchId} />}

        {page === 'sales' && (
          <Sales
            user={user}
            branchId={isOwner ? null : branchId}
            branches={isOwner ? branches : null}
          />
        )}

        {isAdmin && page === 'stock' && <Stock branchId={branchId} />}

        {isAdmin && page === 'movements-in' && (
          <Movements branchId={branchId} mode="in" />
        )}
        {isAdmin && page === 'movements-out' && (
          <Movements branchId={branchId} mode="out" />
        )}

        {isAdmin && page === 'products' && <Products branchId={branchId} />}

        {isAdmin && page === 'reports' && (
          <Reports
            branchId={branchId}
            user={user}
            branches={isOwner ? branches : null}
          />
        )}

        {isAdmin && page === 'staff' && (
          <Staff user={user} branchId={branchId} />
        )}
        {isOwner && page === 'branches' && <Branches />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   The three menu item kinds
   ------------------------------------------------------------ */

function MenuButton({ name, label, Icon, page, setPage }) {
  return (
    <button
      className={page === name ? 'active' : ''}
      onClick={() => setPage(name)}
    >
      {Icon && <Icon />}
      <span>{label}</span>
    </button>
  );
}

function MenuGroup({ label, Icon, open, onToggle, children, page }) {
  return (
    <div className="menu-group">
      <button
        className={'menu-group-header' + (open ? ' open' : '')}
        onClick={onToggle}
      >
        {Icon && <Icon />}
        <span>{label}</span>
        <span className="chevron">
          <ChevronDownIcon />
        </span>
      </button>

      {open && <div className="menu-group-children">{children}</div>}
    </div>
  );
}

function MenuChild({ name, label, Icon, page, setPage }) {
  return (
    <button
      className={'menu-child' + (page === name ? ' active' : '')}
      onClick={() => setPage(name)}
    >
      {Icon && <Icon />}
      <span>{label}</span>
    </button>
  );
}