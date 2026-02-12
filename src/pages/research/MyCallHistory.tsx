import { ResearchLayout } from '@/components/layout/ResearchLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function MyCallHistory() {
  return (
    <ResearchLayout title="Call History" subtitle="Your past survey calls">
      <Card>
        <CardHeader>
          <CardTitle>Survey Call History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No calls logged yet. Start by selecting a campaign and logging your first survey call.</p>
        </CardContent>
      </Card>
    </ResearchLayout>
  );
}
