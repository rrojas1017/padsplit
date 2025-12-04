import { Booking, Agent, KPIData, ChartDataPoint, LeaderboardEntry } from '@/types';
import { startOfDay, subDays, format, isToday, isYesterday, parseISO, isWeekend, eachDayOfInterval } from 'date-fns';

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

const getAgentsBySiteName = (agents: Agent[], siteName: string): Agent[] => {
  return agents.filter(a => 
    a.siteName.toLowerCase().includes(siteName.toLowerCase())
  );
};

const getBookingsBySite = (bookings: Booking[], agents: Agent[], siteName: string): Booking[] => {
  const siteAgentIds = getAgentsBySiteName(agents, siteName).map(a => a.id);
  return bookings.filter(b => siteAgentIds.includes(b.agentId));
};

export const calculateKPIData = (bookings: Booking[], agents: Agent[]): KPIData[] => {
  const today = new Date();
  const yesterday = subDays(today, 1);

  const todayBookings = filterBookingsByDate(bookings, today);
  const yesterdayBookings = filterBookingsByDate(bookings, yesterday);

  const todayVixicom = getBookingsBySite(todayBookings, agents, 'vixicom');
  const yesterdayVixicom = getBookingsBySite(yesterdayBookings, agents, 'vixicom');

  const todayPadsplit = getBookingsBySite(todayBookings, agents, 'padsplit');
  const yesterdayPadsplit = getBookingsBySite(yesterdayBookings, agents, 'padsplit');

  const todayPending = todayBookings.filter(b => b.status === 'Pending Move-In');
  const yesterdayPending = yesterdayBookings.filter(b => b.status === 'Pending Move-In');

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

  const totalChange = calculateChange(todayBookings.length, yesterdayBookings.length);
  const vixicomChange = calculateChange(todayVixicom.length, yesterdayVixicom.length);
  const padsplitChange = calculateChange(todayPadsplit.length, yesterdayPadsplit.length);
  const pendingChange = calculateChange(todayPending.length, yesterdayPending.length);

  return [
    {
      label: 'Total Bookings Today',
      value: todayBookings.length,
      previousValue: yesterdayBookings.length,
      change: totalChange.change,
      changeType: totalChange.changeType,
    },
    {
      label: 'Vixicom Bookings',
      value: todayVixicom.length,
      previousValue: yesterdayVixicom.length,
      change: vixicomChange.change,
      changeType: vixicomChange.changeType,
    },
    {
      label: 'PadSplit Internal',
      value: todayPadsplit.length,
      previousValue: yesterdayPadsplit.length,
      change: padsplitChange.change,
      changeType: padsplitChange.changeType,
    },
    {
      label: 'Pending Move-Ins',
      value: todayPending.length,
      previousValue: yesterdayPending.length,
      change: pendingChange.change,
      changeType: pendingChange.changeType,
    },
  ];
};

export const calculateChartData = (bookings: Booking[], agents: Agent[], days: number = 7): ChartDataPoint[] => {
  const chartData: ChartDataPoint[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = subDays(today, i);
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

export const calculateLeaderboard = (bookings: Booking[], agents: Agent[]): LeaderboardEntry[] => {
  const today = new Date();
  const weekStart = subDays(today, 7);
  const weekdaysInPeriod = countWeekdays(weekStart, today);

  // Get bookings from the last 7 days
  const recentBookings = bookings.filter(b => {
    const bookingDate = getBookingDate(b);
    return bookingDate >= weekStart && bookingDate <= today;
  });

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

    // Calculate today vs yesterday change
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

  // Sort by bookings and assign ranks
  leaderboardData.sort((a, b) => b.bookings - a.bookings);
  leaderboardData.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return leaderboardData;
};

export const calculateMarketData = (bookings: Booking[]): { market: string; bookings: number }[] => {
  const marketCounts = new Map<string, number>();

  bookings.forEach(booking => {
    const market = booking.marketCity || 'Unknown';
    marketCounts.set(market, (marketCounts.get(market) || 0) + 1);
  });

  return Array.from(marketCounts.entries())
    .map(([market, count]) => ({ market, bookings: count }))
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 6); // Top 6 markets
};
