import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import "../pages/ToolLayout.css";

export default function DashboardLayout({ title, subtitle, badge, children }) {
  const [toolsOpen, setToolsOpen] = useState(false);

  return (
    <div className="toolPage gardenShell">
      <aside className="gardenSidebar">
        <div className="sidebarBrand">
          <div className="sidebarBrandIcon">🌿</div>
          <div>
            <div className="sidebarBrandTitle">Garden Assistant</div>
            <div className="sidebarBrandSub">Plant care dashboard</div>
          </div>
        </div>

        <nav className="sidebarNav">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `sidebarLink ${isActive ? "active" : ""}`}
          >
            <span className="sidebarLinkIcon">🏠</span>
            <span>Home</span>
          </NavLink>

          <NavLink
            to="/garden"
            className={({ isActive }) => `sidebarLink ${isActive ? "active" : ""}`}
          >
            <span className="sidebarLinkIcon">🪴</span>
            <span>My Garden</span>
          </NavLink>

          <div className="sidebarDropdown sidebarDropdownClick">
            <button
              type="button"
              className="sidebarLink sidebarStaticLink sidebarToggleBtn"
              onClick={() => setToolsOpen((prev) => !prev)}
            >
              <span className="sidebarLinkIcon">🧰</span>
              <span>Tools</span>
              <span className="sidebarCaret">{toolsOpen ? "▾" : "▸"}</span>
            </button>

            {toolsOpen && (
              <div className="sidebarDropdownMenu">
                <NavLink to="/tools/reminders" className="dropdownItem">
                  Reminders
                </NavLink>

                <NavLink to="/tools/recommendations" className="dropdownItem">
                  Plant Recommendation
                </NavLink>

                <NavLink to="/tools/symptoms" className="dropdownItem">
                  Symptom Assessment
                </NavLink>

                <NavLink to="/tools/weather" className="dropdownItem">
                  Weather
                </NavLink>
              </div>
            )}
          </div>

          <NavLink
            to="/resources"
            className={({ isActive }) => `sidebarLink ${isActive ? "active" : ""}`}
          >
            <span className="sidebarLinkIcon">📚</span>
            <span>Resources</span>
          </NavLink>

          <NavLink
            to="/profile/settings"
            className={({ isActive }) => `sidebarLink ${isActive ? "active" : ""}`}
          >
            <span className="sidebarLinkIcon">⚙️</span>
            <span>Settings</span>
          </NavLink>
        </nav>

        <div className="sidebarDivider" />

        <div className="sidebarFooter">
          <div className="sidebarFooterTitle">Navigation</div>
          <div className="sidebarFooterText">
            Use the sidebar to move between Home, My Garden, Tools, Resources, and Settings.
          </div>
        </div>
      </aside>

      <main className="gardenMain">
        <div className="dashboardTopbar">
          <div>
            <h1 className="toolTitle">{title}</h1>
            {subtitle ? <p className="dashboardSubtitle">{subtitle}</p> : null}
          </div>

          {badge ? <div className="topbarBadge">{badge}</div> : null}
        </div>

        {children}
      </main>
    </div>
  );
}