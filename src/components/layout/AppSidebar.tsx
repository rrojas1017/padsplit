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
  ChevronDown,
  PlusCircle,
  Link2,
  Upload,
  GraduationCap,
  Activity,
  Lightbulb,
  Wrench,
  ClipboardCheck,
  Target,
  DollarSign,
  Headphones,
  ClipboardList,
  Calculator,
  Tag,
  Megaphone,
  MapPin,
  GripVertical,
  RotateCcw,
  FlaskConical,
  ScrollText,
  FolderKanban
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useSidebarOrder } from '@/hooks/useSidebarOrder';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import padsplitLogo from '@/assets/padsplit-logo.jpeg';
import appendifyLogo from '@/assets/appendify-logo.png';

type MenuGroup = 'core' | 'admin';

interface MenuItem {
  icon: React.ElementType;
  label: string;
  path: string;
  roles: string[];
  group: MenuGroup;
}

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', roles: ['super_admin', 'admin', 'supervisor', 'agent'], group: 'core' },
  { icon: BarChart3, label: 'My Performance', path: '/my-performance', roles: ['agent'], group: 'core' },
  { icon: ClipboardList, label: 'My Bookings', path: '/my-bookings', roles: ['agent'], group: 'core' },
  { icon: ClipboardCheck, label: 'My QA', path: '/my-qa', roles: ['agent'], group: 'core' },
  { icon: PlusCircle, label: 'Add Booking', path: '/add-booking', roles: ['super_admin', 'admin', 'supervisor', 'agent'], group: 'core' },
  { icon: Users, label: 'Agent Leaderboard', path: '/leaderboard', roles: ['super_admin', 'admin', 'supervisor'], group: 'core' },
  { icon: FileText, label: 'Reports', path: '/reports', roles: ['super_admin', 'admin', 'supervisor'], group: 'core' },
  { icon: Monitor, label: 'Operations View', path: '/wallboard', roles: ['super_admin', 'admin', 'supervisor'], group: 'core' },
  { icon: GraduationCap, label: 'Coaching Hub', path: '/coaching-hub', roles: ['super_admin', 'admin', 'supervisor'], group: 'core' },
  { icon: ClipboardCheck, label: 'QA Dashboard', path: '/qa-dashboard', roles: ['super_admin', 'admin', 'supervisor'], group: 'core' },
  { icon: Headphones, label: 'Coaching Engagement', path: '/coaching-engagement', roles: ['super_admin', 'admin', 'supervisor'], group: 'core' },
  { icon: Lightbulb, label: 'Communication Insights', path: '/call-insights', roles: ['super_admin', 'admin'], group: 'admin' },
  { icon: Target, label: 'Agent Goals', path: '/agent-goals', roles: ['super_admin', 'admin', 'supervisor'], group: 'core' },
  { icon: Calculator, label: 'Move-In Calculator', path: '/tools/move-in-calculator', roles: ['super_admin', 'admin', 'supervisor', 'agent'], group: 'core' },
  { icon: MapPin, label: 'Market Intelligence', path: '/market-intelligence', roles: ['super_admin', 'admin'], group: 'core' },
  { icon: Users, label: 'User Management', path: '/users', roles: ['super_admin', 'admin', 'supervisor'], group: 'admin' },
  { icon: Activity, label: 'Agent Status', path: '/agent-status', roles: ['super_admin', 'admin', 'supervisor'], group: 'admin' },
  { icon: Link2, label: 'Display Links', path: '/display-links', roles: ['super_admin', 'admin'], group: 'admin' },
  { icon: Upload, label: 'Import Bookings', path: '/import-bookings', roles: ['super_admin', 'admin'], group: 'admin' },
  { icon: Upload, label: 'Historical Import', path: '/historical-import', roles: ['super_admin', 'admin'], group: 'admin' },
  { icon: Shield, label: 'Audit Log', path: '/audit-log', roles: ['super_admin'], group: 'admin' },
  { icon: Settings, label: 'Settings', path: '/settings', roles: ['super_admin', 'admin'], group: 'admin' },
  { icon: DollarSign, label: 'Cost & Billing', path: '/billing', roles: ['super_admin'], group: 'admin' },
  { icon: Tag, label: 'Promo Codes', path: '/settings/promo-codes', roles: ['super_admin', 'admin'], group: 'admin' },
  { icon: Megaphone, label: 'Broadcasts', path: '/broadcasts', roles: ['super_admin', 'admin', 'supervisor'], group: 'admin' },
  { icon: ScrollText, label: 'Script Builder', path: '/research/scripts', roles: ['super_admin', 'admin'], group: 'admin' },
  { icon: FolderKanban, label: 'Campaign Manager', path: '/research/manage-campaigns', roles: ['super_admin', 'admin'], group: 'admin' },
  { icon: FlaskConical, label: 'Research Insights', path: '/research/insights', roles: ['super_admin', 'admin'], group: 'admin' },
];

