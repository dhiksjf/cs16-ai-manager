import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Wrench,
  Users,
  FileText,
  Settings,
  CircuitBoard,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'dashboard' },
  { path: '/repairs', icon: Wrench, label: 'repairs' },
  { path: '/customers', icon: Users, label: 'customers' },
  { path: '/invoices', icon: FileText, label: 'invoices' },
  { path: '/settings', icon: Settings, label: 'settings' },
];

export const Sidebar: React.FC<{ collapsed: boolean }> = ({ collapsed }) => {
  const location = useLocation();
  const { t } = useTranslation();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen flex flex-col border-r bg-sidebar-bg transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
      style={{ backgroundColor: 'hsl(var(--sidebar-bg))', borderColor: 'hsl(var(--sidebar-border))' }}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-b px-4" style={{ borderColor: 'hsl(var(--sidebar-border))' }}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/25">
            <CircuitBoard className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold leading-tight tracking-tight">{t('app.name')}</span>
              <span className="text-[10px] leading-tight text-muted-foreground">{t('app.version')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 group',
                isActive
                  ? 'bg-primary/10 text-primary shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className={cn('h-5 w-5 shrink-0 transition-transform', !collapsed && 'group-hover:scale-110')} />
              {!collapsed && <span>{t(`nav.${item.label}`)}</span>}
              {isActive && !collapsed && (
                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom branding */}
      {!collapsed && (
        <div className="border-t p-4" style={{ borderColor: 'hsl(var(--sidebar-border))' }}>
          <p className="text-xs text-muted-foreground text-center">
            {t('app.tagline')}
          </p>
        </div>
      )}
    </aside>
  );
};
