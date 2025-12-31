import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon, DollarSign, Home, Truck, MapPin } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { PromoCodeInput } from './PromoCodeInput';
import { CostBreakdownCard } from './CostBreakdownCard';
import { PaymentSchedulePreview } from './PaymentSchedulePreview';
import { PromoCodeValidation } from '@/hooks/usePromoCodes';

export function MoveInCalculatorForm() {
  const [weeklyRent, setWeeklyRent] = useState<number>(297);
  const [movingFee, setMovingFee] = useState<number>(0);
  const [paymentFrequency, setPaymentFrequency] = useState<'weekly' | 'biweekly'>('weekly');
  const [moveInDate, setMoveInDate] = useState<Date>(addDays(new Date(), 3));
  const [firstRentDueDate, setFirstRentDueDate] = useState<Date>(addDays(new Date(), 7));
  const [promoValidation, setPromoValidation] = useState<PromoCodeValidation>({
    isValid: false,
    code: null,
    error: null,
    savings: null,
  });

  const promoDiscount = promoValidation.savings || 0;
  const totalDueToday = Math.max(0, weeklyRent - promoDiscount + movingFee);

  const handleWeeklyRentChange = (value: string) => {
    const num = parseFloat(value) || 0;
    setWeeklyRent(Math.max(0, num));
  };

  const handleMovingFeeChange = (value: string) => {
    const num = parseFloat(value) || 0;
    setMovingFee(Math.max(0, num));
  };

  const handleMoveInDateChange = (date: Date | undefined) => {
    if (!date) return;
    setMoveInDate(date);
    // Auto-adjust first rent due date if move-in date is after it
    if (date > firstRentDueDate) {
      setFirstRentDueDate(addDays(date, 4));
    }
  };

  const handleFirstRentDueDateChange = (date: Date | undefined) => {
    if (!date) return;
    setFirstRentDueDate(date);
    // Auto-adjust move-in date if it's after the new first rent due date
    if (moveInDate > date) {
      setMoveInDate(addDays(date, -4));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left column - Inputs */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="w-5 h-5 text-primary" />
              Room Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Weekly Rent */}
            <div className="space-y-2">
              <Label htmlFor="weekly-rent" className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Weekly Rent
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="weekly-rent"
                  type="number"
                  value={weeklyRent}
                  onChange={(e) => handleWeeklyRentChange(e.target.value)}
                  className="pl-7 text-lg font-semibold"
                  min={0}
                  step={0.01}
                />
              </div>
            </div>

            {/* Moving Fee */}
            <div className="space-y-2">
              <Label htmlFor="moving-fee" className="text-sm font-medium flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Moving Fee
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="moving-fee"
                  type="number"
                  value={movingFee}
                  onChange={(e) => handleMovingFeeChange(e.target.value)}
                  className="pl-7"
                  min={0}
                  step={0.01}
                />
              </div>
            </div>

            {/* Promo Code */}
            <PromoCodeInput
              weeklyRent={weeklyRent}
              onValidation={setPromoValidation}
            />

            {/* Payment Frequency */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Payment Frequency</Label>
              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <span className={cn(
                  "text-sm transition-colors",
                  paymentFrequency === 'weekly' ? "font-medium text-primary" : "text-muted-foreground"
                )}>
                  Weekly
                </span>
                <Switch
                  checked={paymentFrequency === 'biweekly'}
                  onCheckedChange={(checked) => setPaymentFrequency(checked ? 'biweekly' : 'weekly')}
                />
                <span className={cn(
                  "text-sm transition-colors",
                  paymentFrequency === 'biweekly' ? "font-medium text-primary" : "text-muted-foreground"
                )}>
                  Bi-weekly
                </span>
              </div>
            </div>

            {/* Move-In Date */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Move-In Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(moveInDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={moveInDate}
                    onSelect={handleMoveInDateChange}
                    initialFocus
                    disabled={(date) => date < new Date()}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* First Rent Due Date */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                First Rent Due Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(firstRentDueDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={firstRentDueDate}
                    onSelect={handleFirstRentDueDateChange}
                    initialFocus
                    disabled={(date) => date < new Date()}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right column - Results */}
      <div className="space-y-6">
        <CostBreakdownCard
          weeklyRent={weeklyRent}
          movingFee={movingFee}
          promoDiscount={promoDiscount}
          promoCode={promoValidation.code?.code || null}
          totalDueToday={totalDueToday}
        />

        <PaymentSchedulePreview
          weeklyRent={weeklyRent}
          paymentFrequency={paymentFrequency}
          moveInDate={moveInDate}
          firstRentDueDate={firstRentDueDate}
          totalDueToday={totalDueToday}
        />
      </div>
    </div>
  );
}
