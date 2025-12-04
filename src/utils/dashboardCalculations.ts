import { Booking, Agent, KPIData, ChartDataPoint, LeaderboardEntry } from '@/types';
import { startOfDay, startOfMonth, subDays, format, isToday, isYesterday, parseISO, isWeekend, eachDayOfInterval } from 'date-fns';

const countWeekdays = (startDate: Date, endDate: Date): number => {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  return days.filter(day => !isWeekend(day)).length;
};

const getBookingDate = (booking: Booking): Date => {
  return booking.bookingDate instanceof Date 
    ? booking.bookingDate 
    : parseISO(booking.bookingDate as unknown as string);
};

const filterBookingsByDate = (bookings: Booking[], date: Date): Booking[] => {
  const targetStart = startOfDay(date);
  return bookings.filter(b => {
    const bookingDate = startOfDay(getBookingDate(b));
    return bookingDate.getTime() === targetStart.getTime();
  });
};

const filterBookingsByDateRange = (bookings: Booking[], start: Date, end: Date): Booking[] => {
  const startDay = startOfDay(start);
  const endDay = startOfDay(end);
  return bookings.filter(b => {
    const bookingDate = startOfDay(getBookingDate(b));
    return bookingDate >= startDay && bookingDate <= endDay;
  });
};

const getAgentsBySiteName = (agents: Agent[], siteName: string): Agent[] => {
  return agents.filter(a => 
    a.siteName.toLowerCase().includes(siteName.toLowerCase())
  );
};

const getBookingsBySite = (bookings: Booking[], agents: Agent[], siteName: string): Booking[] => {
  const siteAgentIds = getAgentsBySiteName(agents, siteName).map(a => a.id);
  return bookings.filter(b => siteAgentIds.includes(b.agentId));
};

export type DateRangeFilter = 'today' | 'yesterday' | '7d' | '30d' | 'month';

export const getDateRangeFromFilter = (filter: DateRangeFilter): { start: Date; end: Date } => {
  const today = startOfDay(new Date());
  switch (filter) {
    case 'yesterday':
      return { start: subDays(today, 1), end: subDays(today, 1) };
    case '7d':
      return { start: subDays(today, 6), end: today };
    case '30d':
      return { start: subDays(today, 29), end: today };
    case 'month':
      return { start: startOfMonth(today), end: today };
    default: // 'today'
      return { start: today, end: today };
  }
};

export const calculateKPIData = (
  bookings: Booking[], 
  agents: Agent[], 
  dateFilter: DateRangeFilter = 'today'
): KPIData[] => {
  const { start, end } = getDateRangeFromFilter(dateFilter);
  const periodDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  
  // Get previous period for comparison
  const prevEnd = subDays(start, 1);
  const prevStart = subDays(prevEnd, periodDays - 1);

  const currentBookings = filterBookingsByDateRange(bookings, start, end);
  const previousBookings = filterBookingsByDateRange(bookings, prevStart, prevEnd);

  const currentVixicom = getBookingsBySite(currentBookings, agents, 'vixicom');
  const previousVixicom = getBookingsBySite(previousBookings, agents, 'vixicom');

  const currentPadsplit = getBookingsBySite(currentBookings, agents, 'padsplit');
  const previousPadsplit = getBookingsBySite(previousBookings, agents, 'padsplit');

  const currentPending = currentBookings.filter(b => b.status === 'Pending Move-In');
  const previousPending = previousBookings.filter(b => b.status === 'Pending Move-In');

  const calculateChange = (current: number, previous: number): { change: number; changeType: 'increase' | 'decrease' | 'neutral' } => {
    if (previous === 0) {
      return { change: current > 0 ? 100 : 0, changeType: current > 0 ? 'increase' : 'neutral' };
    }
    const change = Math.round(((current - previous) / previous) * 100);
    return {
      change: Math.abs(change),
      changeType: change > 0 ? 'increase' : change < 0 ? 'decrease' : 'neutral'
    };
  };

  const totalChange = calculateChange(currentBookings.length, previousBookings.length);
  const vixicomChange = calculateChange(currentVixicom.length, previousVixicom.length);
  const padsplitChange = calculateChange(currentPadsplit.length, previousPadsplit.length);
  const pendingChange = calculateChange(currentPending.length, previousPending.length);

  const periodLabel = dateFilter === 'today' ? 'Today' : 
    dateFilter === 'yesterday' ? 'Yesterday' : 
    dateFilter === '7d' ? 'Last 7 Days' : 
    dateFilter === '30d' ? 'Last 30 Days' : 'This Month';

  const comparisonLabel = dateFilter === 'today' ? 'yesterday' : 'previous period';

  return [
    {
      label: `Total Bookings ${periodLabel === 'Today' ? 'Today' : ''}`,
      value: currentBookings.length,
      previousValue: previousBookings.length,
      change: totalChange.change,
      changeType: totalChange.changeType,
    },
    {
      label: 'Vixicom Bookings',
      value: currentVixicom.length,
      previousValue: previousVixicom.length,
      change: vixicomChange.change,
      changeType: vixicomChange.changeType,
    },
    {
      label: 'PadSplit Internal',
      value: currentPadsplit.length,
      previousValue: previousPadsplit.length,
      change: padsplitChange.change,
      changeType: padsplitChange.changeType,
    },
    {
      label: 'Pending Move-Ins',
      value: currentPending.length,
      previousValue: previousPending.length,
      change: pendingChange.change,
      changeType: pendingChange.changeType,
    },
  ];
};

