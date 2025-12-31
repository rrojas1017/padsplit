import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Copy, Check, DollarSign, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CostBreakdownCardProps {
  weeklyRent: number;
  movingFee: number;
  promoDiscount: number;
  promoCode: string | null;
  totalDueToday: number;
}

export function CostBreakdownCard({
  weeklyRent,
  movingFee,
  promoDiscount,
  promoCode,
  totalDueToday,
}: CostBreakdownCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const breakdown = `
Move-In Cost Breakdown
━━━━━━━━━━━━━━━━━━━━━━
Weekly Rent: $${weeklyRent.toFixed(2)}
${promoCode ? `Promo (${promoCode}): -$${promoDiscount.toFixed(2)}` : ''}
Moving Fee: $${movingFee.toFixed(2)}
━━━━━━━━━━━━━━━━━━━━━━
TOTAL DUE TODAY: $${totalDueToday.toFixed(2)}
${promoDiscount > 0 ? `\n💰 YOU SAVE: $${promoDiscount.toFixed(2)}` : ''}
    `.trim();

    navigator.clipboard.writeText(breakdown);
    setCopied(true);
    toast.success('Cost breakdown copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="overflow-hidden border-2 border-primary/20 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent pb-4">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Cost Breakdown
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-2"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy
              </>
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Line items */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Weekly Rent</span>
            <span className="font-medium">${weeklyRent.toFixed(2)}</span>
          </div>

          {promoDiscount > 0 && (
            <div className="flex justify-between items-center text-green-600 dark:text-green-400 animate-in fade-in slide-in-from-right-2">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Promo ({promoCode})
              </span>
              <span className="font-medium">-${promoDiscount.toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Moving Fee</span>
            <span className="font-medium">${movingFee.toFixed(2)}</span>
          </div>
        </div>

        <Separator />

        {/* Total */}
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold">Total Due Today</span>
          <span className={cn(
            "text-2xl font-bold transition-all duration-300",
            promoDiscount > 0 && "text-primary"
          )}>
            ${totalDueToday.toFixed(2)}
          </span>
        </div>

        {/* Savings highlight */}
        {promoDiscount > 0 && (
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center animate-in fade-in zoom-in-95">
            <p className="text-green-700 dark:text-green-300 font-medium">
              💰 YOU SAVE: <span className="text-xl font-bold">${promoDiscount.toFixed(2)}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
