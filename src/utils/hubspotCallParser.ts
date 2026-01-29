/**
 * HubSpot Call Recording CSV Parser
 * 
 * Parses HubSpot-exported call recording data and classifies records
 * as bookings or non-bookings based on call outcome.
 */

export interface ParsedCallRecord {
  recordId: string;
  activityDate: Date;
  agentName: string;
  recordingUrl: string | null;
  contactName: string;
  contactEmail: string | null;
  callOutcome: string;
  callDurationSeconds: number;
  callDirection: string;
  callSummary: string | null;
  hubspotLink: string;
  // Classified fields
  status: 'Pending Move-In' | 'Non Booking';
  bookingType: 'Inbound' | 'Outbound';
}

export interface ParseResult {
  records: ParsedCallRecord[];
  bookingCount: number;
  nonBookingCount: number;
  errors: string[];
  uniqueAgentNames: string[];
}

// Call outcomes that indicate a booking was made
const BOOKING_OUTCOMES = [
  'booking call',
  '24-hour booking',
  '24 hour booking',
  'booking',
  'booked',
];

/**
 * Parse date from M/D/YY or MM/DD/YYYY format
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // Handle M/D/YY format
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    let [month, day, year] = parts.map(p => parseInt(p, 10));
    
    // Handle 2-digit year
    if (year < 100) {
      year += year < 50 ? 2000 : 1900;
    }
    
    return new Date(year, month - 1, day);
  }
  
  // Fallback to native parsing
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Parse duration from HH:mm:ss format to seconds
 */
function parseDuration(durationStr: string): number {
  if (!durationStr) return 0;
  
  const parts = durationStr.split(':').map(p => parseInt(p, 10) || 0);
  
  if (parts.length === 3) {
    // HH:mm:ss
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // mm:ss
    return parts[0] * 60 + parts[1];
  }
  
  return 0;
}

/**
 * Extract name from "Name (email)" format
 */
function parseContactName(contactStr: string): { name: string; email: string | null } {
  if (!contactStr) return { name: 'Unknown', email: null };
  
  // Check for "Name (email)" format
  const match = contactStr.match(/^(.+?)\s*\(([^)]+@[^)]+)\)$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  
  // Check if it's just an email
  if (contactStr.includes('@')) {
    const emailPart = contactStr.split('@')[0];
    return { name: emailPart, email: contactStr };
  }
  
  return { name: contactStr.trim(), email: null };
}

/**
 * Strip HTML tags from string
 */
function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

/**
 * Construct HubSpot activity link from record ID
 */
function constructHubspotLink(recordId: string): string {
  // Convert scientific notation to full number if needed
  let id = recordId;
  if (recordId.includes('E') || recordId.includes('e')) {
    const num = parseFloat(recordId);
    if (!isNaN(num)) {
      id = num.toFixed(0);
    }
  }
  return `https://app.hubspot.com/contacts/activities/${id}`;
}

/**
 * Classify call outcome as booking or non-booking
 */
function classifyOutcome(outcome: string): 'Pending Move-In' | 'Non Booking' {
  const normalizedOutcome = (outcome || '').toLowerCase().trim();
  
  for (const bookingOutcome of BOOKING_OUTCOMES) {
    if (normalizedOutcome.includes(bookingOutcome)) {
      return 'Pending Move-In';
    }
  }
  
  return 'Non Booking';
}

/**
 * Parse CSV content with proper handling of quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * Detect and fix malformed single-line CSV exports from HubSpot
 * HubSpot sometimes exports all records concatenated without line breaks
 */
