import React from 'react';
import { AlertTriangle, X, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdminNotification } from '@/hooks/useAdminNotifications';

interface NotificationBannerProps {
  notification: AdminNotification;
  onResolve: (id: string) => void;
  onDismiss: (id: string) => void;
}

export function NotificationBanner({ notification, onResolve, onDismiss }: NotificationBannerProps) {
  return (
    <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-start gap-4">
      <div className="flex-shrink-0">
        <AlertTriangle className="h-5 w-5 text-destructive" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium uppercase tracking-wider text-destructive/80">
            {notification.service}
          </span>
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs text-destructive font-semibold uppercase">
            Critical
          </span>
        </div>
        <h4 className="font-semibold text-foreground">{notification.title}</h4>
        <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onResolve(notification.id)}
          className="gap-1"
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Resolve
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onDismiss(notification.id)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
