import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Phone, Calendar, Clock, User, AlertTriangle } from 'lucide-react';
import { ParsedCallRecord } from '@/utils/hubspotCallParser';
import { format } from 'date-fns';

interface ImportClassificationSummaryProps {
  records: ParsedCallRecord[];
  bookingCount: number;
  nonBookingCount: number;
  duplicateCount: number;
  errors: string[];
}

export function ImportClassificationSummary({
  records,
  bookingCount,
  nonBookingCount,
  duplicateCount,
  errors,
}: ImportClassificationSummaryProps) {
  const sampleRecords = records.slice(0, 5);
  
  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{records.length}</div>
            <div className="text-sm text-muted-foreground">Total Records</div>
          </CardContent>
        </Card>
        
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-warning" />
              <div className="text-2xl font-bold text-warning">{bookingCount}</div>
            </div>
            <div className="text-sm text-muted-foreground">Bookings</div>
            <div className="text-xs text-muted-foreground mt-1">Status: Pending Move-In</div>
          </CardContent>
        </Card>
        
        <Card className="border-slate-500/30 bg-slate-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-slate-500" />
              <div className="text-2xl font-bold text-slate-500">{nonBookingCount}</div>
            </div>
            <div className="text-sm text-muted-foreground">Non-Bookings</div>
            <div className="text-xs text-muted-foreground mt-1">Status: Non Booking</div>
          </CardContent>
        </Card>
        
        <Card className={duplicateCount > 0 ? "border-destructive/30 bg-destructive/5" : ""}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${duplicateCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
              <div className={`text-2xl font-bold ${duplicateCount > 0 ? 'text-destructive' : ''}`}>
                {duplicateCount}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">Duplicates</div>
            <div className="text-xs text-muted-foreground mt-1">Will be skipped</div>
          </CardContent>
        </Card>
      </div>
      
      {/* Parse Errors */}
      {errors.length > 0 && (
        <Card className="border-destructive/30">
          <CardContent className="pt-4">
            <h4 className="font-medium text-destructive mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Parse Warnings ({errors.length})
            </h4>
            <div className="text-sm text-muted-foreground space-y-1 max-h-24 overflow-y-auto">
              {errors.slice(0, 5).map((error, i) => (
                <div key={i}>{error}</div>
              ))}
              {errors.length > 5 && (
                <div className="text-xs">...and {errors.length - 5} more</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Sample Records Preview */}
      <Card>
        <CardContent className="pt-4">
          <h4 className="font-medium mb-3">Sample Records Preview</h4>
          <div className="space-y-2">
            {sampleRecords.map((record, i) => (
              <div key={i} className="flex items-center gap-3 py-2 px-3 bg-muted/30 rounded-lg text-sm">
                <Badge 
                  variant="outline" 
                  className={record.status === 'Pending Move-In' 
                    ? 'bg-warning/20 text-warning border-warning/30' 
                    : 'bg-slate-500/20 text-slate-500 border-slate-500/30'
                  }
                >
                  {record.status === 'Pending Move-In' ? 'Booking' : 'Non Booking'}
                </Badge>
                
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span>{format(record.activityDate, 'MMM d, yyyy')}</span>
                </div>
                
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <User className="w-3 h-3 text-muted-foreground" />
                  <span className="truncate">{record.contactName}</span>
                </div>
                
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{Math.floor(record.callDurationSeconds / 60)}m</span>
                </div>
                
                <Badge variant="outline" className="text-xs">
                  {record.bookingType}
                </Badge>
                
                {record.recordingUrl && (
                  <CheckCircle className="w-3 h-3 text-success" />
                )}
              </div>
            ))}
          </div>
          {records.length > 5 && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Showing 5 of {records.length} records
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
