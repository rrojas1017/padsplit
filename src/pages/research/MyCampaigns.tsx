import { ResearchLayout } from '@/components/layout/ResearchLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function MyCampaigns() {
  return (
    <ResearchLayout title="Active Campaigns" subtitle="Campaigns assigned to you">
      <Card>
        <CardHeader>
          <CardTitle>My Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No campaigns assigned yet. When your admin creates and assigns a campaign, it will appear here.</p>
        </CardContent>
      </Card>
    </ResearchLayout>
  );
}
