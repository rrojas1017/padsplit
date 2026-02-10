import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { SOWPricingConfig } from '@/utils/billingCalculations';

export interface ApiCost {
  id: string;
  created_at: string;
  service_provider: 'elevenlabs' | 'lovable_ai';
  service_type: string;
  edge_function: string;
  booking_id: string | null;
  agent_id: string | null;
  site_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  audio_duration_seconds: number | null;
  character_count: number | null;
  estimated_cost_usd: number;
  metadata: Record<string, any>;
}

export interface Client {
  id: string;
  name: string;
  contact_email: string | null;
  billing_period: 'daily' | 'weekly' | 'monthly';
  markup_percentage: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  payment_terms_days: number;
  enabled_services: string[];
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  service_category: string;
  description: string;
  quantity: number;
  unit_rate: number;
  subtotal: number;
  is_optional: boolean;
  sort_order: number;
}

export interface BillingInvoice {
  id: string;
  client_id: string;
  period_start: string;
  period_end: string;
  raw_cost_usd: number;
  markup_usd: number;
  total_usd: number;
  cost_breakdown: Record<string, any>;
  status: 'draft' | 'sent' | 'paid';
  notes: string | null;
  created_by: string | null;
  created_at: string;
  invoice_number: string | null;
  payment_terms: string | null;
  due_date: string | null;
  line_items?: InvoiceLineItem[];
  client?: Client;
}

export type DateRangeType = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'last30Days' | 'allTime' | 'custom';

export type BillingUnit = 'raw_cost' | 'per_booking' | 'per_minute';

export interface CostSummary {
  totalCost: number;
  byProvider: Record<string, number>;
  byServiceType: Record<string, number>;
  byFunction: Record<string, { count: number; cost: number }>;
  byAgent: Record<string, { name: string; cost: number; count: number }>;
  dailyTrend: Array<{ date: string; cost: number; count: number }>;
  uniqueBookingsProcessed: number;
  totalTalkTimeSeconds: number;
  costPerBooking: number;
  costPerMinute: number;
  // SOW billing metrics
  voiceRecordCount: number;
  textRecordCount: number;
  voiceCoachingCount: number;
  emailDeliveryCount: number;
  smsDeliveryCount: number;
  telephonyMinutes: number;
}

