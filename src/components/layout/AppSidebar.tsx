import { 
  LayoutDashboard, 
  Users, 
  BarChart3, 
  Settings, 
  LogOut,
  Monitor,
  FileText,
  Shield,
  ChevronLeft,
  PlusCircle,
  Link2,
  Upload
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { cn } from '@/lib/utils';
import padsplitLogo from '@/assets/padsplit-logo.jpeg';
import appendifyLogo from '@/assets/appendify-logo.png';

const menuItems = [
  { 
    icon: LayoutDashboard, 
    label: 'Dashboard', 
    path: '/dashboard',
    roles: ['super_admin', 'admin', 'supervisor', 'agent'] 
  },
  { 
    icon: BarChart3, 
    label: 'My Performance', 
    path: '/my-performance',
    roles: ['agent'] 
  },
  {
    icon: PlusCircle,
    label: 'Add Booking',
    path: '/add-booking',
    roles: ['super_admin', 'admin', 'supervisor', 'agent']
  },
  { 
    icon: Users, 
    label: 'Agent Leaderboard', 
    path: '/leaderboard',
    roles: ['super_admin', 'admin', 'supervisor'] 
  },
  { 
    icon: FileText, 
    label: 'Reports', 
    path: '/reports',
    roles: ['super_admin', 'admin', 'supervisor'] 
  },
  { 
    icon: Monitor, 
    label: 'Operations View', 
    path: '/wallboard',
    roles: ['super_admin', 'admin', 'supervisor'] 
  },
  { 
    icon: Users, 
    label: 'User Management', 
    path: '/users',
    roles: ['super_admin', 'admin'] 
  },
  {
    icon: Link2,
    label: 'Display Links',
    path: '/display-links',
    roles: ['super_admin', 'admin']
  },
  {
    icon: Upload,
    label: 'Import Bookings',
    path: '/import-bookings',
    roles: ['super_admin', 'admin']
  },
  { 
    icon: Shield, 
    label: 'Audit Log', 
    path: '/audit-log',
    roles: ['super_admin', 'admin'] 
  },
  { 
    icon: Settings, 
    label: 'Settings', 
    path: '/settings',
    roles: ['super_admin', 'admin'] 
  },
];

export function AppSidebar() {
  const { user, logout, hasRole } = useAuth();
  const location = useLocation();
  const { collapsed, toggleSidebar } = useSidebar();

  const visibleItems = menuItems.filter(item => 
    hasRole(item.roles as any[])
  );

  const roleLabel = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    supervisor: 'Supervisor',
    agent: 'Agent',
  };

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 h-full bg-sidebar border-r border-sidebar-border flex flex-col z-50 transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="p-4 flex items-center justify-between border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <img src={padsplitLogo} alt="PadSplit" className="h-8 w-auto rounded" />
            <div className="flex flex-col">
              <span className="text-sidebar-foreground font-semibold text-sm">PadSplit</span>
              <div className="flex items-center gap-1">
                <span className="text-sidebar-foreground/60 text-xs">by</span>
                <img src={appendifyLogo} alt="Appendify" className="h-3 w-auto" />
              </div>
            </div>
          </div>
        )}
        <button 
          onClick={toggleSidebar}
          className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors"
        >
          <ChevronLeft className={cn(
            "w-4 h-4 text-sidebar-foreground transition-transform",
            collapsed && "rotate-180"
          )} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                isActive 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-glow" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-sidebar-border">
        {!collapsed && user && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-sidebar-accent/50">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">{roleLabel[user.role]}</p>
          </div>
        )}
        <button
          onClick={logout}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg w-full transition-colors",
            "text-sidebar-foreground hover:bg-destructive/20 hover:text-destructive"
          )}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
        {!collapsed && (
          <p className="mt-3 text-center text-xs text-sidebar-foreground/50">
            Powered by Appendify LLC
          </p>
        )}
      </div>
    </aside>
  );
}
