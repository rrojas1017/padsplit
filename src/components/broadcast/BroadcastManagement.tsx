import { useState } from 'react';
import { useBroadcastMessages, BroadcastMessage } from '@/hooks/useBroadcastMessages';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { BroadcastDialog } from './BroadcastDialog';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Megaphone, Plus, MoreHorizontal, Pencil, Trash2, Loader2 } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

export function BroadcastManagement() {
  const { user, hasRole } = useAuth();
  const { broadcasts, isLoading, createBroadcast, updateBroadcast, deleteBroadcast, toggleActive } = 
    useBroadcastMessages({ forManagement: true });
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBroadcast, setEditingBroadcast] = useState<BroadcastMessage | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreate = () => {
    setEditingBroadcast(null);
    setDialogOpen(true);
  };

  const handleEdit = (broadcast: BroadcastMessage) => {
    setEditingBroadcast(broadcast);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (deletingId) {
      await deleteBroadcast(deletingId);
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  const handleSave = async (data: Parameters<typeof createBroadcast>[0] & { is_active?: boolean }) => {
    if (editingBroadcast) {
      return updateBroadcast(editingBroadcast.id, data);
    }
    return createBroadcast(data);
  };

  const getStatusBadge = (broadcast: BroadcastMessage) => {
    if (!broadcast.is_active) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    if (broadcast.expires_at && isPast(new Date(broadcast.expires_at))) {
      return <Badge variant="outline" className="text-muted-foreground">Expired</Badge>;
    }
    return <Badge className="bg-success/20 text-success border-success/30">Active</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5" />
            Broadcast Messages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            Broadcast Messages
          </CardTitle>
          <Button onClick={handleCreate} size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            New Broadcast
          </Button>
        </CardHeader>
        <CardContent>
          {broadcasts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No broadcasts yet</p>
              <p className="text-sm">Create your first broadcast to send announcements to agents.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Status</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead className="w-32">Expires</TableHead>
                    <TableHead className="w-32">Site</TableHead>
                    <TableHead className="w-24">Priority</TableHead>
                    <TableHead className="w-20 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {broadcasts.map((broadcast) => (
                    <TableRow key={broadcast.id}>
                      <TableCell>{getStatusBadge(broadcast)}</TableCell>
                      <TableCell>
                        <p className="line-clamp-2 text-sm">{broadcast.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          by {broadcast.creator_name} • {format(new Date(broadcast.created_at), 'MMM d, yyyy')}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {broadcast.expires_at 
                          ? format(new Date(broadcast.expires_at), 'MMM d, h:mm a')
                          : <span className="text-muted-foreground">Never</span>
                        }
                      </TableCell>
                      <TableCell className="text-sm">
                        {broadcast.site_name || <span className="text-muted-foreground">All Sites</span>}
                      </TableCell>
                      <TableCell className="text-sm">{broadcast.priority}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(broadcast)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => toggleActive(broadcast.id, !broadcast.is_active)}
                            >
                              <Switch className="mr-2 scale-75" checked={broadcast.is_active} />
                              {broadcast.is_active ? 'Deactivate' : 'Activate'}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(broadcast.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <BroadcastDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        broadcast={editingBroadcast}
        onSave={handleSave}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Broadcast</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this broadcast? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
