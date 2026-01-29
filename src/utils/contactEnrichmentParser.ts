import * as XLSX from 'xlsx';

export interface ContactRecord {
  name: string;
  email: string;
  phone: string;
}

export interface ContactParseResult {
  contacts: ContactRecord[];
  totalRows: number;
  withPhone: number;
  withEmail: number;
}

/**
 * Normalize phone number - strip non-digits
 */
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  // Remove all non-digit characters
  return phone.replace(/\D/g, '');
}

/**
 * Normalize email - lowercase and trim
 */
export function normalizeEmail(email: string | null | undefined): string {
  if (!email) return '';
  // Remove markdown-style links like <email>
  let cleaned = email.replace(/^<|>$/g, '');
  return cleaned.toLowerCase().trim();
}

/**
 * Detect column indices based on header row
 */
function detectColumns(headers: string[]): { nameCol: number; emailCol: number; phoneCol: number } {
  const lowerHeaders = headers.map(h => (h || '').toLowerCase().trim());
  
  let nameCol = -1;
  let emailCol = -1;
  let phoneCol = -1;
  
  for (let i = 0; i < lowerHeaders.length; i++) {
    const h = lowerHeaders[i];
    
    // Match "contact name", "name", "contact"
    if (nameCol === -1 && (h.includes('name') || h === 'contact')) {
      nameCol = i;
    }
    
    // Match "email", "e-mail"
    if (emailCol === -1 && h.includes('email')) {
      emailCol = i;
    }
    
    // Match "phone number", "phone", "mobile", "tel"
    if (phoneCol === -1 && (h.includes('phone') || h.includes('mobile') || h.includes('tel'))) {
      phoneCol = i;
    }
  }
  
  // Fallback: assume standard order if detection fails
  if (nameCol === -1 && headers.length >= 1) nameCol = 0;
  if (emailCol === -1 && headers.length >= 2) emailCol = 1;
  if (phoneCol === -1 && headers.length >= 3) phoneCol = 2;
  
  console.log('Detected columns:', { nameCol, emailCol, phoneCol, headers: lowerHeaders });
  
  return { nameCol, emailCol, phoneCol };
}

/**
 * Parse CSV content
 */
export function parseCSV(content: string): ContactParseResult {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  
  console.log('CSV parsing - Total lines:', lines.length);
  console.log('First line (headers):', lines[0]);
  if (lines[1]) console.log('Second line (first data):', lines[1]);
  
  if (lines.length === 0) {
    return { contacts: [], totalRows: 0, withPhone: 0, withEmail: 0 };
  }
  
  // Parse header row - handle quoted headers
  const headers = parseCSVRow(lines[0]);
  console.log('Parsed headers:', headers);
  
  const { nameCol, emailCol, phoneCol } = detectColumns(headers);
  
  const contacts: ContactRecord[] = [];
  let withPhone = 0;
  let withEmail = 0;
  
  for (let i = 1; i < lines.length; i++) {
    // Simple CSV parsing (handles quoted fields)
    const row = parseCSVRow(lines[i]);
    
    const name = row[nameCol] || '';
    const email = normalizeEmail(row[emailCol]);
    const phone = normalizePhone(row[phoneCol]);
    
    if (email) withEmail++;
    if (phone) withPhone++;
    
    contacts.push({ name, email, phone });
  }
  
  return {
    contacts,
    totalRows: lines.length - 1,
    withPhone,
    withEmail,
  };
}

/**
 * Parse a single CSV row handling quoted fields
 */
function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
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
 * Parse Excel file (xlsx/xls)
 */
export function parseExcel(buffer: ArrayBuffer): ContactParseResult {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
  
  if (data.length === 0) {
    return { contacts: [], totalRows: 0, withPhone: 0, withEmail: 0 };
  }
  
  const headers = (data[0] || []).map(h => String(h || ''));
  const { nameCol, emailCol, phoneCol } = detectColumns(headers);
  
  const contacts: ContactRecord[] = [];
  let withPhone = 0;
  let withEmail = 0;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i] || [];
    
    const name = String(row[nameCol] || '');
    const email = normalizeEmail(String(row[emailCol] || ''));
    const phone = normalizePhone(String(row[phoneCol] || ''));
    
    if (email) withEmail++;
    if (phone) withPhone++;
    
    contacts.push({ name, email, phone });
  }
  
  return {
    contacts,
    totalRows: data.length - 1,
    withPhone,
    withEmail,
  };
}

/**
 * Parse Numbers file (already parsed as JSON array from document parser)
 */
export function parseNumbersData(data: string[][]): ContactParseResult {
  if (data.length === 0) {
    return { contacts: [], totalRows: 0, withPhone: 0, withEmail: 0 };
  }
  
  const headers = data[0].map(h => String(h || ''));
  const { nameCol, emailCol, phoneCol } = detectColumns(headers);
  
  const contacts: ContactRecord[] = [];
  let withPhone = 0;
  let withEmail = 0;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i] || [];
    
    const name = String(row[nameCol] || '');
    const email = normalizeEmail(String(row[emailCol] || ''));
    const phone = normalizePhone(String(row[phoneCol] || ''));
    
    if (email) withEmail++;
    if (phone) withPhone++;
    
    contacts.push({ name, email, phone });
  }
  
  return {
    contacts,
    totalRows: data.length - 1,
    withPhone,
    withEmail,
  };
}

/**
 * Build email -> phone lookup map
 */
export function buildPhoneLookup(contacts: ContactRecord[]): Map<string, string> {
  const lookup = new Map<string, string>();
  
  for (const contact of contacts) {
    if (contact.email && contact.phone) {
      // Only add if not already present (first occurrence wins)
      if (!lookup.has(contact.email)) {
        lookup.set(contact.email, contact.phone);
      }
    }
  }
  
  return lookup;
}
