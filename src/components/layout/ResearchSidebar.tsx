import { 
  LayoutDashboard, 
  ClipboardList, 
  PhoneCall, 
  History,
  LogOut,
  ChevronLeft
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { cn } from '@/lib/utils';
import padsplitLogo from '@/assets/padsplit-logo.jpeg';
import appendifyLogo from '@/assets/appendify-logo.png';

const researchMenuItems = [
  { icon: LayoutDashboard, label: 'My Dashboard', path: '/research/dashboard' },
  { icon: ClipboardList, label: 'Active Campaigns', path: '/research/campaigns' },
  { icon: PhoneCall, label: 'Log Survey Call', path: '/research/log-call' },
  { icon: History, label: 'My Call History', path: '/research/history' },
];

export function ResearchSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { collapsed, toggleSidebar } = useSidebar();

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
              <span className="text-sidebar-foreground/60 text-xs">Research</span>
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
        {researchMenuItems.map((item) => {
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
            <p className="text-xs text-sidebar-foreground/60 truncate">Researcher</p>
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
