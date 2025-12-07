import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useBillingData, DateRangeType } from '@/hooks/useBillingData';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, TrendingUp, Zap, FileText, Users, BarChart3 } from 'lucide-react';
import { formatCurrency, SERVICE_TYPE_LABELS, FUNCTION_LABELS } from '@/utils/billingCalculations';
import CostOverviewCards from '@/components/billing/CostOverviewCards';
import CostBreakdownCharts from '@/components/billing/CostBreakdownCharts';
import FunctionCostsTable from '@/components/billing/FunctionCostsTable';
import CostTrendChart from '@/components/billing/CostTrendChart';
import ClientManagement from '@/components/billing/ClientManagement';
import InvoiceGenerator from '@/components/billing/InvoiceGenerator';
import InvoiceHistory from '@/components/billing/InvoiceHistory';

const Billing = () => {
  const { hasRole, isLoading: authLoading } = useAuth();
  const [dateRange, setDateRange] = useState<DateRangeType>('thisMonth');
  
  const { 
    costs, 
    clients, 
    invoices, 
    summary, 
    isLoading, 
    error,
    isSuperAdmin,
    refetch,
    createClient,
    updateClient,
    createInvoice,
    updateInvoiceStatus,
  } = useBillingData(dateRange);

  // Redirect non-super_admins
  if (!authLoading && !hasRole(['super_admin'])) {
    return <Navigate to="/dashboard" replace />;
  }

  if (authLoading || isLoading) {
    return (
      <DashboardLayout title="Cost & Billing">
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout title="Cost & Billing">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Billing Data</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Cost & Billing">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cost & Billing</h1>
            <p className="text-muted-foreground">
              Track API costs and generate client invoices
            </p>
          </div>
          
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangeType)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="thisWeek">This Week</SelectItem>
              <SelectItem value="thisMonth">This Month</SelectItem>
              <SelectItem value="last30Days">Last 30 Days</SelectItem>
              <SelectItem value="allTime">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="costs" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="costs" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Costs
            </TabsTrigger>
            <TabsTrigger value="invoices" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Invoices
            </TabsTrigger>
            <TabsTrigger value="clients" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Clients
            </TabsTrigger>
          </TabsList>

          {/* Costs Tab */}
          <TabsContent value="costs" className="space-y-6">
            {/* Overview Cards */}
            <CostOverviewCards summary={summary} costs={costs} dateRange={dateRange} />

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CostBreakdownCharts summary={summary} />
              <CostTrendChart data={summary.dailyTrend} />
            </div>

            {/* Function Costs Table */}
            <FunctionCostsTable summary={summary} />
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <InvoiceGenerator 
                clients={clients} 
                costs={costs}
                onGenerate={createInvoice}
                dateRange={dateRange}
              />
              <InvoiceHistory 
                invoices={invoices} 
                clients={clients}
                onUpdateStatus={updateInvoiceStatus}
              />
            </div>
          </TabsContent>

          {/* Clients Tab */}
          <TabsContent value="clients" className="space-y-6">
            <ClientManagement 
              clients={clients} 
              onCreate={createClient}
              onUpdate={updateClient}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Billing;
