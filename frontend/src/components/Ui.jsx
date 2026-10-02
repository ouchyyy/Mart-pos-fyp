// ============================================================
// Ui.jsx — the three pieces every redesigned page shares.
//
//   PageHeader    breadcrumb + title + subtitle + actions
//   SectionCard   a box with a titled, icon'd header
//   StatCard      a KPI card with an icon in a coloured square
//
// Kept deliberately plain: no state, no data, no side effects.
// ============================================================

export function PageHeader({ breadcrumb, title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div className="page-header-main">
        {breadcrumb && <div className="breadcrumb">{breadcrumb}</div>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}

export function SectionCard({
  icon,
  title,
  count,
  actions,
  padding,
  children,
}) {
  return (
    <div className="section-card">
      <div className="section-card-head">
        <div className="section-card-title-wrap">
          {icon && <span className="section-card-icon">{icon}</span>}
          <div>
            <div className="section-card-title">{title}</div>
            {count !== undefined && count !== null && (
              <div className="section-card-count">{count}</div>
            )}
          </div>
        </div>
        {actions && <div className="section-card-actions">{actions}</div>}
      </div>

      <div
        className={
          'section-card-body' + (padding === 0 ? ' no-pad' : '')
        }
      >
        {children}
      </div>
    </div>
  );
}

export function StatCard({ icon, tone, label, value, note, noteTone }) {
  return (
    <div className="stat-card">
      <div className="stat-card-head">
        <div className={'stat-icon tone-' + (tone || 'blue')}>{icon}</div>
        <div className="stat-label">{label}</div>
      </div>
      <div className="stat-value number">{value}</div>
      {note && (
        <div className={'stat-note tone-' + (noteTone || 'grey')}>
          {note}
        </div>
      )}
    </div>
  );
}
