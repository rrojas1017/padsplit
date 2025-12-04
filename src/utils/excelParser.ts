import * as XLSX from 'xlsx';

export interface ParsedBooking {
  moveInDate: string;
  bookingDate: string;
  memberName: string;
  bookingType: string;
  agentName: string;
  hubspotLink: string;
  kixieLink: string;
  adminProfileLink: string;
  marketCity: string;
  marketState: string;
  communicationMethod: string;
  moveInDayReachOut: boolean;
  status: string;
  notes: string;
  isValid: boolean;
  errors: string[];
}

export interface SheetInfo {
  name: string;
  rows: number;
}

export interface ParseResult {
  bookings: ParsedBooking[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  sheets: SheetInfo[];
}

const normalizeAgentName = (rawName: string): string => {
  if (!rawName) return '';
  // Extract name from "TBA X Name" format
  const match = rawName.match(/TBA\s*\d*\s*(.+)/i);
  if (match) {
    return match[1].trim();
  }
  return rawName.trim();
};

const parseMarket = (market: string): { city: string; state: string } => {
  if (!market) return { city: '', state: '' };
  
  // Handle formats like "Atlanta, GA" or "Hidden Valley, Charlotte, NC"
  const parts = market.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    const state = parts[parts.length - 1].trim().toUpperCase();
    const city = parts.slice(0, -1).join(', ').trim();
    return { city, state };
  }
  return { city: market.trim(), state: '' };
};

const normalizeCommunicationMethod = (method: string): string => {
  if (!method) return 'Phone';
  
  const lower = method.toLowerCase();
  if (lower.includes('sms') && !lower.includes('phone')) return 'SMS';
  if (lower.includes('lc') || lower.includes('live chat')) return 'LC';
  if (lower.includes('email')) return 'Email';
  return 'Phone';
};

const normalizeStatus = (status: string): string => {
  if (!status) return 'Pending Move-In';
  
  // Handle comma-separated statuses - take the last/final one
  const statuses = status.split(',').map(s => s.trim());
  const finalStatus = statuses[statuses.length - 1];
  
  const statusMap: Record<string, string> = {
    'pending move-in': 'Pending Move-In',
    'pending': 'Pending Move-In',
    'moved in': 'Moved In',
    'movedin': 'Moved In',
    'member rejected': 'Member Rejected',
    'rejected': 'Member Rejected',
    'no show': 'No Show',
    'noshow': 'No Show',
    'cancelled': 'Cancelled',
    'canceled': 'Cancelled',
  };
  
  const normalized = statusMap[finalStatus.toLowerCase()];
  return normalized || 'Pending Move-In';
};

const parseExcelDate = (value: any): string => {
  if (!value) return '';
  
  // If it's already a string date
  if (typeof value === 'string') {
    // Try parsing M/D/YYYY or MM/DD/YYYY format
    const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      const [, month, day, year] = match;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return value;
  }
  
  // If it's an Excel serial date number
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
  }
  
  return '';
};

const normalizeBookingType = (type: string): string => {
  if (!type) return 'Inbound';
  
  const lower = type.toLowerCase();
  if (lower.includes('outbound')) return 'Outbound';
  if (lower.includes('referral')) return 'Referral';
  return 'Inbound';
};

