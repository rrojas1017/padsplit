export type UserRole = 'super_admin' | 'admin' | 'supervisor' | 'agent' | 'researcher';

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
  dialerAgentUser?: string;
}

export interface MemberDetails {
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  householdSize?: number | null;
  weeklyBudget?: number | null;
  moveInDate?: string | null;
  commitmentWeeks?: number | null;
  preferredPaymentMethod?: string | null;
  propertyAddress?: string | null;
  marketCity?: string | null;
  marketState?: string | null;
}

export interface BuyerIntent {
  score: number;           // 0-100
  intentLevel: 'hot' | 'warm' | 'cold';
  positiveSignals: string[];
  negativeSignals: string[];
  decisionMaker: boolean;
  timeframe: 'immediate' | 'this_week' | 'this_month' | 'exploring';
}

export interface LifestyleSignal {
  category: 'healthcare' | 'pet' | 'transportation' | 'home_services' | 'telephony' | 'employment' | 'financial' | 'moving';
  signal: string;
  confidence: 'high' | 'medium' | 'low';
  opportunity: string;
}

export interface CallKeyPoints {
  summary: string;
  memberConcerns: string[];
  memberPreferences: string[];
  recommendedActions: string[];
  objections: string[];
  moveInReadiness: 'high' | 'medium' | 'low';
  callSentiment: 'positive' | 'neutral' | 'negative';
  memberDetails?: MemberDetails;
  buyerIntent?: BuyerIntent; // Only present for Non-Booking calls
  lifestyleSignals?: LifestyleSignal[]; // Cross-sell/upsell opportunity signals
  pricingDiscussed?: {
    mentioned: boolean;
    details: string;
    agentInitiated: boolean;
    quotedRoomPrice?: number | null;
  };
}

export interface AgentFeedback {
  overallRating: 'excellent' | 'good' | 'needs_improvement' | 'poor';
  strengths: string[];
  improvements: string[];
  coachingTips: string[];
  scores: {
    communication: number; // 1-10
    productKnowledge: number; // 1-10
    objectionHandling: number; // 1-10
    closingSkills: number; // 1-10
  };
}

export interface Booking {
  id: string;
  moveInDate: Date;
  bookingDate: Date;
  memberName: string;
  bookingType: 'Inbound' | 'Outbound' | 'Referral' | 'Research';
  agentId: string;
  agentName: string;
  marketCity: string;
  marketState: string;
  communicationMethod: 'Phone' | 'SMS' | 'LC' | 'Email';
  status: 'Pending Move-In' | 'Moved In' | 'Member Rejected' | 'No Show' | 'Cancelled' | 'Postponed' | 'Non Booking' | 'Research';
  notes?: string;
  hubspotLink?: string;
  kixieLink?: string;
  adminProfileLink?: string;
  moveInDayReachOut?: boolean;
  createdBy?: string;
  createdAt?: Date;
  // Rebooking tracking
  isRebooking?: boolean;
  originalBookingId?: string;
  // Call transcription fields
  callTranscription?: string;
  callSummary?: string;
  callKeyPoints?: CallKeyPoints;
  transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'unavailable';
  transcriptionErrorMessage?: string;
  transcribedAt?: Date;
  callDurationSeconds?: number;
  // Agent feedback from transcription analysis
  agentFeedback?: AgentFeedback;
  // Coaching audio fields
  coachingAudioUrl?: string;
  coachingAudioGeneratedAt?: Date;
  callTypeId?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  // Email verification fields
  emailVerified?: boolean | null;
  emailVerifiedAt?: Date | null;
  emailVerificationStatus?: 'valid' | 'invalid' | 'disposable' | 'catch_all' | 'unknown' | null;
  // Conversation validity flag - detects voicemails/failed connections
  hasValidConversation?: boolean | null;
  // Research record fields
  recordType?: 'booking' | 'research';
  researchCallId?: string;
  // Pain point issue tagging (JSONB - array of DetectedIssueDetail objects or legacy strings)
  detectedIssues?: any[];
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
  comparisonLabel?: string;
  subtitle?: string;
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
  newBookings: number;
  rebookings: number;
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
