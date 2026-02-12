import { ResearchLayout } from '@/components/layout/ResearchLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LogSurveyCall() {
  return (
    <ResearchLayout title="Log Survey Call" subtitle="Record a new research interview">
      <Card>
        <CardHeader>
          <CardTitle>Survey Call Form</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Select an active campaign to begin logging a survey call. The questionnaire will load based on the campaign's script.</p>
        </CardContent>
      </Card>
    </ResearchLayout>
  );
}
