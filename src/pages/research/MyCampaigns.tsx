import { ResearchLayout } from '@/components/layout/ResearchLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useResearchCalls } from '@/hooks/useResearchCalls';
import { useNavigate } from 'react-router-dom';
import { Phone, Calendar, Target, Users } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  active: { label: 'Active', variant: 'default' },
  paused: { label: 'Paused', variant: 'outline' },
  completed: { label: 'Completed', variant: 'destructive' },
};

export default function MyCampaigns() {
  const { myCampaigns, isLoading } = useResearchCalls();
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);

  const filtered = showAll ? myCampaigns : myCampaigns.filter(c => c.status === 'active');

  return (
    <ResearchLayout title="My Campaigns" subtitle="Campaigns assigned to you">
      <div className="flex items-center justify-between mb-4">
        <Button variant={showAll ? 'outline' : 'default'} size="sm" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show Active Only' : 'Show All'}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3].map(i => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No campaigns {showAll ? 'found' : 'active'}</h3>
            <p className="text-muted-foreground text-sm">
              {showAll ? 'No campaigns have been assigned to you yet.' : 'No active campaigns right now. Toggle "Show All" to see past campaigns.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map(campaign => {
            const progress = campaign.target_count > 0
              ? Math.round((campaign.completed_calls / campaign.target_count) * 100)
              : 0;
            const cfg = statusConfig[campaign.status] || statusConfig.draft;

            return (
              <Card key={campaign.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{campaign.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Script: {campaign.script?.name || 'Unknown'}
                      </p>
                    </div>
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Target className="h-3.5 w-3.5" /> Progress
                      </span>
                      <span className="font-medium">{campaign.completed_calls} / {campaign.target_count}</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>

                  {(campaign.start_date || campaign.end_date) && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {campaign.start_date && format(new Date(campaign.start_date), 'MMM d')}
                      {campaign.start_date && campaign.end_date && ' – '}
                      {campaign.end_date && format(new Date(campaign.end_date), 'MMM d, yyyy')}
                    </div>
                  )}

                  {campaign.status === 'active' && (
                    <Button
                      className="w-full"
                      onClick={() => navigate(`/research/log-call?campaign=${campaign.id}`)}
                    >
                      <Phone className="h-4 w-4 mr-2" /> Start Calling
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </ResearchLayout>
  );
}
