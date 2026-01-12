import { Call } from '@/pages/CallInsights';
import { Agent } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  PhoneIncoming, PhoneOutgoing, PhoneMissed, 
  CheckCircle, Clock, XCircle, Link2, Eye
} from 'lucide-react';
import { format } from 'date-fns';

interface CallsTableProps {
  calls: Call[];
  agents: Agent[];
  onSelectCall: (call: Call) => void;
}

export function CallsTable({ calls, agents, onSelectCall }: CallsTableProps) {
  const getAgentName = (agentId: string | null) => {
    if (!agentId) return 'Unknown';
    const agent = agents.find(a => a.id === agentId);
    return agent?.name || 'Unknown';
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCallTypeIcon = (callType: string, status: string) => {
    if (status === 'missed' || status === 'voicemail') {
      return <PhoneMissed className="h-4 w-4 text-destructive" />;
    }
    return callType === 'incoming' 
      ? <PhoneIncoming className="h-4 w-4 text-green-500" />
      : <PhoneOutgoing className="h-4 w-4 text-blue-500" />;
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Transcribed</Badge>;
      case 'processing':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  if (calls.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <PhoneMissed className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No calls found matching your filters</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Type</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Disposition</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Booking</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {calls.map(call => (
              <TableRow key={call.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelectCall(call)}>
                <TableCell>
                  {getCallTypeIcon(call.call_type, call.call_status)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{format(new Date(call.call_date), 'MMM d, yyyy')}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(call.call_date), 'h:mm a')}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-medium">{call.kixie_agent_name || getAgentName(call.agent_id)}</span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{call.contact_name || '--'}</span>
                    <span className="text-xs text-muted-foreground">{call.contact_phone || '--'}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-mono">{formatDuration(call.duration_seconds)}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{call.disposition || '--'}</span>
                </TableCell>
                <TableCell>
                  {getStatusBadge(call.transcription_status)}
                </TableCell>
                <TableCell>
                  {call.booking_id ? (
                    <Badge variant="outline" className="gap-1">
                      <Link2 className="h-3 w-3" />
                      Linked
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">--</span>
                  )}
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onSelectCall(call); }}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
