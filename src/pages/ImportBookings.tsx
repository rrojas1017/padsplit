import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAgents } from '@/contexts/AgentsContext';
import { useBookings } from '@/contexts/BookingsContext';
import { parseExcelFile, ParsedBooking, ParseResult } from '@/utils/excelParser';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ImportBookings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { agents } = useAgents();
  const { addBooking } = useBookings();
  
  const [isDragging, setIsDragging] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; failed: number } | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processFile(files[0]);
    }
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  }, []);

  const processFile = async (file: File) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    
    if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an Excel file (.xlsx or .xls)',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    setParseResult(null);
    setImportResults(null);

    try {
      const result = await parseExcelFile(file);
      setParseResult(result);
      
      toast({
        title: 'File parsed successfully',
        description: `Found ${result.totalRows} bookings (${result.validRows} valid, ${result.invalidRows} with issues)`,
      });
    } catch (error) {
      console.error('Parse error:', error);
      toast({
        title: 'Failed to parse file',
        description: 'Please check the file format and try again',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const findAgentId = (agentName: string): string | null => {
    const agent = agents.find(a => 
      a.name.toLowerCase() === agentName.toLowerCase()
    );
    return agent?.id || null;
  };

  const handleImport = async () => {
    if (!parseResult) return;

    const validBookings = parseResult.bookings.filter(b => b.isValid);
    if (validBookings.length === 0) {
      toast({
        title: 'No valid bookings',
        description: 'Please fix the validation errors before importing',
        variant: 'destructive',
      });
      return;
    }

    // Check for missing agents
    const missingAgents = new Set<string>();
    validBookings.forEach(b => {
      if (!findAgentId(b.agentName)) {
        missingAgents.add(b.agentName);
      }
    });

    if (missingAgents.size > 0) {
      toast({
        title: 'Missing agents',
        description: `These agents need to be created first: ${Array.from(missingAgents).join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    let success = 0;
    let failed = 0;

    for (let i = 0; i < validBookings.length; i++) {
      const booking = validBookings[i];
      const agentId = findAgentId(booking.agentName);

      if (!agentId) {
        failed++;
        continue;
      }

      try {
        await addBooking({
          moveInDate: new Date(booking.moveInDate),
          bookingDate: new Date(booking.bookingDate),
          memberName: booking.memberName,
          bookingType: booking.bookingType as 'Inbound' | 'Outbound' | 'Referral',
          agentId,
          agentName: booking.agentName,
          marketCity: booking.marketCity,
          marketState: booking.marketState,
          communicationMethod: booking.communicationMethod as 'Phone' | 'SMS' | 'LC' | 'Email',
          status: booking.status as any,
          notes: booking.notes,
          hubspotLink: booking.hubspotLink,
          kixieLink: booking.kixieLink,
          adminProfileLink: booking.adminProfileLink,
          moveInDayReachOut: booking.moveInDayReachOut,
        });
        success++;
      } catch (error) {
        console.error('Failed to import booking:', error);
        failed++;
      }

      setImportProgress(Math.round(((i + 1) / validBookings.length) * 100));
    }

    setIsImporting(false);
    setImportResults({ success, failed });

    toast({
      title: 'Import complete',
      description: `Successfully imported ${success} bookings${failed > 0 ? `, ${failed} failed` : ''}`,
      variant: failed > 0 ? 'destructive' : 'default',
    });
  };

  const getAgentStatus = (agentName: string) => {
    const found = findAgentId(agentName);
    return found ? 'found' : 'missing';
  };

  return (
    <DashboardLayout
      title="Import Bookings"
      subtitle="Upload an Excel file to bulk import bookings"
    >
      <div className="space-y-6">
        {/* Upload Zone */}
        {!parseResult && (
          <Card>
            <CardHeader>
              <CardTitle>Upload Excel File</CardTitle>
              <CardDescription>
                Drag and drop your booking tracker Excel file or click to browse
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer",
                  isDragging 
                    ? "border-primary bg-primary/5" 
                    : "border-muted-foreground/25 hover:border-primary/50",
                  isProcessing && "pointer-events-none opacity-50"
                )}
              >
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                  disabled={isProcessing}
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  {isProcessing ? (
                    <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  )}
                  <p className="text-lg font-medium mb-2">
                    {isProcessing ? 'Processing...' : 'Drop your Excel file here'}
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    or click to browse
                  </p>
                  <Button variant="outline" disabled={isProcessing}>
                    <Upload className="w-4 h-4 mr-2" />
                    Select File
                  </Button>
                </label>
              </div>

              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Expected Columns:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Move-In Date, Booking Date, Member Name, Booking Type</li>
                  <li>• Agent, Member HS (HubSpot), Kixie Recording/Chat Link</li>
                  <li>• Admin Profile Link, Market (city, state)</li>
                  <li>• Communication Method, Status, Notes</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Parse Results */}
        {parseResult && (
          <>
            {/* Summary */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Import Preview</CardTitle>
                  <CardDescription>
                    Review the parsed data before importing
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setParseResult(null);
                      setImportResults(null);
                    }}
                  >
                    Upload Different File
                  </Button>
                  <Button 
                    onClick={handleImport} 
                    disabled={isImporting || parseResult.validRows === 0}
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Import {parseResult.validRows} Bookings
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{parseResult.totalRows}</p>
                    <p className="text-sm text-muted-foreground">Total Rows</p>
                  </div>
                  <div className="p-4 rounded-lg bg-green-500/10">
                    <p className="text-2xl font-bold text-green-600">{parseResult.validRows}</p>
                    <p className="text-sm text-muted-foreground">Valid</p>
                  </div>
                  <div className="p-4 rounded-lg bg-destructive/10">
                    <p className="text-2xl font-bold text-destructive">{parseResult.invalidRows}</p>
                    <p className="text-sm text-muted-foreground">With Issues</p>
                  </div>
                </div>

                {isImporting && (
                  <div className="mb-6">
                    <div className="flex justify-between text-sm mb-2">
                      <span>Importing...</span>
                      <span>{importProgress}%</span>
                    </div>
                    <Progress value={importProgress} />
                  </div>
                )}

                {importResults && (
                  <div className="mb-6 p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-4">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span>{importResults.success} bookings imported successfully</span>
                      {importResults.failed > 0 && (
                        <>
                          <XCircle className="w-5 h-5 text-destructive" />
                          <span>{importResults.failed} failed</span>
                        </>
                      )}
                    </div>
                    <Button 
                      className="mt-4" 
                      onClick={() => navigate('/reports')}
                    >
                      View Imported Bookings
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Data Table */}
            <Card>
              <CardHeader>
                <CardTitle>Booking Data</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">Status</TableHead>
                        <TableHead>Move-In</TableHead>
                        <TableHead>Booking Date</TableHead>
                        <TableHead>Member Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Market</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Issues</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parseResult.bookings.map((booking, index) => (
                        <TableRow 
                          key={index}
                          className={cn(!booking.isValid && "bg-destructive/5")}
                        >
                          <TableCell>
                            {booking.isValid ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-destructive" />
                            )}
                          </TableCell>
                          <TableCell>{booking.moveInDate}</TableCell>
                          <TableCell>{booking.bookingDate}</TableCell>
                          <TableCell className="font-medium">{booking.memberName}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{booking.bookingType}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {booking.agentName}
                              {getAgentStatus(booking.agentName) === 'found' ? (
                                <CheckCircle2 className="w-3 h-3 text-green-600" />
                              ) : (
                                <AlertTriangle className="w-3 h-3 text-amber-500" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {booking.marketCity && booking.marketState
                              ? `${booking.marketCity}, ${booking.marketState}`
                              : booking.marketCity || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={booking.status === 'Moved In' ? 'default' : 'secondary'}
                            >
                              {booking.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {booking.errors.length > 0 && (
                              <span className="text-sm text-destructive">
                                {booking.errors.join(', ')}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