export function useBillingData(dateRange: DateRangeType = 'thisMonth', customStart?: Date, customEnd?: Date) {
  const { user, hasRole } = useAuth();
  const [costs, setCosts] = useState<ApiCost[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [sowPricing, setSowPricing] = useState<SOWPricingConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSuperAdmin = hasRole(['super_admin']);

  const getDateRange = useCallback((): { start: Date; end: Date } => {
    const now = new Date();
    switch (dateRange) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'yesterday':
        const yesterday = subDays(now, 1);
        return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
      case 'thisWeek':
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'thisMonth':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'last30Days':
        return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
      case 'custom':
        return { 
          start: customStart ? startOfDay(customStart) : startOfMonth(now), 
          end: customEnd ? endOfDay(customEnd) : endOfDay(now) 
        };
      case 'allTime':
      default:
        return { start: new Date('2020-01-01'), end: endOfDay(now) };
    }
  }, [dateRange, customStart, customEnd]);

  const fetchData = useCallback(async () => {
    if (!isSuperAdmin) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { start, end } = getDateRange();
      const startDate = start.toISOString().split('T')[0];
      const endDate = end.toISOString().split('T')[0];

      // Get booking IDs within the date range
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('id')
        .gte('booking_date', startDate)
        .lte('booking_date', endDate);

      if (bookingsError) throw bookingsError;

      const bookingIds = bookingsData?.map(b => b.id) || [];

      // Fetch costs for those specific bookings
      let costsData: any[] = [];
      if (bookingIds.length > 0) {
        const { data, error: costsError } = await supabase
          .from('api_costs')
          .select('*')
          .in('booking_id', bookingIds)
          .order('created_at', { ascending: false })
          .limit(5000);

        if (costsError) throw costsError;
        costsData = data || [];
      }

      // Fetch clients, invoices, SOW pricing, and communications in parallel
      const [clientsRes, invoicesRes, sowRes, commsRes] = await Promise.all([
        supabase.from('clients').select('*').order('name'),
        supabase.from('billing_invoices').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('sow_pricing_config').select('*').order('service_category'),
        supabase.from('contact_communications').select('communication_type')
          .gte('sent_at', start.toISOString())
          .lte('sent_at', end.toISOString()),
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (invoicesRes.error) throw invoicesRes.error;
      if (sowRes.error) throw sowRes.error;

      setCosts((costsData || []) as ApiCost[]);
      setClients((clientsRes.data || []) as Client[]);
      setInvoices((invoicesRes.data || []) as BillingInvoice[]);
      setSowPricing((sowRes.data || []) as SOWPricingConfig[]);
    } catch (err) {
      console.error('Error fetching billing data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch billing data');
    } finally {
      setIsLoading(false);
    }
  }, [isSuperAdmin, getDateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Classify records for SOW billing
  const voiceRecordIds = new Set(
    costs.filter(c => c.service_type === 'stt_transcription' && c.booking_id).map(c => c.booking_id)
  );
  const voiceCoachingIds = new Set(
    costs.filter(c => ['tts_coaching', 'tts_qa_coaching'].includes(c.service_type) && c.booking_id).map(c => c.booking_id)
  );
  // Text records = bookings processed that DON'T have STT
  const allProcessedBookingIds = new Set(costs.filter(c => c.booking_id).map(c => c.booking_id));
  const textRecordCount = [...allProcessedBookingIds].filter(id => !voiceRecordIds.has(id)).length;

  // Per-unit metrics
  const uniqueBookingIds = new Set(costs.filter(c => c.booking_id).map(c => c.booking_id));
  const uniqueBookingsProcessed = uniqueBookingIds.size;
  const totalTalkTimeSeconds = costs.reduce((sum, c) => sum + (c.audio_duration_seconds || 0), 0);
  const totalCost = costs.reduce((sum, c) => sum + Number(c.estimated_cost_usd), 0);
  const costPerBooking = uniqueBookingsProcessed > 0 ? totalCost / uniqueBookingsProcessed : 0;
  const costPerMinute = totalTalkTimeSeconds > 0 ? totalCost / (totalTalkTimeSeconds / 60) : 0;

  const summary: CostSummary = {
    totalCost,
    byProvider: {},
    byServiceType: {},
    byFunction: {},
    byAgent: {},
    dailyTrend: [],
    uniqueBookingsProcessed,
    totalTalkTimeSeconds,
    costPerBooking,
    costPerMinute,
    voiceRecordCount: voiceRecordIds.size,
    textRecordCount,
    voiceCoachingCount: voiceCoachingIds.size,
    emailDeliveryCount: 0,
    smsDeliveryCount: 0,
    telephonyMinutes: 0,
  };

  // Group by provider
  costs.forEach(cost => {
    const provider = cost.service_provider;
    summary.byProvider[provider] = (summary.byProvider[provider] || 0) + Number(cost.estimated_cost_usd);
  });

  // Group by service type
  costs.forEach(cost => {
    const type = cost.service_type;
    summary.byServiceType[type] = (summary.byServiceType[type] || 0) + Number(cost.estimated_cost_usd);
  });

  // Group by function
  costs.forEach(cost => {
    const fn = cost.edge_function;
    if (!summary.byFunction[fn]) {
      summary.byFunction[fn] = { count: 0, cost: 0 };
    }
    summary.byFunction[fn].count++;
    summary.byFunction[fn].cost += Number(cost.estimated_cost_usd);
  });

  // Group by date for trend
  const dailyMap: Record<string, { cost: number; count: number }> = {};
  costs.forEach(cost => {
    const date = cost.created_at.split('T')[0];
    if (!dailyMap[date]) {
      dailyMap[date] = { cost: 0, count: 0 };
    }
    dailyMap[date].cost += Number(cost.estimated_cost_usd);
    dailyMap[date].count++;
  });
  summary.dailyTrend = Object.entries(dailyMap)
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Client management functions
  const createClient = async (client: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('clients')
      .insert({ ...client, created_by: user?.id } as any)
      .select()
      .single();
    
    if (error) throw error;
    await fetchData();
    return data;
  };

  const updateClient = async (id: string, updates: Partial<Client>) => {
    const { error } = await supabase
      .from('clients')
      .update({ ...updates, updated_at: new Date().toISOString() } as any)
      .eq('id', id);
    
    if (error) throw error;
    await fetchData();
  };

  // Invoice functions
  const createInvoice = async (invoice: {
    client_id: string;
    period_start: string;
    period_end: string;
    raw_cost_usd: number;
    markup_usd: number;
    total_usd: number;
    cost_breakdown: Record<string, any>;
    notes?: string;
    payment_terms?: string;
    line_items?: Array<{
      service_category: string;
      description: string;
      quantity: number;
      unit_rate: number;
      subtotal: number;
      is_optional: boolean;
      sort_order: number;
    }>;
  }) => {
    const { line_items, ...invoiceData } = invoice;
    
    const { data, error } = await supabase
      .from('billing_invoices')
      .insert({ ...invoiceData, created_by: user?.id, payment_terms: invoice.payment_terms || 'Net 30' } as any)
      .select()
      .single();
    
    if (error) throw error;

    // Insert line items if provided
    if (line_items && line_items.length > 0 && data) {
      const { error: lineError } = await supabase
        .from('invoice_line_items')
        .insert(line_items.map(li => ({ ...li, invoice_id: (data as any).id })));
      
      if (lineError) throw lineError;
    }

    await fetchData();
    return data;
  };

  const updateInvoiceStatus = async (id: string, status: 'draft' | 'sent' | 'paid') => {
    const { error } = await supabase
      .from('billing_invoices')
      .update({ status })
      .eq('id', id);
    
    if (error) throw error;
    await fetchData();
  };

  // SOW pricing management
  const updateSOWPricing = async (id: string, updates: Partial<SOWPricingConfig>) => {
    const { error } = await supabase
      .from('sow_pricing_config')
      .update(updates as any)
      .eq('id', id);
    
    if (error) throw error;
    await fetchData();
  };

  // Fetch line items for an invoice
  const fetchInvoiceLineItems = async (invoiceId: string): Promise<InvoiceLineItem[]> => {
    const { data, error } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('sort_order');
    
    if (error) throw error;
    return (data || []) as InvoiceLineItem[];
  };

  return {
    costs,
    clients,
    invoices,
    sowPricing,
    summary,
    isLoading,
    error,
    isSuperAdmin,
    refetch: fetchData,
    createClient,
    updateClient,
    createInvoice,
    updateInvoiceStatus,
    updateSOWPricing,
    fetchInvoiceLineItems,
  };
}