export const parseExcelFile = async (file: File): Promise<ParseResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        
        const bookings: ParsedBooking[] = [];
        const sheetInfos: SheetInfo[] = [];
        
        // Process sheets that contain booking data (look for "booking" or "tracker" in name)
        const sheetsToProcess = workbook.SheetNames.filter(name => {
          const lower = name.toLowerCase();
          const isBookingSheet = lower.includes('booking') || lower.includes('tracker');
          const isDecember = lower.includes('december');
          const isExcluded = lower.includes('call') || lower.includes('promo') || lower.includes('agent');
          return isBookingSheet && isDecember && !isExcluded;
        });
        
        console.log('All sheet names in file:', workbook.SheetNames);
        console.log('Found booking sheets:', sheetsToProcess);
        
        for (const sheetName of sheetsToProcess) {
          const sheet = workbook.Sheets[sheetName];
          let sheetRowCount = 0;
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
          
          // Find header row
          let headerRowIndex = -1;
          let headers: string[] = [];
          
          for (let i = 0; i < Math.min(10, jsonData.length); i++) {
            const row = jsonData[i] as string[];
            if (row && row.some(cell => 
              cell && (
                cell.toString().toLowerCase().includes('move-in date') ||
                cell.toString().toLowerCase().includes('member name') ||
                cell.toString().toLowerCase().includes('booking date')
              )
            )) {
              headerRowIndex = i;
              headers = row.map(h => (h || '').toString().toLowerCase().trim());
              break;
            }
          }
          
          if (headerRowIndex === -1) continue;
          
          // Map column indices
          const colMap: Record<string, number> = {};
          headers.forEach((header, index) => {
            if (header.includes('move-in date') || header.includes('move in date')) colMap.moveInDate = index;
            if (header.includes('booking date')) colMap.bookingDate = index;
            if (header.includes('member name')) colMap.memberName = index;
            if (header.includes('booking type')) colMap.bookingType = index;
            if (header.includes('agent') && !header.includes('profile')) colMap.agent = index;
            if (header.includes('member hs') || header.includes('hubspot')) colMap.hubspotLink = index;
            if (header.includes('kixie') || header.includes('recording')) colMap.kixieLink = index;
            if (header.includes('admin profile')) colMap.adminProfileLink = index;
            if (header.includes('market')) colMap.market = index;
            if (header.includes('communication')) colMap.communicationMethod = index;
            if (header.includes('beginning of shift') || header.includes('reach out')) colMap.reachOut = index;
            if (header.includes('status')) colMap.status = index;
            if (header.includes('notes')) colMap.notes = index;
          });
          
          // Process data rows
          for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            if (!row || row.length === 0) continue;
            
            const memberName = row[colMap.memberName]?.toString().trim() || '';
            if (!memberName) continue; // Skip empty rows
            
            const errors: string[] = [];
            
            const moveInDate = parseExcelDate(row[colMap.moveInDate]);
            const bookingDate = parseExcelDate(row[colMap.bookingDate]);
            const agentName = normalizeAgentName(row[colMap.agent]?.toString() || '');
            const market = parseMarket(row[colMap.market]?.toString() || '');
            const status = normalizeStatus(row[colMap.status]?.toString() || '');
            const bookingType = normalizeBookingType(row[colMap.bookingType]?.toString() || '');
            const communicationMethod = normalizeCommunicationMethod(row[colMap.communicationMethod]?.toString() || '');
            
            // Validation
            if (!moveInDate) errors.push('Invalid move-in date');
            if (!bookingDate) errors.push('Invalid booking date');
            if (!agentName) errors.push('Missing agent name');
            
            bookings.push({
              moveInDate,
              bookingDate,
              memberName,
              bookingType,
              agentName,
              hubspotLink: row[colMap.hubspotLink]?.toString() || '',
              kixieLink: row[colMap.kixieLink]?.toString() || '',
              adminProfileLink: row[colMap.adminProfileLink]?.toString() || '',
              marketCity: market.city,
              marketState: market.state,
              communicationMethod,
              moveInDayReachOut: !!row[colMap.reachOut],
              status,
              notes: row[colMap.notes]?.toString() || '',
              isValid: errors.length === 0,
              errors,
            });
            sheetRowCount++;
          }
          
          console.log(`Sheet "${sheetName}": ${sheetRowCount} rows`);
          sheetInfos.push({ name: sheetName, rows: sheetRowCount });
        }
        
        resolve({
          bookings,
          totalRows: bookings.length,
          validRows: bookings.filter(b => b.isValid).length,
          invalidRows: bookings.filter(b => !b.isValid).length,
          sheets: sheetInfos,
        });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};
