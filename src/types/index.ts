export type UserRole = 'super_admin' | 'admin' | 'supervisor' | 'agent';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  siteId?: string;
  avatarUrl?: string;
  status: 'active' | 'inactive';
}

export interface Site {
  id: string;
  name: string;
  type: 'outsourced' | 'internal';
}

export interface Agent {
  id: string;
  userId?: string;
  name: string;
  siteId: string;
  siteName: string;
  active: boolean;
  avatarUrl?: string;
}

export interface Booking {
  id: string;
  moveInDate: Date;
  bookingDate: Date;
  memberName: string;
  bookingType: 'Inbound' | 'Outbound' | 'Referral';
  agentId: string;
  agentName: string;
  marketCity: string;
  marketState: string;
  communicationMethod: 'Phone' | 'SMS' | 'LC' | 'Email';
  status: 'Pending Move-In' | 'Moved In' | 'Member Rejected' | 'No Show' | 'Cancelled';
  notes?: string;
  hubspotLink?: string;
  kixieLink?: string;
  adminProfileLink?: string;
  moveInDayReachOut?: boolean;
  createdBy?: string;
  createdAt?: Date;
}

export interface DailyMetrics {
  date: Date;
  siteId?: string;
  agentId?: string;
  bookings: number;
  showups: number;
  rejects: number;
  calls?: number;
  talkTimeSeconds?: number;
}

export interface AccessLog {
  id: string;
  userId: string;
  userName: string;
  action: 'login' | 'logout' | 'view_dashboard' | 'export_csv' | 'role_change' | 'data_import';
  resource: string;
  createdAt: Date;
  ipAddress?: string;
}

export interface KPIData {
  label: string;
  value: number;
  previousValue: number;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
}

export interface ChartDataPoint {
  date: string;
  bookings: number;
  previousBookings?: number;
  vixicom?: number;
  padsplit?: number;
}

export interface LeaderboardEntry {
  rank: number;
  agentId: string;
  agentName: string;
  siteName: string;
  bookings: number;
  bookingsPerDay: number;
  pending: number;
  rejected: number;
  conversion?: number;
  change: number;
}

export interface FilterState {
  dateRange: {
    from: Date;
    to: Date;
  };
  sites: string[];
  agents: string[];
  status: string[];
}

export interface DisplayToken {
  id: string;
  name: string;
  token: string;
  createdAt: Date;
  expiresAt?: Date;
  siteFilter?: string;
}
