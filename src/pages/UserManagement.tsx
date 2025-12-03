import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { mockUsers } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Plus, MoreVertical, Shield, ShieldCheck, User, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function UserManagement() {
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin': return <Crown className="w-4 h-4" />;
      case 'admin': return <ShieldCheck className="w-4 h-4" />;
      case 'supervisor': return <Shield className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-accent/20 text-accent';
      case 'admin': return 'bg-primary/20 text-primary';
      case 'supervisor': return 'bg-warning/20 text-warning';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const roleLabels: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    supervisor: 'Supervisor',
    agent: 'Agent',
  };

  return (
    <DashboardLayout 
      title="User Management" 
      subtitle="Manage users and access levels"
    >
      <div className="flex items-center justify-between mb-6">
        <p className="text-muted-foreground">
          {mockUsers.length} users total
        </p>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Add User
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockUsers.map((user) => (
                <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {user.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <span className="font-medium text-foreground">{user.name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-sm text-muted-foreground">
                    {user.email}
                  </td>
                  <td className="py-4 px-4">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
                      getRoleColor(user.role)
                    )}>
                      {getRoleIcon(user.role)}
                      {roleLabels[user.role]}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium",
                      user.status === 'active' 
                        ? "bg-success/20 text-success" 
                        : "bg-muted text-muted-foreground"
                    )}>
                      {user.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Edit User</DropdownMenuItem>
                        <DropdownMenuItem>Change Role</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Deactivate</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
