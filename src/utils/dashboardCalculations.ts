import { Booking, Agent, KPIData, ChartDataPoint, LeaderboardEntry } from '@/types';
import { startOfDay, subDays, format, parseISO, isWeekend, eachDayOfInterval } from 'date-fns';
import { resolveRange, businessToday, etMinutesOfDay, ymdToLocalDate, addDaysStr, startOfWeekStr, startOfMonthStr, presetLabel } from '@/utils/businessTime';

// Helper to filter out Non Booking records from actual booking calculations
const filterActualBookings = (bookings: Booking[]): Booking[] => {
  return bookings.filter(b => 
    b.status !== 'Non Booking' && 
    b.status !== 'Research' && 
    (b.recordType === undefined || b.recordType === 'booking')
  );
};

const countWeekdays = (startDate: Date, endDate: Date): number => {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  return days.filter(day => !isWeekend(day)).length;
};

const getBookingDate = (booking: Booking): Date => {
  return booking.bookingDate instanceof Date 
    ? booking.bookingDate 
    : parseISO(booking.bookingDate as unknown as string);
};

// bookingDate is a display Date built from the ET 'yyyy-MM-dd' string at local
// midnight, so formatting its local fields gives back the stored string.
const bookingYmd = (b: Booking): string => format(getBookingDate(b), 'yyyy-MM-dd');

const filterBookingsByYmd = (bookings: Booking[], day: string): Booking[] =>
  bookings.filter(b => bookingYmd(b) === day);

const filterBookingsByYmdRange = (bookings: Booking[], from: string | null, to: string): Booking[] =>
  bookings.filter(b => {
    const d = bookingYmd(b);
    return (from === null || d >= from) && d <= to;
  });

const filterBookingsByDate = (bookings: Booking[], date: Date): Booking[] =>
  filterBookingsByYmd(bookings, format(date, 'yyyy-MM-dd'));

