import { Activity, CircleGauge, Cog, Database, GitBranch, LayoutDashboard, Save, ScrollText, ShieldAlert, Zap } from 'lucide-react';
import { APP_VERSION } from '../../version.js';

type IconComponent = typeof Zap;

export type PageId =
  | 'Overview'
  | 'Workflow'
  | 'Devices'
  | 'Modbus Monitor'
  | 'Runtime Monitor'
  | 'Traffic Monitor'
  | 'Audit Log'
  | 'Validation'
  | 'Project Settings';

interface NavItem {
  id: PageId;
  label: string;
  Icon: IconComponent;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/** All baseline pages plus Overview, in order, grouped for scanning. */
const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Build',
    items: [
      { id: 'Overview', label: 'Overview', Icon: LayoutDashboard },
      { id: 'Workflow', label: 'Workflow', Icon: GitBranch },
      { id: 'Devices', label: 'Devices', Icon: Database },
    ],
  },
  {
    label: 'Monitor',
    items: [
      { id: 'Modbus Monitor', label: 'Modbus Monitor', Icon: Activity },
      { id: 'Runtime Monitor', label: 'Runtime Monitor', Icon: CircleGauge },
      { id: 'Traffic Monitor', label: 'Traffic Monitor', Icon: Save },
    ],
  },
  {
    label: 'Assurance',
    items: [
      { id: 'Audit Log', label: 'Audit Log', Icon: ScrollText },
      { id: 'Validation', label: 'Validation', Icon: ShieldAlert },
      { id: 'Project Settings', label: 'Project Settings', Icon: Cog },
    ],
  },
];

export const NAV_PAGE_IDS: PageId[] = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.id));

export interface SidebarProps {
  page: PageId;
  onNavigate: (page: PageId) => void;
}

/**
 * Application navigation. Presentation only: it calls the same page setter the
 * baseline sidebar used and adds `aria-current` for the active page.
 */
export function Sidebar({ page, onNavigate }: SidebarProps) {
  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand__mark" aria-hidden="true">
          <Zap size={20} />
        </span>
        <span className="sidebar-brand__text">
          <span className="sidebar-brand__kicker">Modbus</span>
          <b className="sidebar-brand__name">Workflow Studio</b>
        </span>
      </div>

      <nav className="sidebar-nav" aria-label="Application sections">
        {NAV_GROUPS.map((group) => (
          <div className="sidebar-nav__group" key={group.label}>
            <div className="sidebar-nav__label">{group.label}</div>
            {group.items.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                className="nav-item"
                aria-current={page === id ? 'page' : undefined}
                title={label}
                onClick={() => onNavigate(id)}
              >
                <span className="nav-item__icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span className="nav-item__label">{label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="sidebar-foot__row">
          <span className="sidebar-foot__version">v{APP_VERSION}</span>
          <span className="pill pill--neutral">Local / LAN</span>
        </div>
        <span>No authentication — trusted network only</span>
      </div>
    </aside>
  );
}
