import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ScriptBuilder() {
  return (
    <DashboardLayout title="Script Builder" subtitle="Create questionnaires for research campaigns">
      <Card>
        <CardHeader>
          <CardTitle>Research Scripts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Create and manage structured questionnaires that guide researchers during calls. Scripts define the questions, answer types, and AI extraction hints.</p>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