const filterBookingsByDateRange = (bookings: Booking[], start: Date, end: Date): Booking[] =>
  filterBookingsByYmdRange(bookings, format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'));

const getAgentsBySiteName = (agents: Agent[], siteName: string): Agent[] => {
  return agents.filter(a => 
    a.siteName.toLowerCase().includes(siteName.toLowerCase())
  );
};

const getBookingsBySite = (bookings: Booking[], agents: Agent[], siteName: string): Booking[] => {
  const siteAgentIds = getAgentsBySiteName(agents, siteName).map(a => a.id);
  return bookings.filter(b => siteAgentIds.includes(b.agentId));
};

export type DateRangeFilter = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'all' | 'custom';

export interface CustomDateRange {
  from: Date;
  to: Date;
}

/** Current ET wall-clock time as a local Date (for display / hour maths). */
export const getEasternNow = (): Date => {
  const eastern = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  return new Date(eastern);
};

/** Earliest booking date in the rows (for 'all'), else 2024-01-01. */
const earliestYmd = (bookings?: Booking[]): string => {
  let min: string | null = null;
  for (const b of bookings ?? []) {
    const d = bookingYmd(b);
    if (min === null || d < min) min = d;
  }
  return min ?? '2024-01-01';
};

export const getDateRangeFromFilter = (
  filter: DateRangeFilter, 
  customDates?: CustomDateRange,
  bookings?: Booking[],
): { start: Date; end: Date } => {
  const r = resolveRange(filter, customDates);
  const from = r.from ?? earliestYmd(bookings);
  return { start: ymdToLocalDate(from), end: ymdToLocalDate(r.to) };
};

export const calculateKPIData = (
  bookings: Booking[], 
  agents: Agent[], 
  dateFilter: DateRangeFilter = 'today',
  customDates?: CustomDateRange
): KPIData[] => {
  const range = resolveRange(dateFilter, customDates);
  const isAll = dateFilter === 'all';

  // Filter out Non Booking records from actual booking calculations
  const actualBookings = filterActualBookings(bookings);
  let currentBookings = filterBookingsByYmdRange(actualBookings, range.from, range.to);
  let previousBookings = range.prevFrom && range.prevTo
    ? filterBookingsByYmdRange(actualBookings, range.prevFrom, range.prevTo)
    : [];

  // For "today" filter, use same-time comparison based on createdAt
  const useSameTimeComparison = dateFilter === 'today';
  if (useSameTimeComparison) {
    const nowMinutes = etMinutesOfDay(new Date());

    // Helper to check if booking was created by the current ET time of day
    const createdByNow = (b: Booking): boolean => {
      if (!b.createdAt) return true; // Include if no timestamp (legacy imports)
      const createdAt = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
      return etMinutesOfDay(createdAt) <= nowMinutes;
    };

    currentBookings = currentBookings.filter(createdByNow);
    previousBookings = previousBookings.filter(createdByNow);
  }

  // Rebooking calculations
  const currentNewBookings = currentBookings.filter(b => !b.isRebooking).length;
  const currentRebookings = currentBookings.filter(b => b.isRebooking).length;
  const previousNewBookings = previousBookings.filter(b => !b.isRebooking).length;
  const previousRebookings = previousBookings.filter(b => b.isRebooking).length;

  const currentVixicom = getBookingsBySite(currentBookings, agents, 'vixicom');
  const previousVixicom = getBookingsBySite(previousBookings, agents, 'vixicom');

  const currentPadsplit = getBookingsBySite(currentBookings, agents, 'padsplit');
  const previousPadsplit = getBookingsBySite(previousBookings, agents, 'padsplit');

  const currentPending = currentBookings.filter(b => b.status === 'Pending Move-In');
  const previousPending = previousBookings.filter(b => b.status === 'Pending Move-In');

  const calculateChange = (current: number, previous: number): { change: number; changeType: 'increase' | 'decrease' | 'neutral' } => {
    if (isAll) return { change: 0, changeType: 'neutral' };
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
  const rebookingsChange = calculateChange(currentRebookings, previousRebookings);
  const vixicomChange = calculateChange(currentVixicom.length, previousVixicom.length);
  const padsplitChange = calculateChange(currentPadsplit.length, previousPadsplit.length);
  const pendingChange = calculateChange(currentPending.length, previousPending.length);

  const periodLabel = presetLabel(dateFilter);
  const hideChange = isAll ? true : undefined;

  const comparisonLabel = useSameTimeComparison ? 'at this time yesterday' : 'previous period';

  // Generate subtitle for Total Bookings
  const totalSubtitle = currentRebookings > 0 
    ? `${currentNewBookings} new, ${currentRebookings} rebookings`
    : currentBookings.length > 0 ? 'All new bookings' : undefined;

  return [
    {
      label: `Total Bookings ${periodLabel === 'Today' ? 'Today' : ''}`,
      value: currentBookings.length,
      previousValue: previousBookings.length,
      change: totalChange.change,
      changeType: totalChange.changeType,
      comparisonLabel,
      hideChange,
      subtitle: totalSubtitle,
    },
    {
      label: 'Rebookings',
      value: currentRebookings,
      previousValue: previousRebookings,
      change: rebookingsChange.change,
      changeType: rebookingsChange.changeType,
      comparisonLabel,
      hideChange,
      subtitle: currentBookings.length > 0 
        ? `${Math.round((currentRebookings / currentBookings.length) * 100)}% of total`
        : undefined,
    },
    {
      label: 'Vixicom Bookings',
      value: currentVixicom.length,
      previousValue: previousVixicom.length,
      change: vixicomChange.change,
      changeType: vixicomChange.changeType,
      comparisonLabel,
      hideChange,
    },
    {
      label: 'PadSplit Internal',
      value: currentPadsplit.length,
      previousValue: previousPadsplit.length,
      change: padsplitChange.change,
      changeType: padsplitChange.changeType,
      comparisonLabel,
      hideChange,
    },
    {
      label: 'Pending Move-Ins',
      value: currentPending.length,
      previousValue: previousPending.length,
      change: pendingChange.change,
      changeType: pendingChange.changeType,
      comparisonLabel,
      hideChange,
    },
  ];
};

export const calculateChartData = (
  bookings: Booking[], 
  agents: Agent[], 
  dateFilter: DateRangeFilter = 'today',
  customDates?: CustomDateRange
): ChartDataPoint[] => {
  const chartData: ChartDataPoint[] = [];
  const { start, end } = getDateRangeFromFilter(dateFilter, customDates, bookings);
  
  // Filter out Non Booking records from chart calculations
  const actualBookings = filterActualBookings(bookings);
  
  // Calculate number of days to show
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  
  for (let i = days - 1; i >= 0; i--) {
    const date = subDays(end, i);
    const dayBookings = filterBookingsByDate(actualBookings, date);
    
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
  dateFilter: DateRangeFilter = 'today',
  customDates?: CustomDateRange
): LeaderboardEntry[] => {
  const range = resolveRange(dateFilter, customDates);
  const { start, end } = getDateRangeFromFilter(dateFilter, customDates, bookings);
  const weekdaysInPeriod = countWeekdays(start, end);

  // Filter out Non Booking records from leaderboard calculations
  const actualBookings = filterActualBookings(bookings);
  
  // Get bookings from the selected period
  const recentBookings = filterBookingsByYmdRange(actualBookings, range.from, range.to);

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
    
    // Separate new bookings from rebookings
    const newBookings = agentBookingsList.filter(b => !b.isRebooking).length;
    const rebookings = agentBookingsList.filter(b => b.isRebooking).length;

    // Calculate change: current period vs previous equivalent period
    // Current period bookings count (from agentBookingsList which is already filtered)
    const currentPeriodBookings = agentBookingsList.length;

    // Previous period bookings for this agent (using actualBookings)
    const previousPeriodBookings = range.prevFrom && range.prevTo
      ? filterBookingsByYmdRange(actualBookings.filter(b => b.agentId === agent.id), range.prevFrom, range.prevTo).length
      : 0;

    const change = dateFilter === 'all' ? 0 : currentPeriodBookings - previousPeriodBookings;

    leaderboardData.push({
      rank: 0,
      agentId: agent.id,
      agentName: agent.name,
      siteName: agent.siteName,
      bookings: agentBookingsList.length,
      newBookings,
      rebookings,
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
};

export const calculateMarketData = (
  bookings: Booking[],
  dateFilter: DateRangeFilter = 'today',
  customDates?: CustomDateRange
): { market: string; bookings: number }[] => {
  const range = resolveRange(dateFilter, customDates);
  // Filter out Non Booking records from market calculations
  const actualBookings = filterActualBookings(bookings);
  const filteredBookings = filterBookingsByYmdRange(actualBookings, range.from, range.to);
  
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

// Insights data interface
export interface InsightsData {
  todayVsYesterday: {
    todayByNow: number;
    yesterdayByNow: number;
    change: number;
    changeType: 'increase' | 'decrease' | 'neutral';
    currentTime: string;
  };
  weeklyTopPerformer: {
    name: string;
    bookings: number;
  } | null;
  weeklyMarketLeader: {
    market: string;
    bookings: number;
  } | null;
  activeAgentsToday: number;
  pendingMoveInsThisWeek: number;
  conversionRateThisMonth: number;
}

export const calculateInsightsData = (
  bookings: Booking[],
  agents: Agent[]
): InsightsData => {
  // Filter out Non Booking records from insights calculations
  const actualBookings = filterActualBookings(bookings);
  
  // Helper to get agent name from agents array
  const getAgentName = (agentId: string): string => 
    agents.find(a => a.id === agentId)?.name || 'Unknown Agent';
  const now = getEasternNow();
  const nowMinutes = etMinutesOfDay(new Date());
  const currentTime = format(now, 'h:mm a');
  
  const today = businessToday();
  const yesterday = addDaysStr(today, -1);
  const createdByNow = (b: Booking): boolean => !b.createdAt || etMinutesOfDay(b.createdAt) <= nowMinutes;
  
  // Get today's bookings
  const todaysBookings = filterBookingsByYmd(actualBookings, today);
  
  // Filter by createdAt time for same-time comparison
  const todayByNow = todaysBookings.filter(createdByNow).length;
  
  // Get yesterday's bookings
  const yesterdaysBookings = filterBookingsByYmd(actualBookings, yesterday);
  
  // Filter yesterday's bookings by same time
  const yesterdayByNow = yesterdaysBookings.filter(createdByNow).length;
  
  // Calculate change percentage
  let change = 0;
  let changeType: 'increase' | 'decrease' | 'neutral' = 'neutral';
  if (yesterdayByNow > 0) {
    change = Math.round(((todayByNow - yesterdayByNow) / yesterdayByNow) * 100);
    changeType = change > 0 ? 'increase' : change < 0 ? 'decrease' : 'neutral';
  } else if (todayByNow > 0) {
    change = 100;
    changeType = 'increase';
  }
  
  // Weekly calculations (always current week, Monday-today)
  const weekBookings = filterBookingsByYmdRange(actualBookings, startOfWeekStr(today), today); // Monday..today
  
  // Weekly Top Performer
  const agentCounts = new Map<string, { name: string; count: number }>();
  weekBookings.forEach(b => {
    const agentName = getAgentName(b.agentId);
    const existing = agentCounts.get(b.agentId) || { name: agentName, count: 0 };
    agentCounts.set(b.agentId, { name: existing.name, count: existing.count + 1 });
  });
  const sortedAgents = Array.from(agentCounts.values()).sort((a, b) => b.count - a.count);
  const topPerformer = sortedAgents[0] || null;
  
  // Weekly Market Leader
  const marketCounts = new Map<string, number>();
  weekBookings.forEach(b => {
    const market = b.marketCity || 'Unknown';
    if (market !== 'Unknown') {
      marketCounts.set(market, (marketCounts.get(market) || 0) + 1);
    }
  });
  const sortedMarkets = Array.from(marketCounts.entries()).sort((a, b) => b[1] - a[1]);
  const topMarket = sortedMarkets[0] ? { market: sortedMarkets[0][0], bookings: sortedMarkets[0][1] } : null;
  
  // Active agents today
  const activeAgentsToday = new Set(todaysBookings.map(b => b.agentId)).size;
  
  // Pending move-ins this week (next 7 days from today)
  // HubSpot imports with move_in_date = booking_date are placeholders: skip here only.
  const weekEnd = addDaysStr(today, 7);
  const pendingMoveInsThisWeek = actualBookings.filter(b => {
    const moveIn = format(b.moveInDate instanceof Date ? b.moveInDate : parseISO(String(b.moveInDate)), 'yyyy-MM-dd');
    if (b.importBatchId && moveIn === bookingYmd(b)) return false;
    return b.status === 'Pending Move-In' && moveIn >= today && moveIn <= weekEnd;
  }).length;
  
  // Conversion rate this month
  const monthBookings = filterBookingsByYmdRange(actualBookings, startOfMonthStr(today), today);
  const movedIn = monthBookings.filter(b => b.status === 'Moved In').length;
  const conversionRateThisMonth = monthBookings.length > 0 
    ? Math.round((movedIn / monthBookings.length) * 100) 
    : 0;
  
  return {
    todayVsYesterday: {
      todayByNow,
      yesterdayByNow,
      change: Math.abs(change),
      changeType,
      currentTime,
    },
    weeklyTopPerformer: topPerformer ? { name: topPerformer.name, bookings: topPerformer.count } : null,
    weeklyMarketLeader: topMarket,
    activeAgentsToday,
    pendingMoveInsThisWeek,
    conversionRateThisMonth,
  };
};

// Calculate total non-booking calls for any date range
export const calculateNonBookingCount = (
  bookings: Booking[],
  dateFilter: DateRangeFilter,
  customDates?: CustomDateRange
): number => {
  const range = resolveRange(dateFilter, customDates);
  const filtered = filterBookingsByYmdRange(bookings, range.from, range.to);
  return filtered.filter(b => b.status === 'Non Booking').length;
};
