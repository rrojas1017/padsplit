import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, CreditCard, Home, CheckCircle2 } from 'lucide-react';
import { format, addWeeks } from 'date-fns';
import { cn } from '@/lib/utils';

interface PaymentSchedulePreviewProps {
  weeklyRent: number;
  paymentFrequency: 'weekly' | 'biweekly';
  moveInDate: Date;
  firstRentDueDate: Date;
  totalDueToday: number;
}

interface TimelineMilestoneProps {
  type: 'today' | 'moveIn' | 'firstRent' | 'payment';
  date: Date;
  title: string;
  description: string;
  amount?: number;
  isLast?: boolean;
  delay?: number;
}

function TimelineMilestone({ 
  type, 
  date, 
  title, 
  description, 
  amount, 
  isLast = false,
  delay = 0 
}: TimelineMilestoneProps) {
  const dotColors = {
    today: 'bg-green-500',
    moveIn: 'bg-amber-500',
    firstRent: 'bg-primary',
    payment: 'bg-muted-foreground/50',
  };

  const iconColors = {
    today: 'text-green-500',
    moveIn: 'text-amber-500',
    firstRent: 'text-primary',
    payment: 'text-muted-foreground',
  };

  const icons = {
    today: CheckCircle2,
    moveIn: Home,
    firstRent: CreditCard,
    payment: CreditCard,
  };

  const Icon = icons[type];
  const isHighlighted = type !== 'payment';

  return (
    <div 
      className="relative flex gap-4 animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Timeline line and dot */}
      <div className="flex flex-col items-center">
        <div className={cn(
          "w-3 h-3 rounded-full ring-4 ring-background z-10 shrink-0",
          dotColors[type]
        )} />
        {!isLast && (
          <div className="w-0.5 h-full bg-border flex-1 min-h-[40px]" />
        )}
      </div>

      {/* Content */}
      <div className={cn(
        "pb-6 flex-1",
        isLast && "pb-0"
      )}>
        <div className={cn(
          "rounded-lg p-3 transition-all",
          isHighlighted ? "bg-muted/50 border" : "bg-transparent"
        )}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Icon className={cn("w-4 h-4 shrink-0", iconColors[type])} />
              <div>
                <p className={cn(
                  "font-medium text-sm",
                  isHighlighted ? "text-foreground" : "text-muted-foreground"
                )}>
                  {title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(date, 'EEEE, MMM d, yyyy')}
                </p>
              </div>
            </div>
            {amount !== undefined && (
              <span className={cn(
                "font-semibold text-sm shrink-0",
                isHighlighted ? "text-foreground" : "text-muted-foreground"
              )}>
                ${amount.toFixed(2)}
              </span>
            )}
          </div>
          {isHighlighted && (
            <p className="text-xs text-muted-foreground mt-1.5 ml-6">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function PaymentSchedulePreview({
  weeklyRent,
  paymentFrequency,
  moveInDate,
  firstRentDueDate,
  totalDueToday,
}: PaymentSchedulePreviewProps) {
  const paymentAmount = paymentFrequency === 'weekly' ? weeklyRent : weeklyRent * 2;
  const frequencyLabel = paymentFrequency === 'weekly' ? 'week' : '2 weeks';
  
  // Generate next 3 payment dates after first rent
  const upcomingPayments = Array.from({ length: 3 }, (_, i) => {
    const weeksToAdd = paymentFrequency === 'weekly' ? i + 1 : (i + 1) * 2;
    return addWeeks(firstRentDueDate, weeksToAdd);
  });

  const milestones: TimelineMilestoneProps[] = [
    {
      type: 'today',
      date: new Date(),
      title: 'Today\'s Payment',
      description: 'First week rent + fees (minus any promo discount)',
      amount: totalDueToday,
    },
    {
      type: 'moveIn',
      date: moveInDate,
      title: 'Move-In Day',
      description: 'Your keys will be ready. Welcome to your new home!',
    },
    {
      type: 'firstRent',
      date: firstRentDueDate,
      title: 'First Rent Payment',
      description: `Regular ${paymentFrequency} payments begin`,
      amount: paymentAmount,
    },
    ...upcomingPayments.map((date, i) => ({
      type: 'payment' as const,
      date,
      title: `Payment ${i + 2}`,
      description: '',
      amount: paymentAmount,
    })),
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="w-5 h-5 text-primary" />
          Your Move-In Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Timeline */}
        <div className="relative">
          {milestones.map((milestone, index) => (
            <TimelineMilestone
              key={`${milestone.type}-${index}`}
              {...milestone}
              isLast={index === milestones.length - 1}
              delay={index * 75}
            />
          ))}
        </div>

        {/* Monthly estimate footer */}
        <div className="border-t pt-4 mt-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Estimated Monthly Cost</span>
            <span className="font-semibold">
              ~${(weeklyRent * 4.33).toFixed(2)}/month
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Based on ${paymentAmount.toFixed(2)} every {frequencyLabel}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
