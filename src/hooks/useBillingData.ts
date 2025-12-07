import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';

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
  // Per-unit billing metrics
  uniqueBookingsProcessed: number;
  totalTalkTimeSeconds: number;
  costPerBooking: number;
  costPerMinute: number;
}

export function useBillingData(dateRange: DateRangeType = 'thisMonth', customStart?: Date, customEnd?: Date) {
  const { user, hasRole } = useAuth();
  const [costs, setCosts] = useState<ApiCost[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
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

      // Fetch costs within date range
      const { data: costsData, error: costsError } = await supabase
        .from('api_costs')
        .select('*')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false })
        .limit(5000);

      if (costsError) throw costsError;

      // Fetch clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (clientsError) throw clientsError;

      // Fetch invoices
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('billing_invoices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (invoicesError) throw invoicesError;

      setCosts((costsData || []) as ApiCost[]);
      setClients((clientsData || []) as Client[]);
      setInvoices((invoicesData || []) as BillingInvoice[]);
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

  // Calculate per-unit metrics
  const uniqueBookingIds = new Set(costs.filter(c => c.booking_id).map(c => c.booking_id));
  const uniqueBookingsProcessed = uniqueBookingIds.size;
  const totalTalkTimeSeconds = costs.reduce((sum, c) => sum + (c.audio_duration_seconds || 0), 0);
  const totalCost = costs.reduce((sum, c) => sum + Number(c.estimated_cost_usd), 0);
  const costPerBooking = uniqueBookingsProcessed > 0 ? totalCost / uniqueBookingsProcessed : 0;
  const costPerMinute = totalTalkTimeSeconds > 0 ? totalCost / (totalTalkTimeSeconds / 60) : 0;

  // Calculate summary statistics
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
      .insert({ ...client, created_by: user?.id })
      .select()
      .single();
    
    if (error) throw error;
    await fetchData();
    return data;
  };

  const updateClient = async (id: string, updates: Partial<Client>) => {
    const { error } = await supabase
      .from('clients')
      .update({ ...updates, updated_at: new Date().toISOString() })
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
  }) => {
    const { data, error } = await supabase
      .from('billing_invoices')
      .insert({ ...invoice, created_by: user?.id })
      .select()
      .single();
    
    if (error) throw error;
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

  return {
    costs,
    clients,
    invoices,
    summary,
    isLoading,
    error,
    isSuperAdmin,
    refetch: fetchData,
    createClient,
    updateClient,
    createInvoice,
    updateInvoiceStatus,
  };
}
