import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, ArrowRight, CreditCard } from 'lucide-react';
import { format, addDays, addWeeks } from 'date-fns';

interface PaymentSchedulePreviewProps {
  weeklyRent: number;
  paymentFrequency: 'weekly' | 'biweekly';
  firstRentDueDate: Date;
}

export function PaymentSchedulePreview({
  weeklyRent,
  paymentFrequency,
  firstRentDueDate,
}: PaymentSchedulePreviewProps) {
  const paymentAmount = paymentFrequency === 'weekly' ? weeklyRent : weeklyRent * 2;
  const frequencyLabel = paymentFrequency === 'weekly' ? 'week' : '2 weeks';
  
  // Generate next 4 payment dates
  const paymentDates = Array.from({ length: 4 }, (_, i) => {
    const weeksToAdd = paymentFrequency === 'weekly' ? i : i * 2;
    return addWeeks(firstRentDueDate, weeksToAdd);
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="w-5 h-5 text-primary" />
          Ongoing Payment Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Payment summary */}
        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground mb-1">Starting {format(firstRentDueDate, 'MMM d, yyyy')}</p>
          <p className="text-2xl font-bold text-primary">
            ${paymentAmount.toFixed(2)}
            <span className="text-sm font-normal text-muted-foreground ml-1">/ {frequencyLabel}</span>
          </p>
        </div>

        {/* Upcoming payments */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Upcoming Payments</p>
          <div className="space-y-2">
            {paymentDates.map((date, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg bg-background border transition-all hover:border-primary/30"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{format(date, 'EEEE, MMM d')}</p>
                    <p className="text-xs text-muted-foreground">
                      {index === 0 ? 'First payment' : `Payment ${index + 1}`}
                    </p>
                  </div>
                </div>
                <span className="font-semibold">${paymentAmount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly estimate */}
        <div className="border-t pt-4 mt-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Estimated Monthly Cost</span>
            <span className="font-semibold">
              ~${(weeklyRent * 4.33).toFixed(2)}/month
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
