import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, X, Loader2, Tag } from 'lucide-react';
import { useValidatePromoCode, useActivePromoCodes, PromoCodeValidation } from '@/hooks/usePromoCodes';
import { cn } from '@/lib/utils';

interface PromoCodeInputProps {
  weeklyRent: number;
  onValidation: (validation: PromoCodeValidation) => void;
}

function formatDiscount(code: { discount_amount: number; discount_type: string }) {
  if (code.discount_type === 'percentage') {
    return `${code.discount_amount}% off`;
  }
  return `$${code.discount_amount} off`;
}

export function PromoCodeInput({ weeklyRent, onValidation }: PromoCodeInputProps) {
  const [code, setCode] = useState('');
  const [debouncedCode, setDebouncedCode] = useState('');
  const validateMutation = useValidatePromoCode();
  const { data: activeCodes, isLoading: activeCodesLoading } = useActivePromoCodes();

  // Debounce the code input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCode(code);
    }, 300);
    return () => clearTimeout(timer);
  }, [code]);

  // Validate when debounced code changes
  useEffect(() => {
    if (debouncedCode || code === '') {
      validateMutation.mutate(
        { code: debouncedCode, weeklyRent },
        {
          onSuccess: (validation) => {
            onValidation(validation);
          },
        }
      );
    }
  }, [debouncedCode, weeklyRent]);

  const validation = validateMutation.data;
  const isLoading = validateMutation.isPending;

  const handleCodeClick = (selectedCode: string) => {
    setCode(selectedCode);
    setDebouncedCode(selectedCode);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="promo-code" className="text-sm font-medium flex items-center gap-2">
        <Tag className="w-4 h-4" />
        Promo Code
      </Label>
      
      {/* Available promo codes */}
      {activeCodesLoading ? (
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-24" />
        </div>
      ) : activeCodes && activeCodes.length > 0 ? (
        <div className="flex flex-wrap gap-2 animate-in fade-in">
          {activeCodes.map((promoCode) => (
            <Badge
              key={promoCode.code}
              variant="outline"
              className={cn(
                "cursor-pointer transition-colors",
                "hover:bg-primary hover:text-primary-foreground",
                code === promoCode.code && "bg-primary text-primary-foreground"
              )}
              onClick={() => handleCodeClick(promoCode.code)}
            >
              {promoCode.code} - {formatDiscount(promoCode)}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No promo codes available</p>
      )}

      <div className="relative">
        <Input
          id="promo-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter promo code"
          className={cn(
            "pr-10 font-mono uppercase tracking-wider",
            validation?.isValid && "border-green-500 focus-visible:ring-green-500",
            validation?.error && "border-destructive focus-visible:ring-destructive"
          )}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading && (
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          )}
          {!isLoading && validation?.isValid && (
            <Check className="w-4 h-4 text-green-500" />
          )}
          {!isLoading && validation?.error && (
            <X className="w-4 h-4 text-destructive" />
          )}
        </div>
      </div>
      {validation?.isValid && validation.savings && (
        <p className="text-sm text-green-600 dark:text-green-400 font-medium animate-in fade-in slide-in-from-top-1">
          ✓ Code applied! You save ${validation.savings.toFixed(2)}
        </p>
      )}
      {validation?.error && (
        <p className="text-sm text-destructive animate-in fade-in slide-in-from-top-1">
          {validation.error}
        </p>
      )}
    </div>
  );
}
