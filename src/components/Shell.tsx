import { useEffect, useState, type ReactNode } from 'react';
import type { IconType } from 'react-icons';
import { FiLogOut, FiMenu,FiMoon, FiSearch, FiSun } from 'react-icons/fi';
import { initials } from '../lib/format';
import { useTheme } from '../lib/theme';

export type NavItem = { key: string; label: string; icon: IconType; count?: number };

export function Shell({
  portal, nav, active, onNavigate, title, sub, user, onSignOut, search, onSearch, actions, children,
}: {
  portal: string;
  nav: NavItem[];
  active: string;
  onNavigate: (key: string) => void;
  title: string;
  sub?: string;
  user: { name: string; role: string };
  onSignOut: () => void;
  search?: string;
  onSearch?: (q: string) => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);
  return (
    <div className="shell">
      {menuOpen ? <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" /> : null}
      <aside className={`sidebar${menuOpen ? ' open' : ''}`} id="sidebar">
        <a className="brand" href="#/" aria-label="Supercarstars home">
          <img src="/wordmark.png" alt="Supercarstars.com" />
        </a>
        <span className="portal-tag">{portal}</span>
        <nav className="nav" aria-label={portal}>
          {nav.map(({ key, label, icon: Icon, count }) => (
            <button key={key} className={key === active ? 'active' : ''} onClick={() => { setMenuOpen(false); onNavigate(key); }} aria-current={key === active ? 'page' : undefined}>
              <Icon size={18} />
              {label}
              {count ? <span className="count">{count}</span> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="avatar">{initials(user.name)}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="strong" style={{ fontSize: 14 }}>{user.name}</div>
            <div className="muted small">{user.role}</div>
          </div>
          <button className="icon-btn" style={{ width: 38, height: 38 }} onClick={onSignOut} aria-label="Sign out">
            <FiLogOut size={16} />
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-expanded={menuOpen} aria-controls="sidebar">
            <FiMenu size={20} />
          </button>
          <div>
            <h1>{title}</h1>
            {sub ? <div className="sub">{sub}</div> : null}
          </div>
          <div className="spacer" />
          {onSearch ? (
            <label className="search">
              <FiSearch size={17} />
              <input value={search ?? ''} onChange={(e) => onSearch(e.target.value)} placeholder="Search" aria-label="Search" />
            </label>
          ) : null}
          {actions}
          <button className="icon-btn" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
            {theme === 'dark' ? <FiSun size={18} /> : <FiMoon size={18} />}
          </button>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
