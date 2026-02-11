import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { BookingInsightsTab } from '@/components/call-insights/BookingInsightsTab';
import { NonBookingAnalysisTab } from '@/components/call-insights/NonBookingAnalysisTab';
import { CrossSellOpportunitiesTab } from '@/components/call-insights/CrossSellOpportunitiesTab';
import { useAuth } from '@/contexts/AuthContext';
import { Lightbulb, TrendingUp, UserX, ShoppingBag } from 'lucide-react';

// Interface matching the Call type expected by child components
export interface Call {
  id: string;
  kixie_call_id: string | null;
  recording_url: string | null;
  call_type: string;
  call_status: string;
  call_date: string;
  duration_seconds: number | null;
  from_number: string | null;
  to_number: string | null;
  kixie_agent_name: string | null;
  agent_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  disposition: string | null;
  outcome_category: string | null;
  booking_id: string | null;
  transcription_status: string | null;
  source: string;
  created_at: string;
}

type DateRangeOption = 'thisWeek' | 'lastMonth' | 'thisMonth' | 'last3months' | 'allTime';

export default function CallInsights() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole(['super_admin']);
  const initialTab = searchParams.get('tab') === 'bookings' ? 'bookings' : 
                     searchParams.get('tab') === 'cross-sell' && isSuperAdmin ? 'cross-sell' : 'non-bookings';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [dateRange, setDateRange] = useState<DateRangeOption>('thisMonth');

  // Sync tab with URL
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'bookings' && activeTab !== 'bookings') {
      setActiveTab('bookings');
    } else if (tabParam === 'cross-sell' && isSuperAdmin && activeTab !== 'cross-sell') {
      setActiveTab('cross-sell');
    }
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === 'bookings') {
      setSearchParams({ tab: 'bookings' });
    } else if (value === 'cross-sell') {
      setSearchParams({ tab: 'cross-sell' });
    } else {
      setSearchParams({});
    }
  };

  return (
    <DashboardLayout 
      title="Communication Insights" 
      subtitle="AI-powered analysis of communication patterns and conversion trends"
    >
      <div className="space-y-6">
        {/* Header with Icon */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 shadow-lg">
            <Lightbulb className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Communication Insights
            </h1>
            <p className="text-sm text-muted-foreground">
              Analyze booking and non-booking communication patterns to improve conversion
            </p>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className={`grid w-full ${isSuperAdmin ? 'max-w-2xl grid-cols-3' : 'max-w-md grid-cols-2'} p-1 h-12`}>
            <TabsTrigger 
              value="bookings" 
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <TrendingUp className="h-4 w-4" />
              <span>Booking Insights</span>
            </TabsTrigger>
            <TabsTrigger 
              value="non-bookings"
              className="gap-2 data-[state=active]:bg-amber-500 data-[state=active]:text-white"
            >
              <UserX className="h-4 w-4" />
              <span>Non-Booking Analysis</span>
            </TabsTrigger>
            {isSuperAdmin && (
              <TabsTrigger 
                value="cross-sell"
                className="gap-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white"
              >
                <ShoppingBag className="h-4 w-4" />
                <span>Cross-Sell</span>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="bookings" className="mt-6">
            <BookingInsightsTab 
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />
          </TabsContent>

          <TabsContent value="non-bookings" className="mt-6">
            <NonBookingAnalysisTab 
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />
          </TabsContent>

          {isSuperAdmin && (
            <TabsContent value="cross-sell" className="mt-6">
              <CrossSellOpportunitiesTab 
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
