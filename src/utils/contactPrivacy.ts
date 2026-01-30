/**
 * Contact Privacy Utilities
 * 
 * Provides masking functions for email and phone to protect contact privacy
 * for agent-role users while keeping action buttons functional.
 */

/**
 * Mask email: show first 3 chars + *** + @ + domain
 * Example: jason.smith@gmail.com → jas***@gmail.com
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  
  const [local, domain] = email.split('@');
  const visibleChars = Math.min(3, Math.max(1, local.length - 1));
  return `${local.slice(0, visibleChars)}***@${domain}`;
}

/**
 * Mask phone: show first 3 digits + *** + last 4 digits
 * Example: 678-463-1178 → 678-***-1178
 */
export function maskPhone(phone: string): string {
  if (!phone) return phone;
  
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    return `${digits.slice(0, 3)}-***-${digits.slice(-4)}`;
  }
  return '***-***-****';
}

/**
 * Check if user should see masked contact info based on their role
 * Only 'agent' role sees masked data; all other roles see full data
 */
export function shouldMaskContactInfo(userRole: string | undefined): boolean {
  return userRole === 'agent';
}