export function AppSidebar() {
  const { user, logout, hasRole } = useAuth();
  const location = useLocation();
  const { collapsed, toggleSidebar } = useSidebar();
  const { getOrderedItems, moveItem, resetOrder, hasCustomOrder } = useSidebarOrder(user?.id);
  
  const [adminExpanded, setAdminExpanded] = useState(() => {
    const saved = localStorage.getItem('sidebar-admin-expanded');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Drag state
  const [draggedPath, setDraggedPath] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ group: MenuGroup; index: number } | null>(null);
  const dragCounter = useRef(0);
  const navRef = useRef<HTMLDivElement>(null);
  const scrollPos = useRef(0);
  const isRestoring = useRef(false);

  const isSuperAdmin = user?.role === 'super_admin';
  const isDragEnabled = isSuperAdmin && !collapsed;

  const visibleItems = menuItems.filter(item => hasRole(item.roles as any[]));
  const orderedItems = getOrderedItems(visibleItems);

  const coreItems = orderedItems.filter(item => item.group === 'core');
  const adminItems = orderedItems.filter(item => item.group === 'admin');
  
  const isInAdminGroup = adminItems.some(item => location.pathname === item.path);
  
  useEffect(() => {
    if (isInAdminGroup && !adminExpanded) {
      setAdminExpanded(true);
    }
  }, [isInAdminGroup]);

  useEffect(() => {
    localStorage.setItem('sidebar-admin-expanded', JSON.stringify(adminExpanded));
  }, [adminExpanded]);

  // Restore sidebar scroll position after route change
  useEffect(() => {
    const nav = navRef.current;
    if (nav) {
      isRestoring.current = true;
      requestAnimationFrame(() => {
        nav.scrollTop = scrollPos.current;
        setTimeout(() => {
          if (navRef.current) {
            navRef.current.scrollTop = scrollPos.current;
          }
          isRestoring.current = false;
        }, 80);
      });
    }
  }, [location.pathname]);

  const roleLabel: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    supervisor: 'Supervisor',
    agent: 'Agent',
    researcher: 'Researcher',
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, path: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', path);
    setDraggedPath(path);
  };

  const handleDragEnd = () => {
    setDraggedPath(null);
    setDropTarget(null);
    dragCounter.current = 0;
  };

  const handleDragOver = (e: React.DragEvent, group: MenuGroup, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ group, index });
  };

  const handleDrop = (e: React.DragEvent, group: MenuGroup, index: number) => {
    e.preventDefault();
    const path = e.dataTransfer.getData('text/plain');
    if (path) {
      moveItem(path, group, index, orderedItems);
    }
    setDraggedPath(null);
    setDropTarget(null);
  };

  const renderNavItem = (item: MenuItem, index: number, group: MenuGroup, indented = false) => {
    const isActive = location.pathname === item.path;
    const isDragging = draggedPath === item.path;
    const isDropTarget = dropTarget?.group === group && dropTarget?.index === index;

    return (
      <div
        key={item.path}
        draggable={isDragEnabled}
        onDragStart={isDragEnabled ? (e) => handleDragStart(e, item.path) : undefined}
        onDragEnd={isDragEnabled ? handleDragEnd : undefined}
        onDragOver={isDragEnabled ? (e) => handleDragOver(e, group, index) : undefined}
        onDrop={isDragEnabled ? (e) => handleDrop(e, group, index) : undefined}
        className={cn(
          isDragging && 'sidebar-dragging',
          isDropTarget && 'sidebar-drag-over'
        )}
      >
        <NavLink
          to={item.path}
          onClick={() => {
            if (navRef.current) {
              scrollPos.current = navRef.current.scrollTop;
            }
          }}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group/item",
            indented && !collapsed && "ml-3",
            isActive 
              ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-glow" 
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          {isDragEnabled && (
            <GripVertical className="w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover/item:opacity-50 transition-opacity cursor-grab" />
          )}
          <item.icon className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
        </NavLink>
      </div>
    );
  };

  // Drop zone at end of a section
  const renderEndDropZone = (group: MenuGroup, index: number) => {
    if (!isDragEnabled) return null;
    const isOver = dropTarget?.group === group && dropTarget?.index === index;
    return (
      <div
        onDragOver={(e) => handleDragOver(e, group, index)}
        onDrop={(e) => handleDrop(e, group, index)}
        className={cn("h-1 rounded transition-all", isOver && "sidebar-drag-over")}
      />
    );
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
      <nav
        ref={navRef}
        className="flex-1 p-3 space-y-1 overflow-y-auto"
      >
        {/* Core Items */}
        {coreItems.map((item, i) => renderNavItem(item, i, 'core'))}
        {renderEndDropZone('core', coreItems.length)}
        
        {/* Admin Group */}
        {adminItems.length > 0 && (
          <>
            <div className="pt-2" />
            <Collapsible open={adminExpanded} onOpenChange={setAdminExpanded}>
              <CollapsibleTrigger 
                className={cn(
                  "flex items-center gap-3 px-3 py-2 w-full rounded-lg transition-colors",
                  "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  isInAdminGroup && "text-sidebar-foreground"
                )}
              >
                <Wrench className="w-4 h-4 flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="text-xs font-semibold uppercase tracking-wider flex-1 text-left">
                      Admin
                    </span>
                    <ChevronDown className={cn(
                      "w-4 h-4 transition-transform duration-200",
                      adminExpanded && "rotate-180"
                    )} />
                  </>
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 mt-1">
                {adminItems.map((item, i) => renderNavItem(item, i, 'admin', true))}
                {renderEndDropZone('admin', adminItems.length)}
              </CollapsibleContent>
            </Collapsible>
          </>
        )}

        {/* Reset order button - super admin only */}
        {isDragEnabled && hasCustomOrder && (
          <button
            onClick={resetOrder}
            className="flex items-center gap-2 px-3 py-2 mt-2 w-full rounded-lg text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="text-xs">Reset to default</span>
          </button>
        )}
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
