import { differenceInDays, parseISO, isValid } from 'date-fns';
import { CallKeyPoints } from '@/types';

export type PriorityLevel = 'urgent' | 'high' | 'medium' | 'low' | null;

export interface FollowUpPriority {
  level: PriorityLevel;
  reason: string;
}

export interface BookingForPriority {
  status: string;
  moveInDate: Date;
  bookingDate: Date;
  callKeyPoints?: CallKeyPoints;
  transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'unavailable';
}

// Statuses that are closed/completed - no follow-up needed
const CLOSED_STATUSES = ['Moved In', 'Cancelled', 'No Show', 'Member Rejected'];

// Statuses that need follow-up
const ACTIONABLE_STATUSES = ['Pending Move-In', 'Postponed', 'Non Booking'];

/**
 * Calculate the follow-up priority for a booking based on:
 * - Status (closed statuses return null)
 * - Move-in readiness from transcription insights
 * - Objections and concerns
 * - Move-in date proximity
 * - Last contact date
 */
export function calculateFollowUpPriority(
  booking: BookingForPriority,
  lastContactDate?: Date | null
): FollowUpPriority {
  // Closed/completed statuses never need follow-up
  if (CLOSED_STATUSES.includes(booking.status)) {
    return { level: null, reason: '' };
  }

  // Only calculate for actionable statuses
  if (!ACTIONABLE_STATUSES.includes(booking.status)) {
    return { level: null, reason: '' };
  }

  const now = new Date();
  const daysSinceContact = lastContactDate 
    ? differenceInDays(now, lastContactDate) 
    : differenceInDays(now, booking.bookingDate); // Fall back to booking date if no contact logged

  const readiness = booking.callKeyPoints?.moveInReadiness;
  const hasObjections = (booking.callKeyPoints?.objections?.length || 0) > 0;
  const hasConcerns = (booking.callKeyPoints?.memberConcerns?.length || 0) > 0;
  const hasInsights = booking.transcriptionStatus === 'completed' && booking.callKeyPoints;

  // Calculate days until move-in for Pending Move-In status
  let daysUntilMoveIn: number | null = null;
  if (booking.status === 'Pending Move-In' && booking.moveInDate) {
    daysUntilMoveIn = differenceInDays(booking.moveInDate, now);
  }

  // 🔴 URGENT Priority Logic
  // 1. High readiness + no contact in 5+ days (hot lead going cold)
  if (readiness === 'high' && daysSinceContact >= 5) {
    return { 
      level: 'urgent', 
      reason: `High readiness, no contact in ${daysSinceContact} days` 
    };
  }

  // 2. Pending Move-In with move-in within 3 days and no recent contact
  if (booking.status === 'Pending Move-In' && daysUntilMoveIn !== null && daysUntilMoveIn <= 3 && daysUntilMoveIn >= 0 && daysSinceContact >= 1) {
    return { 
      level: 'urgent', 
      reason: `Move-in in ${daysUntilMoveIn} day${daysUntilMoveIn !== 1 ? 's' : ''}, needs confirmation` 
    };
  }

  // NOTE: Objections removed from URGENT - transcription AI captures all mentioned objections,
  // including resolved ones. For Pending Move-In, member booked = objections were addressed.

  // 🟠 HIGH Priority Logic
  // 1. High readiness with recent contact (1-4 days) - maintain momentum
  if (readiness === 'high' && daysSinceContact >= 1 && daysSinceContact < 5) {
    return { 
      level: 'high', 
      reason: 'High readiness, maintain engagement' 
    };
  }

  // 2. Non-Booking with objections - recovery opportunity (objections likely unresolved)
  if (booking.status === 'Non Booking' && hasObjections && daysSinceContact >= 3) {
    return { 
      level: 'high', 
      reason: 'Non-booking with objections to address' 
    };
  }

  // 3. Non-Booking with high readiness - recovery opportunity
  if (booking.status === 'Non Booking' && readiness === 'high') {
    return { 
      level: 'high', 
      reason: 'High-readiness recovery opportunity' 
    };
  }

  // 4. Medium readiness with unresolved concerns
  if (readiness === 'medium' && hasConcerns) {
    return { 
      level: 'high', 
      reason: 'Medium readiness with concerns to address' 
    };
  }

  // 5. Pending Move-In approaching (4-7 days out) without recent contact
  if (booking.status === 'Pending Move-In' && daysUntilMoveIn !== null && daysUntilMoveIn > 3 && daysUntilMoveIn <= 7 && daysSinceContact >= 2) {
    return { 
      level: 'high', 
      reason: `Move-in in ${daysUntilMoveIn} days, follow up recommended` 
    };
  }

  // 🟡 MEDIUM Priority Logic
  // 1. Medium readiness without recent follow-up (5+ days)
  if (readiness === 'medium' && daysSinceContact >= 5) {
    return { 
      level: 'medium', 
      reason: 'Medium readiness, re-engage this week' 
    };
  }

  // 2. Has preferences captured but no recent follow-up
  if (hasInsights && (booking.callKeyPoints?.memberPreferences?.length || 0) > 0 && daysSinceContact >= 4) {
    return { 
      level: 'medium', 
      reason: 'Has preferences, follow up this week' 
    };
  }

  // 3. Postponed status - periodic check-in
  if (booking.status === 'Postponed' && daysSinceContact >= 5) {
    return { 
      level: 'medium', 
      reason: 'Postponed, time to check in' 
    };
  }

  // ⚪ LOW / No Badge
  // - Low readiness, just exploring
  // - Recently contacted (within 24 hours)
  // - No call insights available
  if (readiness === 'low') {
    return { level: 'low', reason: 'Low readiness, exploring options' };
  }

  if (daysSinceContact === 0) {
    return { level: 'low', reason: 'Recently contacted' };
  }

  if (!hasInsights && booking.status !== 'Non Booking') {
    return { level: 'low', reason: 'No call insights available' };
  }

  // Default: no specific priority
  return { level: null, reason: '' };
}

/**
 * Check if a status is actionable (needs potential follow-up)
 */
export function isActionableStatus(status: string): boolean {
  return ACTIONABLE_STATUSES.includes(status);
}

/**
 * Get display configuration for a priority level
 */
export function getPriorityConfig(level: PriorityLevel) {
  switch (level) {
    case 'urgent':
      return {
        label: 'URGENT',
        className: 'bg-destructive/20 text-destructive border-destructive/30',
        iconName: 'AlertTriangle' as const,
      };
    case 'high':
      return {
        label: 'HIGH',
        className: 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30',
        iconName: 'ArrowUp' as const,
      };
    case 'medium':
      return {
        label: 'MEDIUM',
        className: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
        iconName: 'Clock' as const,
      };
    default:
      return null;
  }
}
