import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Check, Send, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { BillingInvoice, Client } from '@/hooks/useBillingData';
import { formatCurrency } from '@/utils/billingCalculations';
import { toast } from 'sonner';

interface InvoiceHistoryProps {
  invoices: BillingInvoice[];
  clients: Client[];
  onUpdateStatus: (id: string, status: 'draft' | 'sent' | 'paid') => Promise<void>;
}

const statusConfig = {
  draft: { label: 'Draft', icon: Clock, variant: 'secondary' as const },
  sent: { label: 'Sent', icon: Send, variant: 'default' as const },
  paid: { label: 'Paid', icon: Check, variant: 'outline' as const },
};

const InvoiceHistory = ({ invoices, clients, onUpdateStatus }: InvoiceHistoryProps) => {
  const getClientName = (clientId: string) => {
    return clients.find(c => c.id === clientId)?.name || 'Unknown';
  };

  const handleStatusChange = async (invoiceId: string, newStatus: 'draft' | 'sent' | 'paid') => {
    try {
      await onUpdateStatus(invoiceId, newStatus);
      toast.success(`Invoice marked as ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update invoice status');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Invoice History
        </CardTitle>
        <CardDescription>
          View and manage generated invoices
        </CardDescription>
      </CardHeader>
      <CardContent>
        {invoices.length > 0 ? (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {invoices.map((invoice) => {
                const StatusIcon = statusConfig[invoice.status].icon;
                return (
                  <div
                    key={invoice.id}
                    className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{getClientName(invoice.client_id)}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(parseISO(invoice.period_start), 'MMM d')} - {format(parseISO(invoice.period_end), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <Badge variant={statusConfig[invoice.status].variant} className="flex items-center gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig[invoice.status].label}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Raw Cost</p>
                        <p className="font-medium">{formatCurrency(invoice.raw_cost_usd)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Markup</p>
                        <p className="font-medium">{formatCurrency(invoice.markup_usd)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-medium text-primary">{formatCurrency(invoice.total_usd)}</p>
                      </div>
                    </div>

                    {invoice.notes && (
                      <p className="text-xs text-muted-foreground italic">{invoice.notes}</p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-xs text-muted-foreground">
                        Created {format(parseISO(invoice.created_at), 'MMM d, yyyy')}
                      </span>
                      <Select
                        value={invoice.status}
                        onValueChange={(value) => handleStatusChange(invoice.id, value as any)}
                      >
                        <SelectTrigger className="w-[120px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="sent">Sent</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No invoices generated yet</p>
            <p className="text-sm">Generate your first invoice from the left panel</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InvoiceHistory;
