import { useState, useMemo } from 'react';
import { ResearchLayout } from '@/components/layout/ResearchLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useResearchCalls } from '@/hooks/useResearchCalls';
import { format, isToday, parseISO } from 'date-fns';
import { Phone, ChevronDown, History } from 'lucide-react';

const outcomeColors: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  completed: 'default',
  no_answer: 'secondary',
  refused: 'destructive',
  callback_requested: 'outline',
  transferred: 'secondary',
};

export default function MyCallHistory() {
  const { myCalls, myCampaigns, isLoading } = useResearchCalls();
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = myCalls;
    if (campaignFilter !== 'all') result = result.filter(c => c.campaign_id === campaignFilter);
    if (outcomeFilter !== 'all') result = result.filter(c => c.call_outcome === outcomeFilter);
    return result;
  }, [myCalls, campaignFilter, outcomeFilter]);

  const todayCount = useMemo(
    () => myCalls.filter(c => isToday(parseISO(c.created_at))).length,
    [myCalls]
  );

  const uniqueCampaigns = useMemo(() => {
    const map = new Map<string, string>();
    myCalls.forEach(c => map.set(c.campaign_id, c.campaign_name || 'Unknown'));
    return Array.from(map.entries());
  }, [myCalls]);

  return (
    <ResearchLayout title="Call History" subtitle="Your past survey calls">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Phone className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{myCalls.length}</p>
              <p className="text-sm text-muted-foreground">Total Calls</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <History className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{todayCount}</p>
              <p className="text-sm text-muted-foreground">Today</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <Select value={campaignFilter} onValueChange={setCampaignFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Campaigns" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Campaigns</SelectItem>
            {uniqueCampaigns.map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Outcomes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Outcomes</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="no_answer">No Answer</SelectItem>
            <SelectItem value="refused">Refused</SelectItem>
            <SelectItem value="callback_requested">Callback</SelectItem>
            <SelectItem value="transferred">Transferred</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No calls found</h3>
            <p className="text-muted-foreground text-sm">
              {myCalls.length === 0 ? 'Start by selecting a campaign and logging your first survey call.' : 'No calls match your filters.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Caller</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(call => (
                <Collapsible key={call.id} open={expandedId === call.id} onOpenChange={(open) => setExpandedId(open ? call.id : null)} asChild>
                  <>
                    <CollapsibleTrigger asChild>
                      <TableRow className="cursor-pointer">
                        <TableCell className="text-sm">{format(parseISO(call.created_at), 'MMM d, h:mm a')}</TableCell>
                        <TableCell className="text-sm">{call.campaign_name}</TableCell>
                        <TableCell className="font-medium text-sm">{call.caller_name}</TableCell>
                        <TableCell className="text-sm capitalize">{call.caller_type.replace('_', ' ')}</TableCell>
                        <TableCell>
                          <Badge variant={outcomeColors[call.call_outcome] || 'secondary'}>
                            {call.call_outcome.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {call.call_duration_seconds ? `${Math.round(call.call_duration_seconds / 60)}m` : '–'}
                        </TableCell>
                        <TableCell><ChevronDown className="h-4 w-4 text-muted-foreground" /></TableCell>
                      </TableRow>
                    </CollapsibleTrigger>
                    <CollapsibleContent asChild>
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30">
                          <div className="p-3 space-y-3">
                            {call.responses && Object.keys(call.responses).length > 0 && (
                              <div>
                                <p className="text-sm font-medium mb-1">Responses</p>
                                <div className="space-y-1">
                                  {Object.entries(call.responses).map(([key, val]) => (
                                    <p key={key} className="text-sm text-muted-foreground">
                                      Q{key}: <span className="text-foreground">{String(val)}</span>
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}
                            {call.researcher_notes && (
                              <div>
                                <p className="text-sm font-medium mb-1">Notes</p>
                                <p className="text-sm text-muted-foreground">{call.researcher_notes}</p>
                              </div>
                            )}
                            {call.transfer_notes && (
                              <div>
                                <p className="text-sm font-medium mb-1">Transfer Notes</p>
                                <p className="text-sm text-muted-foreground">{call.transfer_notes}</p>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </ResearchLayout>
  );
}
