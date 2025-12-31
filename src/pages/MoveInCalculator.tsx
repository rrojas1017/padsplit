import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { MoveInCalculatorForm } from '@/components/calculator/MoveInCalculatorForm';
import { Calculator, Sparkles } from 'lucide-react';

export default function MoveInCalculator() {
  return (
    <DashboardLayout title="Move-In Calculator" subtitle="Calculate and explain move-in costs for members">
      <div className="space-y-6">
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/15 via-primary/10 to-transparent border border-primary/20 p-6 md:p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Calculator className="w-6 h-6 text-primary" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Move-In Cost Calculator
              </h1>
              <p className="text-muted-foreground max-w-2xl">
                Help members understand their move-in costs with a clear, itemized breakdown. 
                Apply promo codes and show exact savings instantly.
              </p>
              <div className="flex items-center gap-2 text-sm text-primary">
                <Sparkles className="w-4 h-4" />
                <span>Real-time promo code validation</span>
              </div>
            </div>
          </div>
        </div>

        {/* Calculator Form */}
        <MoveInCalculatorForm />
      </div>
    </DashboardLayout>
  );
}
