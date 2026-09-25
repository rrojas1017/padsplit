import {
  Activity,
  BarChart3,
  Briefcase,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ClipboardCheck,
  ClipboardList,
  Database,
  DollarSign,
  FileText,
  FlaskConical,
  FolderKanban,
  GraduationCap,
  GripVertical,
  Headphones,
  History,
  Key,
  KeyRound,
  LayoutDashboard,
  Lightbulb,
  Link2,
  LogOut,
  MapPin,
  Megaphone,
  Monitor,
  PhoneCall,
  PlusCircle,
  RotateCcw,
  ScrollText,
  Settings,
  Shield,
  Tag,
  Target,
  Upload,
  Users,
  Wrench,
} from 'lucide-react';
import { ChangePasswordDialog } from '@/components/account/ChangePasswordDialog';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { SidebarGroupId, useSidebarOrder } from '@/hooks/useSidebarOrder';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import padsplitLogo from '@/assets/padsplit-logo.jpeg';
import appendifyLogo from '@/assets/appendify-logo.png';

interface MenuItem {
  id: string;
  icon: React.ElementType;
  label: string;
  path: string;
  roles: string[];
}

interface MenuGroup {
  id: SidebarGroupId;
  label: string;
  icon: React.ElementType;
  items: MenuItem[];
}

const item = (
  group: SidebarGroupId,
  icon: React.ElementType,
  label: string,
  path: string,
  roles: string[]
): MenuItem => ({ id: `${group}:${path}`, icon, label, path, roles });

const menuGroups: MenuGroup[] = [
  {
    id: 'my_work', label: 'My Work', icon: Briefcase, items: [
      item('my_work', BarChart3, 'My Performance', '/my-performance', ['agent']),
      item('my_work', ClipboardList, 'My Bookings', '/my-bookings', ['agent']),
      item('my_work', ClipboardCheck, 'My QA', '/my-qa', ['agent']),
      item('my_work', PlusCircle, 'Add Booking', '/add-booking', ['agent']),
      item('my_work', Calculator, 'Move-In Calculator', '/tools/move-in-calculator', ['agent']),
    ],
  },
  {
    id: 'sales', label: 'Sales', icon: BarChart3, items: [
      item('sales', LayoutDashboard, 'Dashboard', '/dashboard', ['super_admin', 'admin', 'supervisor']),
      item('sales', FileText, 'Reports', '/reports', ['super_admin', 'admin', 'supervisor']),
      item('sales', PlusCircle, 'Add Booking', '/add-booking', ['super_admin', 'admin', 'supervisor']),
      item('sales', Users, 'Agent Leaderboard', '/leaderboard', ['super_admin', 'admin', 'supervisor']),
      item('sales', Target, 'Agent Goals', '/agent-goals', ['super_admin', 'admin', 'supervisor']),
      item('sales', Monitor, 'Operations View', '/wallboard', ['super_admin', 'admin', 'supervisor']),
      item('sales', Activity, 'Agent Status', '/agent-status', ['super_admin', 'admin', 'supervisor']),
      item('sales', Calculator, 'Move-In Calculator', '/tools/move-in-calculator', ['super_admin', 'admin', 'supervisor']),
    ],
  },
  {
    id: 'coaching', label: 'Coaching & QA', icon: GraduationCap, items: [
      item('coaching', GraduationCap, "Jeff's Hub", '/coaching-hub', ['super_admin', 'admin', 'supervisor']),
      item('coaching', ClipboardCheck, "Katty's Hub", '/qa-dashboard', ['super_admin', 'admin', 'supervisor']),
      item('coaching', Headphones, 'Coaching Engagement', '/coaching-engagement', ['super_admin', 'admin', 'supervisor']),
    ],
  },
  {
    id: 'research', label: 'Research', icon: FlaskConical, items: [
      item('research', LayoutDashboard, 'Research Dashboard', '/research/dashboard', ['researcher', 'super_admin', 'admin']),
      item('research', ClipboardList, 'Active Campaigns', '/research/campaigns', ['researcher', 'super_admin', 'admin']),
      item('research', PhoneCall, 'Log Survey Call', '/research/log-call', ['researcher', 'super_admin', 'admin']),
      item('research', History, 'My Call History', '/research/history', ['researcher', 'super_admin', 'admin']),
      item('research', ScrollText, 'Script Builder', '/research/scripts', ['super_admin', 'admin']),
      item('research', FolderKanban, 'Campaign Manager', '/research/manage-campaigns', ['super_admin', 'admin']),
      item('research', FlaskConical, 'Research Insights', '/research/insights', ['super_admin', 'admin', 'supervisor']),
    ],
  },
  {
    id: 'insights', label: 'Insights', icon: Lightbulb, items: [
      item('insights', Lightbulb, 'Communication Insights', '/call-insights', ['super_admin', 'admin']),
      item('insights', MapPin, 'Market Intelligence', '/market-intelligence', ['super_admin', 'admin']),
    ],
  },
  {
    id: 'data', label: 'Data & Communications', icon: Database, items: [
      item('data', Upload, 'Import Bookings', '/import-bookings', ['super_admin', 'admin']),
      item('data', Upload, 'Historical Import', '/historical-import', ['super_admin', 'admin']),
      item('data', Link2, 'Display Links', '/display-links', ['super_admin', 'admin']),
      item('data', Megaphone, 'Broadcasts', '/broadcasts', ['super_admin', 'admin', 'supervisor']),
    ],
  },
  {
    id: 'admin', label: 'Administration', icon: Wrench, items: [
      item('admin', Users, 'User Management', '/users', ['super_admin', 'admin', 'supervisor']),
      item('admin', Settings, 'Settings', '/settings', ['super_admin', 'admin']),
      item('admin', Tag, 'Promo Codes', '/settings/promo-codes', ['super_admin', 'admin']),
      item('admin', Key, 'API Credentials', '/api-credentials', ['super_admin', 'admin']),
      item('admin', Shield, 'Audit Log', '/audit-log', ['super_admin']),
      item('admin', DollarSign, 'Cost & Billing', '/billing', ['super_admin']),
    ],
  },
];

