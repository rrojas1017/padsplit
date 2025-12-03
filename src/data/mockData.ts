import { Site, Agent, Booking, DailyMetrics, AccessLog, User, LeaderboardEntry, ChartDataPoint, KPIData } from '@/types';
import { subDays, format, addDays } from 'date-fns';

export const mockSites: Site[] = [
  { id: 'site-1', name: 'Vixicom', type: 'outsourced' },
  { id: 'site-2', name: 'PadSplit Internal', type: 'internal' },
];

export const mockAgents: Agent[] = [
  { id: 'agent-1', name: 'Emmanuel Rodriguez', siteId: 'site-1', siteName: 'Vixicom', active: true },
  { id: 'agent-2', name: 'Sarah Chen', siteId: 'site-1', siteName: 'Vixicom', active: true },
  { id: 'agent-3', name: 'Marcus Johnson', siteId: 'site-1', siteName: 'Vixicom', active: true },
  { id: 'agent-4', name: 'Ashley Williams', siteId: 'site-2', siteName: 'PadSplit Internal', active: true },
  { id: 'agent-5', name: 'David Kim', siteId: 'site-2', siteName: 'PadSplit Internal', active: true },
  { id: 'agent-6', name: 'Jennifer Lopez', siteId: 'site-1', siteName: 'Vixicom', active: true },
  { id: 'agent-7', name: 'Michael Brown', siteId: 'site-2', siteName: 'PadSplit Internal', active: true },
  { id: 'agent-8', name: 'Lisa Anderson', siteId: 'site-1', siteName: 'Vixicom', active: true },
];

const markets = [
  { city: 'Atlanta', state: 'GA' },
  { city: 'Houston', state: 'TX' },
  { city: 'Dallas', state: 'TX' },
  { city: 'Phoenix', state: 'AZ' },
  { city: 'Charlotte', state: 'NC' },
  { city: 'Tampa', state: 'FL' },
  { city: 'Orlando', state: 'FL' },
  { city: 'Nashville', state: 'TN' },
];

const statuses: Booking['status'][] = ['Pending Move-In', 'Moved In', 'Member Rejected', 'No Show', 'Cancelled'];
const bookingTypes: Booking['bookingType'][] = ['Inbound', 'Outbound', 'Referral'];
const commMethods: Booking['communicationMethod'][] = ['Phone', 'SMS', 'LC', 'Email'];

