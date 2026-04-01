import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ContentPreferencesData } from '@/types/research-insights';
import { RankedItemsTable } from './RankedItemsTable';

interface Props {
  data: ContentPreferencesData;
}

export function AdPreferencesPanel({ data }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">What Makes Them Stop Scrolling</CardTitle>
        </CardHeader>
        <CardContent>
          <RankedItemsTable
            items={(data.stop_scrolling_triggers || []).map(i => ({ label: i.trigger, count: i.count }))}
          />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">What Makes Them Click an Ad</CardTitle>
        </CardHeader>
        <CardContent>
          <RankedItemsTable
            items={(data.click_motivations || []).map(i => ({ label: i.motivation, count: i.count }))}
          />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Detail Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <RankedItemsTable
            items={(data.detail_preferences || []).map(i => ({ label: i.detail, count: i.count, pct: i.pct }))}
          />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Preferred Content Types</CardTitle>
        </CardHeader>
        <CardContent>
          <RankedItemsTable
            items={(data.content_type_preferences || []).map(i => ({ label: i.type.replace(/_/g, ' '), count: i.count, pct: i.pct }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
