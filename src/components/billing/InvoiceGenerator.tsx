import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { FileText, CalendarIcon, Download } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subDays } from 'date-fns';
import { Client, ApiCost, DateRangeType } from '@/hooks/useBillingData';
import { formatCurrency, SERVICE_TYPE_LABELS } from '@/utils/billingCalculations';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface InvoiceGeneratorProps {
  clients: Client[];
  costs: ApiCost[];
  onGenerate: (invoice: {
    client_id: string;
    period_start: string;
    period_end: string;
    raw_cost_usd: number;
    markup_usd: number;
    total_usd: number;
    cost_breakdown: Record<string, any>;
    notes?: string;
  }) => Promise<any>;
  dateRange: DateRangeType;
}

const InvoiceGenerator = ({ clients, costs, onGenerate, dateRange }: InvoiceGeneratorProps) => {
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [periodStart, setPeriodStart] = useState<Date>(startOfMonth(new Date()));
  const [periodEnd, setPeriodEnd] = useState<Date>(endOfMonth(new Date()));
  const [notes, setNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedClient = clients.find(c => c.id === selectedClientId);

  // Calculate costs for the selected period
  const periodCosts = useMemo(() => {
    return costs.filter(cost => {
      const costDate = new Date(cost.created_at);
      return costDate >= periodStart && costDate <= periodEnd;
    });
  }, [costs, periodStart, periodEnd]);

  // Calculate breakdown
  const breakdown = useMemo(() => {
    const byService: Record<string, { count: number; cost: number }> = {};
    let total = 0;

    periodCosts.forEach(cost => {
      const type = cost.service_type;
      if (!byService[type]) {
        byService[type] = { count: 0, cost: 0 };
      }
      byService[type].count++;
      byService[type].cost += Number(cost.estimated_cost_usd);
      total += Number(cost.estimated_cost_usd);
    });

    return { byService, total };
  }, [periodCosts]);

  const markupAmount = selectedClient 
    ? (breakdown.total * selectedClient.markup_percentage) / 100 
    : 0;
  const totalWithMarkup = breakdown.total + markupAmount;

  const handleGenerate = async () => {
    if (!selectedClientId) {
      toast.error('Please select a client');
      return;
    }

    setIsGenerating(true);
    try {
      await onGenerate({
        client_id: selectedClientId,
        period_start: format(periodStart, 'yyyy-MM-dd'),
        period_end: format(periodEnd, 'yyyy-MM-dd'),
        raw_cost_usd: breakdown.total,
        markup_usd: markupAmount,
        total_usd: totalWithMarkup,
        cost_breakdown: {
          byService: breakdown.byService,
          totalCalls: periodCosts.length,
        },
        notes: notes || undefined,
      });
      toast.success('Invoice generated successfully');
      setNotes('');
    } catch (error) {
      toast.error('Failed to generate invoice');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Generate Invoice
        </CardTitle>
        <CardDescription>
          Create a new invoice for a client
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Client Selection */}
        <div className="space-y-2">
          <Label>Client *</Label>
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger>
              <SelectValue placeholder="Select client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map(client => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name} ({client.markup_percentage}% markup)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Period Start</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(periodStart, 'MMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={periodStart}
                  onSelect={(date) => date && setPeriodStart(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label>Period End</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(periodEnd, 'MMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={periodEnd}
                  onSelect={(date) => date && setPeriodEnd(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label>Notes (optional)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes for this invoice..."
            rows={2}
          />
        </div>

        <Separator />

        {/* Invoice Preview */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <h4 className="font-medium">Invoice Preview</h4>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">API Calls:</span>
              <span>{periodCosts.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Raw Cost:</span>
              <span>{formatCurrency(breakdown.total)}</span>
            </div>
            {selectedClient && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Markup ({selectedClient.markup_percentage}%):
                </span>
                <span>{formatCurrency(markupAmount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-medium text-base">
              <span>Total:</span>
              <span className="text-primary">{formatCurrency(totalWithMarkup)}</span>
            </div>
          </div>

          {/* Service Breakdown */}
          {Object.keys(breakdown.byService).length > 0 && (
            <div className="pt-2">
              <p className="text-xs text-muted-foreground mb-2">By Service:</p>
              <div className="space-y-1 text-xs">
                {Object.entries(breakdown.byService).map(([type, data]) => (
                  <div key={type} className="flex justify-between">
                    <span>{SERVICE_TYPE_LABELS[type] || type}</span>
                    <span>{formatCurrency(data.cost)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Button 
          onClick={handleGenerate} 
          disabled={!selectedClientId || isGenerating}
          className="w-full"
        >
          {isGenerating ? 'Generating...' : 'Generate Invoice'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default InvoiceGenerator;