function generateBookings(): Booking[] {
  const bookings: Booking[] = [];
  const today = new Date();
  
  for (let i = 0; i < 200; i++) {
    const agent = mockAgents[Math.floor(Math.random() * mockAgents.length)];
    const market = markets[Math.floor(Math.random() * markets.length)];
    const daysAgo = Math.floor(Math.random() * 30);
    const bookingDate = subDays(today, daysAgo);
    const moveInDate = addDays(bookingDate, Math.floor(Math.random() * 14) + 1);
    
    bookings.push({
      id: `booking-${i}`,
      bookingDate,
      moveInDate,
      memberName: `Member ${i + 1}`,
      bookingType: bookingTypes[Math.floor(Math.random() * bookingTypes.length)],
      agentId: agent.id,
      agentName: agent.name,
      marketCity: market.city,
      marketState: market.state,
      communicationMethod: commMethods[Math.floor(Math.random() * commMethods.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      notes: Math.random() > 0.7 ? 'Follow up required' : undefined,
      moveInDayReachOut: Math.random() > 0.5,
    });
  }
  
  return bookings.sort((a, b) => b.bookingDate.getTime() - a.bookingDate.getTime());
}

export const mockBookings = generateBookings();

export const mockUsers: User[] = [
  { id: 'user-1', name: 'Roberto Rojas', email: 'rrojas@vixicom.com', role: 'super_admin', status: 'active' },
  { id: 'user-2', name: 'Admin User', email: 'admin@padsplit.com', role: 'admin', status: 'active' },
  { id: 'user-3', name: 'Team Lead', email: 'supervisor@vixicom.com', role: 'supervisor', siteId: 'site-1', status: 'active' },
  { id: 'user-4', name: 'Emmanuel Rodriguez', email: 'emmanuel@vixicom.com', role: 'agent', siteId: 'site-1', status: 'active' },
];

export const mockAccessLogs: AccessLog[] = [
  { id: 'log-1', userId: 'user-1', userName: 'Roberto Rojas', action: 'login', resource: '/dashboard', createdAt: new Date(), ipAddress: '192.168.1.1' },
  { id: 'log-2', userId: 'user-2', userName: 'Admin User', action: 'export_csv', resource: '/reports', createdAt: subDays(new Date(), 1), ipAddress: '192.168.1.2' },
  { id: 'log-3', userId: 'user-3', userName: 'Team Lead', action: 'view_dashboard', resource: '/dashboard', createdAt: subDays(new Date(), 1), ipAddress: '192.168.1.3' },
];

export function getKPIData(bookings: Booking[]): KPIData[] {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd');
  
  const todayBookings = bookings.filter(b => format(b.bookingDate, 'yyyy-MM-dd') === todayStr);
  const yesterdayBookings = bookings.filter(b => format(b.bookingDate, 'yyyy-MM-dd') === yesterdayStr);
  
  const vixicomToday = todayBookings.filter(b => mockAgents.find(a => a.id === b.agentId)?.siteId === 'site-1').length;
  const vixicomYesterday = yesterdayBookings.filter(b => mockAgents.find(a => a.id === b.agentId)?.siteId === 'site-1').length;
  
  const pendingToday = todayBookings.filter(b => b.status === 'Pending Move-In').length;
  const pendingYesterday = yesterdayBookings.filter(b => b.status === 'Pending Move-In').length;
  
  const movedInToday = todayBookings.filter(b => b.status === 'Moved In').length;
  const movedInYesterday = yesterdayBookings.filter(b => b.status === 'Moved In').length;
  
  const calcChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };
  
  return [
    {
      label: 'Total Bookings',
      value: todayBookings.length,
      previousValue: yesterdayBookings.length,
      change: calcChange(todayBookings.length, yesterdayBookings.length),
      changeType: todayBookings.length >= yesterdayBookings.length ? 'increase' : 'decrease',
    },
    {
      label: 'Vixicom Bookings',
      value: vixicomToday,
      previousValue: vixicomYesterday,
      change: calcChange(vixicomToday, vixicomYesterday),
      changeType: vixicomToday >= vixicomYesterday ? 'increase' : 'decrease',
    },
    {
      label: 'Pending Move-Ins',
      value: pendingToday,
      previousValue: pendingYesterday,
      change: calcChange(pendingToday, pendingYesterday),
      changeType: 'neutral',
    },
    {
      label: 'Confirmed Move-Ins',
      value: movedInToday,
      previousValue: movedInYesterday,
      change: calcChange(movedInToday, movedInYesterday),
      changeType: movedInToday >= movedInYesterday ? 'increase' : 'decrease',
    },
  ];
}

export function getChartData(bookings: Booking[], days: number = 7): ChartDataPoint[] {
  const data: ChartDataPoint[] = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = subDays(today, i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const previousDate = subDays(date, days);
    const previousDateStr = format(previousDate, 'yyyy-MM-dd');
    
    const dayBookings = bookings.filter(b => format(b.bookingDate, 'yyyy-MM-dd') === dateStr);
    const previousDayBookings = bookings.filter(b => format(b.bookingDate, 'yyyy-MM-dd') === previousDateStr);
    
    const vixicomBookings = dayBookings.filter(b => mockAgents.find(a => a.id === b.agentId)?.siteId === 'site-1').length;
    const padsplitBookings = dayBookings.filter(b => mockAgents.find(a => a.id === b.agentId)?.siteId === 'site-2').length;
    
    data.push({
      date: format(date, 'MMM dd'),
      bookings: dayBookings.length,
      previousBookings: previousDayBookings.length,
      vixicom: vixicomBookings,
      padsplit: padsplitBookings,
    });
  }
  
  return data;
}

export function getLeaderboard(bookings: Booking[]): LeaderboardEntry[] {
  const agentStats = new Map<string, { bookings: number; pending: number; rejected: number }>();
  
  const today = new Date();
  const weekAgo = subDays(today, 7);
  const twoWeeksAgo = subDays(today, 14);
  
  const thisWeekBookings = bookings.filter(b => b.bookingDate >= weekAgo);
  const lastWeekBookings = bookings.filter(b => b.bookingDate >= twoWeeksAgo && b.bookingDate < weekAgo);
  
  thisWeekBookings.forEach(booking => {
    const stats = agentStats.get(booking.agentId) || { bookings: 0, pending: 0, rejected: 0 };
    stats.bookings++;
    if (booking.status === 'Pending Move-In') stats.pending++;
    if (booking.status === 'Member Rejected') stats.rejected++;
    agentStats.set(booking.agentId, stats);
  });
  
  const lastWeekStats = new Map<string, number>();
  lastWeekBookings.forEach(booking => {
    lastWeekStats.set(booking.agentId, (lastWeekStats.get(booking.agentId) || 0) + 1);
  });
  
  const leaderboard: LeaderboardEntry[] = mockAgents
    .filter(agent => agent.active)
    .map(agent => {
      const stats = agentStats.get(agent.id) || { bookings: 0, pending: 0, rejected: 0 };
      const lastWeek = lastWeekStats.get(agent.id) || 0;
      const change = stats.bookings - lastWeek;
      
      return {
        rank: 0,
        agentId: agent.id,
        agentName: agent.name,
        siteName: agent.siteName,
        bookings: stats.bookings,
        bookingsPerDay: Math.round((stats.bookings / 7) * 10) / 10,
        pending: stats.pending,
        rejected: stats.rejected,
        change,
      };
    })
    .sort((a, b) => b.bookings - a.bookings)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
  
  return leaderboard;
}

export function getMarketData(bookings: Booking[]) {
  const marketStats = new Map<string, number>();
  
  bookings.forEach(booking => {
    const key = `${booking.marketCity}, ${booking.marketState}`;
    marketStats.set(key, (marketStats.get(key) || 0) + 1);
  });
  
  return Array.from(marketStats.entries())
    .map(([market, count]) => ({ market, bookings: count }))
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 8);
}
