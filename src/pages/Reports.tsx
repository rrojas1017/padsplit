import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useBookings } from '@/contexts/BookingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAgents } from '@/contexts/AgentsContext';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { SiteFilter } from '@/components/dashboard/SiteFilter';
import { Button } from '@/components/ui/button';
import { Download, Filter, Search, PlusCircle, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export default function Reports() {
  const { bookings } = useBookings();
  const { user } = useAuth();
  const { agents } = useAgents();
  const navigate = useNavigate();

  // Check if user can edit a specific booking
  const canEditBooking = (bookingAgentId: string) => {
    if (!user) return false;
    if (user.role === 'super_admin' || user.role === 'admin') return true;
    if (user.role === 'supervisor') {
      // Supervisors can edit bookings from agents in their site
      const agent = agents.find(a => a.id === bookingAgentId);
      return agent?.siteId === user.siteId;
    }
    if (user.role === 'agent') {
      // Agents can edit their own bookings
      const agent = agents.find(a => a.id === bookingAgentId);
      return agent?.userId === user.id;
    }
    return false;
  };
  
  const statusColors: Record<string, string> = {
    'Pending Move-In': 'bg-warning/20 text-warning',
    'Moved In': 'bg-success/20 text-success',
    'Member Rejected': 'bg-destructive/20 text-destructive',
    'No Show': 'bg-muted text-muted-foreground',
    'Cancelled': 'bg-muted text-muted-foreground',
  };

  return (
    <DashboardLayout 
      title="Reports" 
      subtitle="Detailed booking data and exports"
    >
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <DateRangeFilter />
        <SiteFilter />
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by member name, market..." className="pl-9" />
        </div>
        <Button variant="outline" className="gap-2">
          <Filter className="w-4 h-4" />
          More Filters
        </Button>
        <Button variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
        <Button className="gap-2" onClick={() => navigate('/add-booking')}>
          <PlusCircle className="w-4 h-4" />
          Add Booking
        </Button>
      </div>

      {/* Data Table */}
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Booking Date</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Move-In Date</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Member</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agent</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Market</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Method</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bookings.slice(0, 20).map((booking) => (
                <tr key={booking.id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4 text-sm text-foreground">
                    {format(booking.bookingDate, 'MMM d, yyyy')}
                  </td>
                  <td className="py-3 px-4 text-sm text-foreground">
                    {format(booking.moveInDate, 'MMM d, yyyy')}
                  </td>
                  <td className="py-3 px-4 text-sm font-medium text-foreground">
                    {booking.memberName}
                  </td>
                  <td className="py-3 px-4 text-sm text-foreground">
                    {booking.agentName}
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">
                    {booking.marketCity}, {booking.marketState}
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">
                    {booking.bookingType}
                  </td>
                  <td className="py-3 px-4">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium",
                      statusColors[booking.status]
                    )}>
                      {booking.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">
                    {booking.communicationMethod}
                  </td>
                  <td className="py-3 px-4">
                    {canEditBooking(booking.agentId) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => navigate(`/edit-booking/${booking.id}`)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-border flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing 1-20 of {bookings.length} bookings
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>Previous</Button>
            <Button variant="outline" size="sm">Next</Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
