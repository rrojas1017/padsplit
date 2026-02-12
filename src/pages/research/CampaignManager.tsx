import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function CampaignManager() {
  return (
    <DashboardLayout title="Campaign Manager" subtitle="Manage research campaigns and assign researchers">
      <Card>
        <CardHeader>
          <CardTitle>Research Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Create campaigns, assign scripts and researchers, set targets, and track progress. Campaigns organize your research efforts into structured initiatives.</p>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
