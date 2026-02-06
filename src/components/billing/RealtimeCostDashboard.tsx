import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useRealtimeCostMonitor } from '@/hooks/useRealtimeCostMonitor';
import { formatCurrency } from '@/utils/billingCalculations';
import { formatDistanceToNow } from 'date-fns';
import { Activity, AlertTriangle, AlertCircle, Volume2, Mic, Brain, DollarSign } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const LiveIndicator = ({ isLive }: { isLive: boolean }) => (
  <div className="flex items-center gap-2">
    <span
      className={`h-2 w-2 rounded-full ${
        isLive ? 'bg-green-500 animate-pulse' : 'bg-muted'
      }`}
    />
    <span className="text-xs text-muted-foreground">
      {isLive ? 'LIVE' : 'Connecting...'}
    </span>
  </div>
);

interface CostCardProps {
  title: string;
  value: number;
  percentage: number;
  icon: React.ReactNode;
  color: string;
  isAlert?: boolean;
}

const CostCard = ({ title, value, percentage, icon, color, isAlert }: CostCardProps) => (
  <Card className={isAlert ? 'border-destructive' : ''}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <div className={color}>{icon}</div>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{formatCurrency(value)}</div>
      <p className="text-xs text-muted-foreground">
        {percentage.toFixed(1)}% of total spend
      </p>
    </CardContent>
  </Card>
);

const SERVICE_TYPE_COLORS: Record<string, string> = {
  tts_coaching: 'bg-red-500',
  tts_qa_coaching: 'bg-red-400',
  stt_transcription: 'bg-blue-500',
  ai_analysis: 'bg-purple-500',
  ai_coaching: 'bg-purple-400',
  ai_qa_scoring: 'bg-purple-300',
  ai_member_insights: 'bg-purple-600',
  transcript_polishing: 'bg-indigo-400',
  speaker_identification: 'bg-indigo-500',
};

const RealtimeCostDashboard = () => {
  const data = useRealtimeCostMonitor();

  if (data.isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (data.error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{data.error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Live Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">Live Cost Monitor</h3>
          <LiveIndicator isLive={data.isLive} />
        </div>
        <span className="text-xs text-muted-foreground">
          Last updated: {formatDistanceToNow(data.lastUpdated, { addSuffix: true })}
        </span>
      </div>

      {/* Alert Banner */}
      {data.alertLevel !== 'normal' && (
        <Alert variant={data.alertLevel === 'critical' ? 'destructive' : 'default'}>
          {data.alertLevel === 'critical' ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          <AlertTitle>
            {data.alertLevel === 'critical' ? 'Critical Alert' : 'Warning'}
          </AlertTitle>
          <AlertDescription>{data.alertMessage}</AlertDescription>
        </Alert>
      )}

      {/* Cost Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <CostCard
          title="TTS Spend (Last Hour)"
          value={data.lastHourTTS}
          percentage={data.ttsPercentage}
          icon={<Volume2 className="h-4 w-4" />}
          color="text-red-500"
          isAlert={data.alertLevel !== 'normal'}
        />
        <CostCard
          title="STT Spend (Last Hour)"
          value={data.lastHourSTT}
          percentage={data.sttPercentage}
          icon={<Mic className="h-4 w-4" />}
          color="text-blue-500"
        />
        <CostCard
          title="AI Spend (Last Hour)"
          value={data.lastHourAI}
          percentage={data.aiPercentage}
          icon={<Brain className="h-4 w-4" />}
          color="text-purple-500"
        />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total (Last Hour)</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.lastHourTotal)}</div>
            <p className="text-xs text-muted-foreground">
              ~{formatCurrency(data.costPerMinute)}/min
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            60-Minute Cost Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.minuteTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="minute"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(value) => `$${value.toFixed(3)}`}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(value: number) => [`$${value.toFixed(4)}`, '']}
                  labelFormatter={(label) => `Time: ${label}`}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="tts"
                  name="TTS"
                  stackId="1"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="stt"
                  name="STT"
                  stackId="1"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="ai"
                  name="AI"
                  stackId="1"
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {data.recentCosts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No costs recorded in the last hour
              </p>
            ) : (
              data.recentCosts.map((cost) => (
                <div
                  key={cost.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        SERVICE_TYPE_COLORS[cost.service_type] || 'bg-gray-400'
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium">{cost.service_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {cost.edge_function}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {formatCurrency(cost.estimated_cost_usd)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(cost.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RealtimeCostDashboard;
