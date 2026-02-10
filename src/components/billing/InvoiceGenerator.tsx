import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, CalendarIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Client, ApiCost } from '@/hooks/useBillingData';
import { formatCurrency, SOW_CATEGORY_LABELS, SOW_UNIT_LABELS, SOWPricingConfig, SOWLineItem, getApplicableRate } from '@/utils/billingCalculations';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DateFilterValue } from '@/components/dashboard/DateRangeFilter';

interface InvoiceGeneratorProps {
  clients: Client[];
  costs: ApiCost[];
  sowPricing: SOWPricingConfig[];
  onGenerate: (invoice: {
    client_id: string;
    period_start: string;
    period_end: string;
    raw_cost_usd: number;
    markup_usd: number;
    total_usd: number;
    cost_breakdown: Record<string, any>;
    notes?: string;
    payment_terms?: string;
    line_items?: SOWLineItem[];
  }) => Promise<any>;
  dateRange: DateFilterValue;
  voiceRecordCount: number;
  textRecordCount: number;
  voiceCoachingCount: number;
  emailDeliveryCount: number;
  smsDeliveryCount: number;
  telephonyMinutes: number;
  totalInternalCost: number;
}

const InvoiceGenerator = ({
  clients,
  costs,
  sowPricing,
  onGenerate,
  dateRange,
  voiceRecordCount,
  textRecordCount,
  voiceCoachingCount,
  emailDeliveryCount,
  smsDeliveryCount,
  telephonyMinutes,
  totalInternalCost,
}: InvoiceGeneratorProps) => {
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [periodStart, setPeriodStart] = useState<Date>(startOfMonth(new Date()));
  const [periodEnd, setPeriodEnd] = useState<Date>(endOfMonth(new Date()));
  const [notes, setNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const enabledServices = (selectedClient?.enabled_services as string[]) || [];

  // Build line items based on SOW pricing and record counts
  const lineItems = useMemo((): SOWLineItem[] => {
    const items: SOWLineItem[] = [];
    const totalMonthlyVolume = voiceRecordCount + textRecordCount;

    const quantityMap: Record<string, number> = {
      voice_processing: voiceRecordCount,
      text_processing: textRecordCount,
      voice_coaching: voiceCoachingCount,
      email_delivery: emailDeliveryCount,
      sms_delivery: smsDeliveryCount,
      telephony: telephonyMinutes,
      data_appending: 0,
      chat_delivery: 0,
    };

    sowPricing
      .filter(p => p.is_active && enabledServices.includes(p.service_category))
      .forEach((config, idx) => {
        const quantity = quantityMap[config.service_category] || 0;
        if (quantity === 0) return;

        const rate = getApplicableRate(config, totalMonthlyVolume);
        items.push({
          service_category: config.service_category,
          description: config.description,
          quantity,
          unit_rate: rate,
          subtotal: quantity * rate,
          is_optional: config.is_optional,
          sort_order: idx,
        });
      });

    return items;
  }, [sowPricing, enabledServices, voiceRecordCount, textRecordCount, voiceCoachingCount, emailDeliveryCount, smsDeliveryCount, telephonyMinutes]);

  const grandTotal = lineItems.reduce((sum, li) => sum + li.subtotal, 0);
  const margin = grandTotal - totalInternalCost;

  const handleGenerate = async () => {
    if (!selectedClientId) {
      toast.error('Please select a client');
      return;
    }

    setIsGenerating(true);
    try {
      const paymentTerms = `Net ${selectedClient?.payment_terms_days || 30}`;
      await onGenerate({
        client_id: selectedClientId,
        period_start: format(periodStart, 'yyyy-MM-dd'),
        period_end: format(periodEnd, 'yyyy-MM-dd'),
        raw_cost_usd: totalInternalCost,
        markup_usd: margin,
        total_usd: grandTotal,
        cost_breakdown: {
          lineItems: lineItems.map(li => ({
            category: li.service_category,
            description: li.description,
            quantity: li.quantity,
            unitRate: li.unit_rate,
            subtotal: li.subtotal,
          })),
          voiceRecords: voiceRecordCount,
          textRecords: textRecordCount,
          voiceCoaching: voiceCoachingCount,
          internalCost: totalInternalCost,
        },
        notes: notes || undefined,
        payment_terms: paymentTerms,
        line_items: lineItems,
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
          Generate SOW Invoice
        </CardTitle>
        <CardDescription>
          Create an itemized invoice based on SOW pricing
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
                  {client.name} (Net {client.payment_terms_days || 30})
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
                <Calendar mode="single" selected={periodStart} onSelect={(date) => date && setPeriodStart(date)} initialFocus />
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
                <Calendar mode="single" selected={periodEnd} onSelect={(date) => date && setPeriodEnd(date)} initialFocus />
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

        {/* Invoice Preview - Line Items */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <h4 className="font-medium">Invoice Preview</h4>

          {lineItems.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((li, idx) => {
                  const pricingConfig = sowPricing.find(p => p.service_category === li.service_category);
                  const unitLabel = pricingConfig ? SOW_UNIT_LABELS[pricingConfig.unit] || '' : '';
                  return (
                    <TableRow key={idx}>
                      <TableCell className="text-sm">
                        {SOW_CATEGORY_LABELS[li.service_category] || li.description}
                        {li.is_optional && (
                          <Badge variant="outline" className="ml-2 text-xs">Optional</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {li.quantity.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(li.unit_rate)}{unitLabel}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatCurrency(li.subtotal)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              {selectedClientId ? 'No billable activity for this period' : 'Select a client to preview line items'}
            </p>
          )}

          {lineItems.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Billable Total:</span>
                <span className="font-medium">{formatCurrency(grandTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Internal Cost:</span>
                <span>{formatCurrency(totalInternalCost)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Margin:</span>
                <span className={margin >= 0 ? 'text-emerald-600' : 'text-destructive'}>
                  {formatCurrency(margin)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between font-medium text-base">
                <span>Invoice Total:</span>
                <span className="text-primary">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-md bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="font-medium mb-1">SOW Transparency</p>
          <p>No platform fees · No seat fees · No hidden costs · Strictly usage-based</p>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={!selectedClientId || isGenerating || lineItems.length === 0}
          className="w-full"
        >
          {isGenerating ? 'Generating...' : 'Generate Invoice'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default InvoiceGenerator;
