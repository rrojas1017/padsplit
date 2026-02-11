import { ReactNode } from 'react';
import { Sun, Moon, Bell, Search } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = hasRole(['super_admin']);

  const { unreadCount, criticalNotifications } = useAdminNotifications();
  const hasCritical = isSuperAdmin && criticalNotifications.length > 0;

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="ml-4">{actions}</div>}
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search..." 
            className="pl-9 w-64 bg-background/50"
          />
        </div>

        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className={`relative ${hasCritical ? 'text-destructive hover:text-destructive' : ''}`}
          onClick={() => isSuperAdmin && navigate('/billing')}
        >
          <Bell className={`w-5 h-5 ${hasCritical ? 'animate-pulse' : ''}`} />
          {isSuperAdmin && unreadCount > 0 ? (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] flex items-center justify-center"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          ) : (
            <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
          )}
        </Button>

        {/* Theme toggle */}
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {theme === 'dark' ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </Button>

        {/* User avatar */}
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <span className="text-primary-foreground text-sm font-medium">
            {user?.name?.charAt(0) || 'U'}
          </span>
        </div>
      </div>
    </header>
  );
}