export const calculateChartData = (
  bookings: Booking[], 
  agents: Agent[], 
  dateFilter: DateRangeFilter = 'today'
): ChartDataPoint[] => {
  const chartData: ChartDataPoint[] = [];
  const { start, end } = getDateRangeFromFilter(dateFilter);
  
  // Calculate number of days to show
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  
  for (let i = days - 1; i >= 0; i--) {
    const date = subDays(end, i);
    const dayBookings = filterBookingsByDate(bookings, date);
    
    const vixicomBookings = getBookingsBySite(dayBookings, agents, 'vixicom');
    const padsplitBookings = getBookingsBySite(dayBookings, agents, 'padsplit');

    chartData.push({
      date: format(date, 'MMM dd'),
      bookings: dayBookings.length,
      vixicom: vixicomBookings.length,
      padsplit: padsplitBookings.length,
    });
  }

  return chartData;
};

export const calculateLeaderboard = (
  bookings: Booking[], 
  agents: Agent[],
  dateFilter: DateRangeFilter = 'today'
): LeaderboardEntry[] => {
  const { start, end } = getDateRangeFromFilter(dateFilter);
  const weekdaysInPeriod = countWeekdays(start, end);

  // Get bookings from the selected period
  const recentBookings = filterBookingsByDateRange(bookings, start, end);

  // Group bookings by agent
  const agentBookings = new Map<string, Booking[]>();
  recentBookings.forEach(booking => {
    const existing = agentBookings.get(booking.agentId) || [];
    existing.push(booking);
    agentBookings.set(booking.agentId, existing);
  });

  // Calculate stats for each agent
  const leaderboardData: LeaderboardEntry[] = [];
  
  agents.filter(a => a.active).forEach(agent => {
    const agentBookingsList = agentBookings.get(agent.id) || [];
    const pending = agentBookingsList.filter(b => b.status === 'Pending Move-In').length;
    const rejected = agentBookingsList.filter(b => b.status === 'Member Rejected').length;

    // Calculate change based on filter
    const today = new Date();
    const todayBookings = filterBookingsByDate(agentBookingsList, today).length;
    const yesterdayBookings = filterBookingsByDate(agentBookingsList, subDays(today, 1)).length;
    const change = todayBookings - yesterdayBookings;

    leaderboardData.push({
      rank: 0,
      agentId: agent.id,
      agentName: agent.name,
      siteName: agent.siteName,
      bookings: agentBookingsList.length,
      bookingsPerDay: Math.round((agentBookingsList.length / Math.max(weekdaysInPeriod, 1)) * 10) / 10,
      pending,
      rejected,
      change,
    });
  });

  // Filter out agents with zero bookings, then sort and assign ranks
  const agentsWithBookings = leaderboardData.filter(entry => entry.bookings > 0);
  agentsWithBookings.sort((a, b) => b.bookings - a.bookings);
  agentsWithBookings.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return agentsWithBookings;

  return leaderboardData;
};

export const calculateMarketData = (
  bookings: Booking[],
  dateFilter: DateRangeFilter = 'today'
): { market: string; bookings: number }[] => {
  const { start, end } = getDateRangeFromFilter(dateFilter);
  const filteredBookings = filterBookingsByDateRange(bookings, start, end);
  
  const marketCounts = new Map<string, number>();

  filteredBookings.forEach(booking => {
    const market = booking.marketCity || 'Unknown';
    marketCounts.set(market, (marketCounts.get(market) || 0) + 1);
  });

  return Array.from(marketCounts.entries())
    .map(([market, count]) => ({ market, bookings: count }))
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 6); // Top 6 markets
};
