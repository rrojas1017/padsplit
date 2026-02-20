import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useBillingData, DateRangeType } from '@/hooks/useBillingData';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateRangeFilter, DateFilterValue, CustomDateRange } from '@/components/dashboard/DateRangeFilter';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Users, BarChart3, Activity, Settings } from 'lucide-react';
import CostOverviewCards from '@/components/billing/CostOverviewCards';
import CostBreakdownCharts from '@/components/billing/CostBreakdownCharts';
import FunctionCostsTable from '@/components/billing/FunctionCostsTable';
import CostTrendChart from '@/components/billing/CostTrendChart';
import ClientManagement from '@/components/billing/ClientManagement';
import InvoiceGenerator from '@/components/billing/InvoiceGenerator';
import InvoiceHistory from '@/components/billing/InvoiceHistory';
import { AdminNotifications } from '@/components/billing/AdminNotifications';
import { CostAlertBanner } from '@/components/billing/CostAlertBanner';
import RealtimeCostDashboard from '@/components/billing/RealtimeCostDashboard';
import LLMCostCalculator from '@/components/billing/LLMCostCalculator';
import SOWPricingConfig from '@/components/billing/SOWPricingConfig';

const Billing = () => {
  const { hasRole, isLoading: authLoading } = useAuth();
  const [dateFilter, setDateFilter] = useState<DateFilterValue>('today');
  const [customDates, setCustomDates] = useState<CustomDateRange | undefined>(undefined);

  const handleRangeChange = (range: DateFilterValue, dates?: CustomDateRange) => {
    setDateFilter(range);
    setCustomDates(range === 'custom' && dates ? dates : undefined);
  };

  const getBillingDateRange = (): DateRangeType => {
    if (dateFilter === 'custom') return 'custom';
    if (dateFilter === 'today') return 'today';
    if (dateFilter === 'yesterday') return 'yesterday';
    if (dateFilter === '7d') return 'last30Days';
    if (dateFilter === '30d') return 'last30Days';
    if (dateFilter === 'month') return 'thisMonth';
    if (dateFilter === 'all') return 'allTime';
    return 'thisMonth';
  };
  
  const { 
    costs, 
    clients, 
    invoices, 
    sowPricing,
    summary, 
    isLoading, 
    error,
    isSuperAdmin,
    refetch,
    createClient,
    updateClient,
    createInvoice,
    updateInvoiceStatus,
    updateSOWPricing,
    fetchInvoiceLineItems,
    fetchPeriodCounts,
  } = useBillingData(
    getBillingDateRange(), 
    customDates?.from, 
    customDates?.to
  );

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
              Track API costs, generate SOW-based invoices, and manage client billing
            </p>
          </div>
          
          <DateRangeFilter 
            defaultValue="today"
            onRangeChange={handleRangeChange}
            includeAllTime={true}
            includeCustom={true}
          />
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="costs" className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-5">
            <TabsTrigger value="costs" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Costs
            </TabsTrigger>
            <TabsTrigger value="live-monitor" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Live Monitor
            </TabsTrigger>
            <TabsTrigger value="invoices" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Invoices
            </TabsTrigger>
            <TabsTrigger value="clients" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Clients
            </TabsTrigger>
            <TabsTrigger value="sow-pricing" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              SOW Pricing
            </TabsTrigger>
          </TabsList>

          {/* Costs Tab */}
          <TabsContent value="costs" className="space-y-6">
            <CostAlertBanner />
            <AdminNotifications />
            <CostOverviewCards summary={summary} costs={costs} dateRange={dateFilter} sowPricing={sowPricing} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CostBreakdownCharts summary={summary} />
              <CostTrendChart data={summary.dailyTrend} />
            </div>
            <FunctionCostsTable summary={summary} />
          </TabsContent>

          {/* Live Monitor Tab */}
          <TabsContent value="live-monitor" className="space-y-6">
            <RealtimeCostDashboard />
            <LLMCostCalculator />
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <InvoiceGenerator 
                clients={clients} 
                sowPricing={sowPricing}
                onGenerate={createInvoice}
                fetchPeriodCounts={fetchPeriodCounts}
              />
              <InvoiceHistory 
                invoices={invoices} 
                clients={clients}
                onUpdateStatus={updateInvoiceStatus}
                onFetchLineItems={fetchInvoiceLineItems}
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

          {/* SOW Pricing Tab */}
          <TabsContent value="sow-pricing" className="space-y-6">
            <SOWPricingConfig 
              pricing={sowPricing}
              onUpdate={updateSOWPricing}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Billing;
