import { Call } from '@/pages/CallInsights';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, PhoneIncoming, PhoneOutgoing, CheckCircle, XCircle, Clock, Link2 } from 'lucide-react';

interface CallInsightsStatsProps {
  calls: Call[];
}

export function CallInsightsStats({ calls }: CallInsightsStatsProps) {
  const totalCalls = calls.length;
  const incomingCalls = calls.filter(c => c.call_type === 'incoming').length;
  const outgoingCalls = calls.filter(c => c.call_type === 'outgoing').length;
  const transcribedCalls = calls.filter(c => c.transcription_status === 'completed').length;
  const withBooking = calls.filter(c => c.booking_id).length;
  const noBooking = calls.filter(c => !c.booking_id).length;
  
  const avgDuration = calls.filter(c => c.duration_seconds).length > 0
    ? calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / calls.filter(c => c.duration_seconds).length
    : 0;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const stats = [
    {
      title: 'Total Calls',
      value: totalCalls,
      icon: Phone,
      description: `${incomingCalls} incoming, ${outgoingCalls} outgoing`,
    },
    {
      title: 'Transcribed',
      value: transcribedCalls,
      icon: CheckCircle,
      description: `${totalCalls > 0 ? Math.round((transcribedCalls / totalCalls) * 100) : 0}% of total`,
      color: 'text-green-500',
    },
    {
      title: 'With Booking',
      value: withBooking,
      icon: Link2,
      description: `${totalCalls > 0 ? Math.round((withBooking / totalCalls) * 100) : 0}% conversion`,
      color: 'text-primary',
    },
    {
      title: 'No Booking',
      value: noBooking,
      icon: XCircle,
      description: 'Opportunities for coaching',
      color: 'text-orange-500',
    },
    {
      title: 'Avg Duration',
      value: formatDuration(avgDuration),
      icon: Clock,
      description: 'Average call length',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-5">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.color || 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
