import { NavLink, Outlet, useLocation } from "react-router-dom";

import { navigationByPath, navigationSections } from "../data/navigation";
import { useAuth } from "../app/providers/AuthProvider";
import { ROLE_LABELS } from "../constants/statuses";

export function AppLayout() {
  const location = useLocation();
  const { profile, role, user, signOutUser, isDemoMode } = useAuth();
  const currentRoute = navigationByPath[location.pathname] || navigationByPath["/"];
  const displayName = profile?.full_name || user?.displayName || user?.email || "Kullanici";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <img className="brand-logo" src="/logo.png" alt="Artegon" />
          <p className="brand-block__eyebrow">Artegon ERP</p>
          <h1>Uretim ve Operasyon Platformu</h1>
          <p>Savunma sanayisine yonelik Firebase tabanli moduler ERP omurgasi.</p>
        </div>
        <nav className="sidebar-nav">
          {navigationSections.map((section) => (
            <div className="sidebar-section" key={section.id}>
              <p className="sidebar-section__title">{section.label}</p>
              <div className="sidebar-section__items">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      isActive ? "sidebar-nav__link sidebar-nav__link--active" : "sidebar-nav__link"
                    }
                  >
                    <span className="sidebar-nav__dot" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="sidebar-user__identity">
            <div className="sidebar-user__avatar">{initial}</div>
            <div>
              <strong>{displayName}</strong>
              <p>{ROLE_LABELS[role] || role}</p>
            </div>
          </div>
          <button className="button button--ghost sidebar-user__button" type="button" onClick={signOutUser}>
            Sistemden Cikis
          </button>
        </div>
      </aside>
      <div className="content-shell">
        <header className="topbar">
          <div className="topbar__title">
            <p className="topbar__eyebrow">Operasyon Gorunumu</p>
            <strong>{currentRoute?.title || "Artegon ERP"}</strong>
            <p>{currentRoute?.description || "Savunma sanayi operasyon akislari"}</p>
          </div>
          <div className="topbar__actions">
            {isDemoMode ? <span className="demo-chip">Demo mod</span> : null}
            <div className="topbar__user">
              <div className="topbar__user-avatar">{initial}</div>
              <div>
                <strong>{displayName}</strong>
                <p>{ROLE_LABELS[role] || role}</p>
              </div>
            </div>
          </div>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