function fixMalformedCSV(csvContent: string): string {
  // Handle Windows line breaks
  const normalizedContent = csvContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Check if CSV appears properly formatted (more than 2 lines)
  const lines = normalizedContent.split('\n').filter(line => line.trim());
  if (lines.length > 2) {
    return normalizedContent;
  }
  
  // Find the header row - look for "Associated Contact" which is typically last column
  const headerMatch = normalizedContent.match(/Associated Contact[s]?(?: IDs?)?/i);
  if (!headerMatch || headerMatch.index === undefined) {
    // Can't identify header, return as-is
    return normalizedContent;
  }
  
  // Find where the header ends (need to find the actual end of header row)
  // The header ends where the first data record begins
  // Records start with a Record ID pattern: scientific notation (1.02E+11) or 11+ digits
  const headerEndSearch = normalizedContent.substring(headerMatch.index);
  const firstRecordMatch = headerEndSearch.match(/(?:IDs?)?[,\s]*(\d+\.\d+E\+\d+|\d{11,}),\d{1,2}\//);
  
  if (!firstRecordMatch || firstRecordMatch.index === undefined) {
    return normalizedContent;
  }
  
  // Calculate positions
  const headerEndPos = headerMatch.index + firstRecordMatch.index + (firstRecordMatch[0].match(/IDs?/i)?.[0]?.length || 0);
  const headerRow = normalizedContent.substring(0, headerEndPos).replace(/IDs?$/i, 'IDs');
  const dataPortion = normalizedContent.substring(headerEndPos).trim();
  
  // Split on Record ID patterns - look for patterns like "1.02E+11,1/15/25" or "102000000000,1/15/25"
  // Use lookahead to keep the delimiter in the result
  const recordSplitPattern = /(?=\d+\.\d+E\+\d+,\d{1,2}\/)|(?=\d{11,},\d{1,2}\/)/g;
  const recordChunks = dataPortion.split(recordSplitPattern).filter(chunk => chunk.trim());
  
  if (recordChunks.length <= 1) {
    // Couldn't split, return as-is
    return normalizedContent;
  }
  
  // Reconstruct CSV with proper line breaks
  let fixedContent = headerRow;
  for (const record of recordChunks) {
    const trimmedRecord = record.trim();
    if (trimmedRecord) {
      fixedContent += '\n' + trimmedRecord;
    }
  }
  
  console.log(`Fixed malformed CSV: split into ${recordChunks.length} records`);
  return fixedContent;
}

/**
 * Parse HubSpot CSV content
 */
export function parseHubspotCSV(csvContent: string): ParseResult {
  const errors: string[] = [];
  const records: ParsedCallRecord[] = [];
  const agentNames = new Set<string>();
  
  // FIRST: Try to fix malformed single-line CSV
  const fixedContent = fixMalformedCSV(csvContent);
  
  // Split into lines
  let lines = fixedContent.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    errors.push('CSV file appears to be empty or has no data rows');
    return { records, bookingCount: 0, nonBookingCount: 0, errors, uniqueAgentNames: [] };
  }
  
  // Parse header row
  const headerRow = parseCSVLine(lines[0]);
  const headers = headerRow.map(h => h.toLowerCase().replace(/['"]/g, '').trim());
  
  // Find column indices
  const columnMap: Record<string, number> = {
    recordId: headers.findIndex(h => h.includes('record id')),
    activityDate: headers.findIndex(h => h.includes('activity date')),
    agentName: headers.findIndex(h => h.includes('activity assigned to') || h.includes('assigned to')),
    recordingUrl: headers.findIndex(h => h.includes('recording url') || h.includes('recording')),
    contact: headers.findIndex(h => h.includes('associated contact') || h.includes('contact')),
    callOutcome: headers.findIndex(h => h.includes('call outcome') || h.includes('outcome')),
    callDuration: headers.findIndex(h => h.includes('call duration') || h.includes('duration')),
    callDirection: headers.findIndex(h => h.includes('call direction') || h.includes('direction')),
    callSummary: headers.findIndex(h => h.includes('call summary') || h.includes('summary')),
  };
  
  // Check required columns
  const requiredColumns = ['recordId', 'activityDate', 'agentName'];
  for (const col of requiredColumns) {
    if (columnMap[col] === -1) {
      errors.push(`Missing required column: ${col}`);
    }
  }
  
  if (errors.length > 0 && errors.some(e => e.includes('Missing required'))) {
    return { records, bookingCount: 0, nonBookingCount: 0, errors, uniqueAgentNames: [] };
  }
  
  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    try {
      const row = parseCSVLine(lines[i]);
      
      if (row.length < 3) continue; // Skip empty/invalid rows
      
      const recordId = row[columnMap.recordId] || '';
      const dateStr = row[columnMap.activityDate] || '';
      const agentName = row[columnMap.agentName] || '';
      const recordingUrl = columnMap.recordingUrl >= 0 ? row[columnMap.recordingUrl] : null;
      const contactStr = columnMap.contact >= 0 ? row[columnMap.contact] : '';
      const callOutcome = columnMap.callOutcome >= 0 ? row[columnMap.callOutcome] : '';
      const durationStr = columnMap.callDuration >= 0 ? row[columnMap.callDuration] : '';
      const callDirection = columnMap.callDirection >= 0 ? row[columnMap.callDirection] : '';
      const callSummary = columnMap.callSummary >= 0 ? row[columnMap.callSummary] : '';
      
      // Parse date
      const activityDate = parseDate(dateStr);
      if (!activityDate) {
        errors.push(`Row ${i + 1}: Invalid date format "${dateStr}"`);
        continue;
      }
      
      // Track agent names
      if (agentName) {
        agentNames.add(agentName.trim());
      }
      
      // Parse contact
      const { name: contactName, email: contactEmail } = parseContactName(contactStr);
      
      // Classify the record
      const status = classifyOutcome(callOutcome);
      const bookingType: 'Inbound' | 'Outbound' = 
        callDirection.toLowerCase().includes('outbound') ? 'Outbound' : 'Inbound';
      
      records.push({
        recordId: recordId.trim(),
        activityDate,
        agentName: agentName.trim(),
        recordingUrl: recordingUrl?.trim() || null,
        contactName,
        contactEmail,
        callOutcome: callOutcome.trim(),
        callDurationSeconds: parseDuration(durationStr),
        callDirection: callDirection.trim(),
        callSummary: stripHtml(callSummary),
        hubspotLink: constructHubspotLink(recordId),
        status,
        bookingType,
      });
    } catch (err) {
      errors.push(`Row ${i + 1}: Parse error - ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }
  
  // Calculate counts
  const bookingCount = records.filter(r => r.status === 'Pending Move-In').length;
  const nonBookingCount = records.filter(r => r.status === 'Non Booking').length;
  
  return {
    records,
    bookingCount,
    nonBookingCount,
    errors,
    uniqueAgentNames: Array.from(agentNames).sort(),
  };
}

/**
 * Convert parsed record to booking insert format
 */
export function toBookingInsert(
  record: ParsedCallRecord,
  agentId: string
): Record<string, unknown> {
  return {
    agent_id: agentId,
    booking_date: record.activityDate.toISOString().split('T')[0],
    move_in_date: record.activityDate.toISOString().split('T')[0],
    member_name: record.contactName,
    booking_type: record.bookingType,
    status: record.status,
    communication_method: 'Phone',
    kixie_link: record.recordingUrl,
    hubspot_link: record.hubspotLink,
    call_duration_seconds: record.callDurationSeconds,
    notes: record.callSummary,
    transcription_status: null,
  };
}
