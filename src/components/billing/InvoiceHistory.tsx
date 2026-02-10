import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FileText, Check, Send, Clock, Download, ChevronDown, AlertCircle } from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';
import { BillingInvoice, Client, InvoiceLineItem } from '@/hooks/useBillingData';
import { formatCurrency, SOW_CATEGORY_LABELS } from '@/utils/billingCalculations';
import { toast } from 'sonner';
import { generateInvoicePDF } from '@/components/billing/InvoicePDFGenerator';

interface InvoiceHistoryProps {
  invoices: BillingInvoice[];
  clients: Client[];
  onUpdateStatus: (id: string, status: 'draft' | 'sent' | 'paid') => Promise<void>;
  onFetchLineItems: (invoiceId: string) => Promise<InvoiceLineItem[]>;
}

const statusConfig = {
  draft: { label: 'Draft', icon: Clock, variant: 'secondary' as const },
  sent: { label: 'Sent', icon: Send, variant: 'default' as const },
  paid: { label: 'Paid', icon: Check, variant: 'outline' as const },
};

const InvoiceHistory = ({ invoices, clients, onUpdateStatus, onFetchLineItems }: InvoiceHistoryProps) => {
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [lineItemsCache, setLineItemsCache] = useState<Record<string, InvoiceLineItem[]>>({});

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

  const handleExpand = async (invoiceId: string) => {
    if (expandedInvoice === invoiceId) {
      setExpandedInvoice(null);
      return;
    }
    setExpandedInvoice(invoiceId);
    if (!lineItemsCache[invoiceId]) {
      try {
        const items = await onFetchLineItems(invoiceId);
        setLineItemsCache(prev => ({ ...prev, [invoiceId]: items }));
      } catch {
        toast.error('Failed to load line items');
      }
    }
  };

  const handleDownloadPDF = (invoice: BillingInvoice) => {
    const client = clients.find(c => c.id === invoice.client_id);
    const items = lineItemsCache[invoice.id] || [];
    generateInvoicePDF(invoice, client, items);
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
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-3">
              {invoices.map((invoice) => {
                const StatusIcon = statusConfig[invoice.status].icon;
                const isOverdue = invoice.due_date && isPast(parseISO(invoice.due_date)) && invoice.status !== 'paid';
                const items = lineItemsCache[invoice.id];

                return (
                  <div
                    key={invoice.id}
                    className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{invoice.invoice_number || 'INV-—'}</p>
                          <span className="text-sm text-muted-foreground">·</span>
                          <p className="text-sm">{getClientName(invoice.client_id)}</p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(parseISO(invoice.period_start), 'MMM d')} – {format(parseISO(invoice.period_end), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isOverdue && (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Overdue
                          </Badge>
                        )}
                        <Badge variant={statusConfig[invoice.status].variant} className="flex items-center gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig[invoice.status].label}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Internal Cost</p>
                        <p className="font-medium">{formatCurrency(invoice.raw_cost_usd)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Margin</p>
                        <p className="font-medium">{formatCurrency(invoice.markup_usd)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-medium text-primary">{formatCurrency(invoice.total_usd)}</p>
                      </div>
                    </div>

                    {/* Expandable line items */}
                    <Collapsible open={expandedInvoice === invoice.id}>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-between text-xs"
                          onClick={() => handleExpand(invoice.id)}
                        >
                          View Line Items
                          <ChevronDown className={`h-3 w-3 transition-transform ${expandedInvoice === invoice.id ? 'rotate-180' : ''}`} />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-2">
                        {items && items.length > 0 ? (
                          <div className="space-y-1 text-xs">
                            {items.map((li) => (
                              <div key={li.id} className="flex justify-between py-1 border-b last:border-0">
                                <span>{SOW_CATEGORY_LABELS[li.service_category] || li.description}</span>
                                <span className="text-muted-foreground">
                                  {Number(li.quantity).toLocaleString()} × {formatCurrency(Number(li.unit_rate))} = <span className="font-medium text-foreground">{formatCurrency(Number(li.subtotal))}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">Loading...</p>
                        )}
                      </CollapsibleContent>
                    </Collapsible>

                    {invoice.notes && (
                      <p className="text-xs text-muted-foreground italic">{invoice.notes}</p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          Created {format(parseISO(invoice.created_at), 'MMM d, yyyy')}
                        </span>
                        {invoice.due_date && (
                          <span className="text-xs text-muted-foreground">
                            Due {format(parseISO(invoice.due_date), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => handleDownloadPDF(invoice)}
                          title="Download PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
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