const EXPANDED_STORAGE_KEY = 'sidebar-group-expanded-v1';

type ExpandedGroups = Partial<Record<SidebarGroupId, boolean>>;

function loadExpandedGroups(): ExpandedGroups {
  try {
    const raw = localStorage.getItem(EXPANDED_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => typeof value === 'boolean')
    ) as ExpandedGroups;
  } catch {
    return {};
  }
}

export function AppSidebar() {
  const { user, logout, hasRole, isImpersonating } = useAuth();
  const [changePwOpen, setChangePwOpen] = useState(false);
  const location = useLocation();
  const { collapsed, toggleSidebar } = useSidebar();
  const { getOrderedItems, moveItem, resetOrder, hasCustomOrder } = useSidebarOrder(user?.id);
  const [expandedGroups, setExpandedGroups] = useState<ExpandedGroups>(() => loadExpandedGroups());
  const [draggedItem, setDraggedItem] = useState<{ groupId: SidebarGroupId; path: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ groupId: SidebarGroupId; index: number } | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const scrollPos = useRef(0);
  const isRestoring = useRef(false);

  const isSuperAdmin = user?.role === 'super_admin';
  const isDragEnabled = isSuperAdmin && !collapsed;

  const visibleGroups = menuGroups
    .map((group) => ({
      ...group,
      items: getOrderedItems(group.id, group.items.filter((menuItem) => hasRole(menuItem.roles as any[]))),
    }))
    .filter((group) => group.items.length > 0);

  const routeGroup = visibleGroups.find((group) =>
    group.items.some((menuItem) => location.pathname === menuItem.path)
  )?.id;

  const defaultExpanded = (groupId: SidebarGroupId) => {
    if (isSuperAdmin) return true;
    if (user?.role === 'agent') return groupId === 'my_work';
    if (user?.role === 'researcher') return groupId === 'research';
    if (user?.role === 'supervisor' || user?.role === 'admin') return groupId === 'sales';
    return false;
  };

  const isGroupExpanded = (groupId: SidebarGroupId) =>
    expandedGroups[groupId] ?? defaultExpanded(groupId);

  const setGroupExpanded = (groupId: SidebarGroupId, open: boolean) => {
    setExpandedGroups((current) => {
      const next = { ...current, [groupId]: open };
      localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    if (routeGroup && !isGroupExpanded(routeGroup)) {
      setGroupExpanded(routeGroup, true);
    }
  }, [routeGroup]);

  useEffect(() => {
    const nav = navRef.current;
    if (nav) {
      isRestoring.current = true;
      requestAnimationFrame(() => {
        nav.scrollTop = scrollPos.current;
        setTimeout(() => {
          if (navRef.current) navRef.current.scrollTop = scrollPos.current;
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

  const handleDragStart = (event: React.DragEvent, groupId: SidebarGroupId, path: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', `${groupId}:${path}`);
    setDraggedItem({ groupId, path });
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDropTarget(null);
  };

  const handleDragOver = (event: React.DragEvent, groupId: SidebarGroupId, index: number) => {
    if (draggedItem?.groupId !== groupId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTarget({ groupId, index });
  };

  const handleDrop = (
    event: React.DragEvent,
    groupId: SidebarGroupId,
    index: number,
    groupItems: MenuItem[]
  ) => {
    event.preventDefault();
    if (!draggedItem || draggedItem.groupId !== groupId) return;
    moveItem(groupId, draggedItem.path, index, groupItems);
    setDraggedItem(null);
    setDropTarget(null);
  };

  const renderNavItem = (menuItem: MenuItem, index: number, group: MenuGroup) => {
    const isActive = location.pathname === menuItem.path;
    const isDragging = draggedItem?.groupId === group.id && draggedItem.path === menuItem.path;
    const isDropTarget = dropTarget?.groupId === group.id && dropTarget.index === index;

    return (
      <div
        key={menuItem.id}
        draggable={isDragEnabled}
        onDragStart={isDragEnabled ? (event) => handleDragStart(event, group.id, menuItem.path) : undefined}
        onDragEnd={isDragEnabled ? handleDragEnd : undefined}
        onDragOver={isDragEnabled ? (event) => handleDragOver(event, group.id, index) : undefined}
        onDrop={isDragEnabled ? (event) => handleDrop(event, group.id, index, group.items) : undefined}
        className={cn(isDragging && 'sidebar-dragging', isDropTarget && 'sidebar-drag-over')}
      >
        <NavLink
          to={menuItem.path}
          onClick={() => {
            if (navRef.current) scrollPos.current = navRef.current.scrollTop;
          }}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group/item',
            !collapsed && 'ml-3',
            isActive
              ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-glow'
              : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
          )}
        >
          {isDragEnabled && (
            <GripVertical className="w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover/item:opacity-50 transition-opacity cursor-grab" />
          )}
          <menuItem.icon className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">{menuItem.label}</span>}
        </NavLink>
      </div>
    );
  };

  const renderEndDropZone = (group: MenuGroup) => {
    if (!isDragEnabled) return null;
    const index = group.items.length;
    const isOver = dropTarget?.groupId === group.id && dropTarget.index === index;
    return (
      <div
        onDragOver={(event) => handleDragOver(event, group.id, index)}
        onDrop={(event) => handleDrop(event, group.id, index, group.items)}
        className={cn('h-1 rounded transition-all', isOver && 'sidebar-drag-over')}
      />
    );
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full bg-sidebar border-r border-sidebar-border flex flex-col z-50 transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
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
        <button onClick={toggleSidebar} className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors">
          <ChevronLeft className={cn('w-4 h-4 text-sidebar-foreground transition-transform', collapsed && 'rotate-180')} />
        </button>
      </div>

      <nav ref={navRef} className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visibleGroups.map((group) => (
          <Collapsible
            key={group.id}
            open={isGroupExpanded(group.id)}
            onOpenChange={(open) => setGroupExpanded(group.id, open)}
          >
            <CollapsibleTrigger
              className={cn(
                'flex items-center gap-3 px-3 py-2 w-full rounded-lg transition-colors',
                'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                routeGroup === group.id && 'text-sidebar-foreground'
              )}
            >
              <group.icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && (
                <>
                  <span className="text-xs font-semibold uppercase tracking-wider flex-1 text-left">{group.label}</span>
                  <ChevronDown className={cn('w-4 h-4 transition-transform duration-200', isGroupExpanded(group.id) && 'rotate-180')} />
                </>
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-1">
              {group.items.map((menuItem, index) => renderNavItem(menuItem, index, group))}
              {renderEndDropZone(group)}
            </CollapsibleContent>
          </Collapsible>
        ))}

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

      <div className="p-3 border-t border-sidebar-border">
        {!collapsed && user && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-sidebar-accent/50">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">{roleLabel[user.role]}</p>
          </div>
        )}
        {user && !isImpersonating && (
          <button
            onClick={() => setChangePwOpen(true)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full transition-colors text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <KeyRound className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">Change password</span>}
          </button>
        )}
        <ChangePasswordDialog open={changePwOpen} onOpenChange={setChangePwOpen} />
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full transition-colors text-sidebar-foreground hover:bg-destructive/20 hover:text-destructive"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
        {!collapsed && (
          <p className="mt-3 text-center text-xs text-sidebar-foreground/50">Powered by Appendify LLC</p>
        )}
      </div>
    </aside>
  );
}