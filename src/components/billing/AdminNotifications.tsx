import React, { useState } from 'react';
import { Bell, CheckCircle, AlertTriangle, Info, ChevronDown, ChevronUp, Trash2, Eye, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAdminNotifications, AdminNotification } from '@/hooks/useAdminNotifications';
import { NotificationBanner } from './NotificationBanner';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { getProviderLabel, getProviderBadgeColor } from '@/utils/providerLabels';

function getSeverityIcon(severity: string) {
  switch (severity) {
    case 'critical':
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    default:
      return <Info className="h-4 w-4 text-blue-500" />;
  }
}

function getSeverityBadge(severity: string) {
  switch (severity) {
    case 'critical':
      return <Badge variant="destructive">Critical</Badge>;
    case 'warning':
      return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Warning</Badge>;
    default:
      return <Badge variant="secondary">Info</Badge>;
  }
}

function getServiceBadge(service: string, isSuperAdmin: boolean) {
  return (
    <Badge className={getProviderBadgeColor(service)}>
      {getProviderLabel(service, isSuperAdmin)}
    </Badge>
  );
}

interface NotificationCardProps {
  notification: AdminNotification;
  onMarkRead: (id: string) => void;
  onMarkResolved: (id: string) => void;
  onDelete?: (id: string) => void;
  isSuperAdmin: boolean;
}

function NotificationCard({ notification, onMarkRead, onMarkResolved, onDelete, isSuperAdmin }: NotificationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasMetadata = notification.metadata && Object.keys(notification.metadata).length > 0;

  return (
    <div className={`border rounded-lg p-4 transition-colors ${
      notification.is_resolved 
        ? 'bg-muted/30 border-border/50' 
        : notification.severity === 'critical'
          ? 'bg-destructive/5 border-destructive/20'
          : notification.severity === 'warning'
            ? 'bg-amber-500/5 border-amber-500/20'
            : 'bg-background border-border'
    }`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getSeverityIcon(notification.severity)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {getServiceBadge(notification.service, isSuperAdmin)}
            {getSeverityBadge(notification.severity)}
            {!notification.is_read && !notification.is_resolved && (
              <Badge variant="outline" className="text-xs">New</Badge>
            )}
            {notification.is_resolved && (
              <Badge variant="outline" className="text-green-600 border-green-500/20 bg-green-500/10">
                Resolved
              </Badge>
            )}
          </div>
          <h4 className={`font-semibold ${notification.is_resolved ? 'text-muted-foreground' : 'text-foreground'}`}>
            {notification.title}
          </h4>
          <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
          
          {hasMetadata && isSuperAdmin && (
            <Collapsible open={expanded} onOpenChange={setExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2 mt-2 text-xs gap-1">
                  {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {expanded ? 'Hide' : 'Show'} details
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="text-xs bg-muted/50 rounded p-2 mt-2 overflow-x-auto">
                  {JSON.stringify(notification.metadata, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          )}
          
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
            {notification.resolved_at && (
              <>
                <span>•</span>
                <span className="text-green-600">
                  Resolved {formatDistanceToNow(new Date(notification.resolved_at), { addSuffix: true })}
                </span>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1 flex-shrink-0">
          {!notification.is_read && !notification.is_resolved && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onMarkRead(notification.id)}
              title="Mark as read"
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
          {!notification.is_resolved && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-500/10"
              onClick={() => onMarkResolved(notification.id)}
              title="Mark as resolved"
            >
              <CheckCircle className="h-4 w-4" />
            </Button>
          )}
          {notification.is_resolved && onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(notification.id)}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminNotifications() {
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole(['super_admin']);
  
  const {
    unresolvedNotifications,
    resolvedNotifications,
    criticalNotifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAsResolved,
    deleteNotification,
  } = useAdminNotifications();

  const [showResolved, setShowResolved] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            System Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-20 bg-muted rounded-lg" />
            <div className="h-20 bg-muted rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const allClear = unresolvedNotifications.length === 0;

  return (
    <div className="space-y-4">
      {/* Critical Alert Banners */}
      {criticalNotifications.map(notification => (
        <NotificationBanner
          key={notification.id}
          notification={notification}
          onResolve={markAsResolved}
          onDismiss={markAsRead}
        />
      ))}

      {/* Main Notifications Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              System Alerts
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount} new
                </Badge>
              )}
            </CardTitle>
            {resolvedNotifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowResolved(!showResolved)}
                className="text-xs"
              >
                {showResolved ? 'Hide' : 'Show'} resolved ({resolvedNotifications.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {allClear ? (
            <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <h4 className="font-medium text-green-700">All Systems Operational</h4>
                <p className="text-sm text-green-600/80">No billing or service alerts at this time</p>
              </div>
            </div>
          ) : (
            unresolvedNotifications
              .filter(n => n.severity !== 'critical') // Critical ones shown as banners above
              .map(notification => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  onMarkRead={markAsRead}
                  onMarkResolved={markAsResolved}
                  isSuperAdmin={isSuperAdmin}
                />
              ))
          )}

          {/* Resolved Notifications */}
          {showResolved && resolvedNotifications.length > 0 && (
            <div className="pt-4 border-t space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Resolved</h4>
              {resolvedNotifications.map(notification => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  onMarkRead={markAsRead}
                  onMarkResolved={markAsResolved}
                  onDelete={deleteNotification}
                  isSuperAdmin={isSuperAdmin}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
