import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ResearchInsights() {
  return (
    <DashboardLayout title="Research Insights" subtitle="AI-processed findings from research campaigns">
      <Card>
        <CardHeader>
          <CardTitle>Research Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">View AI-aggregated insights from completed research calls. Insights are grouped by campaign, caller type, and theme for actionable decision-making.</p>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
