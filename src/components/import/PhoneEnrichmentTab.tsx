import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Phone, FileSpreadsheet, CheckCircle, Loader2, X, Upload, AlertTriangle
} from 'lucide-react';
import { 
  ContactRecord, ContactParseResult, 
  parseCSV, parseExcel, buildPhoneLookup 
} from '@/utils/contactEnrichmentParser';

type EnrichmentStep = 'upload' | 'parsing' | 'preview' | 'enriching' | 'complete';

interface EnrichmentResults {
  updated: number;
  noMatch: number;
  alreadyHasPhone: number;
}

export function PhoneEnrichmentTab() {
  const [step, setStep] = useState<EnrichmentStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ContactParseResult | null>(null);
  const [phoneLookup, setPhoneLookup] = useState<Map<string, string>>(new Map());
  const [potentialMatches, setPotentialMatches] = useState(0);
  const [recordsNeedingPhone, setRecordsNeedingPhone] = useState(0);
  const [enrichProgress, setEnrichProgress] = useState(0);
  const [results, setResults] = useState<EnrichmentResults | null>(null);

  // Parse uploaded file
  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setStep('parsing');

    try {
      const fileName = selectedFile.name.toLowerCase();
      let result: ContactParseResult;

      if (fileName.endsWith('.csv')) {
        const content = await selectedFile.text();
        result = parseCSV(content);
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const buffer = await selectedFile.arrayBuffer();
        result = parseExcel(buffer);
      } else if (fileName.endsWith('.numbers')) {
        // For .numbers files, we need to use a different approach
        // For now, show an error - these need to be exported as CSV first
        toast.error('Please export your Numbers file as CSV first');
        setStep('upload');
        return;
      } else {
        toast.error('Unsupported file format. Please use CSV or Excel files.');
        setStep('upload');
        return;
      }

      if (result.contacts.length === 0) {
        toast.error('No contacts found in file');
        setStep('upload');
        return;
      }

      setParseResult(result);
      
      // Build lookup map
      const lookup = buildPhoneLookup(result.contacts);
      setPhoneLookup(lookup);

      // Check how many records in DB need phone enrichment
      const { count, error } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .is('contact_phone', null)
        .not('contact_email', 'is', null);

      if (error) {
        console.error('Error checking records:', error);
      }

      setRecordsNeedingPhone(count || 0);

      // Check potential matches
      const { data: bookingsWithEmail } = await supabase
        .from('bookings')
        .select('contact_email')
        .is('contact_phone', null)
        .not('contact_email', 'is', null);

      let matches = 0;
      if (bookingsWithEmail) {
        for (const booking of bookingsWithEmail) {
          if (booking.contact_email && lookup.has(booking.contact_email.toLowerCase().trim())) {
            matches++;
          }
        }
      }
      setPotentialMatches(matches);

      setStep('preview');
    } catch (err) {
      console.error('Failed to parse file:', err);
      toast.error('Failed to parse file');
      setStep('upload');
    }
  }, []);

  // Execute enrichment
  const executeEnrichment = async () => {
    setStep('enriching');
    setEnrichProgress(0);

    const enrichResults: EnrichmentResults = {
      updated: 0,
      noMatch: 0,
      alreadyHasPhone: 0,
    };

    try {
      // Fetch all bookings needing phone enrichment
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('id, contact_email')
        .is('contact_phone', null)
        .not('contact_email', 'is', null);

      if (error) throw error;
      if (!bookings || bookings.length === 0) {
        toast.info('No records to enrich');
        setStep('complete');
        setResults(enrichResults);
        return;
      }

      const total = bookings.length;
      const batchSize = 50;

      for (let i = 0; i < bookings.length; i += batchSize) {
        const batch = bookings.slice(i, i + batchSize);
        
        for (const booking of batch) {
          if (!booking.contact_email) {
            enrichResults.noMatch++;
            continue;
          }

          const email = booking.contact_email.toLowerCase().trim();
          const phone = phoneLookup.get(email);

          if (phone) {
            const { error: updateError } = await supabase
              .from('bookings')
              .update({ contact_phone: phone })
              .eq('id', booking.id);

            if (updateError) {
              console.error('Update error:', updateError);
            } else {
              enrichResults.updated++;
            }
          } else {
            enrichResults.noMatch++;
          }
        }

        // Update progress
        const progress = Math.round(((i + batch.length) / total) * 100);
        setEnrichProgress(progress);

        // Small delay between batches
        if (i + batchSize < bookings.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      setResults(enrichResults);
      setStep('complete');
      toast.success(`Updated ${enrichResults.updated} records with phone numbers!`);
    } catch (err) {
      console.error('Enrichment error:', err);
      toast.error('Failed to enrich records');
      setStep('preview');
    }
  };

  // Reset state
  const reset = () => {
    setStep('upload');
    setFile(null);
    setParseResult(null);
    setPhoneLookup(new Map());
    setPotentialMatches(0);
    setRecordsNeedingPhone(0);
    setEnrichProgress(0);
    setResults(null);
  };

  // File drop handler
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload State */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Phone Enrichment
            </CardTitle>
            <CardDescription>
              Upload a contact export file (CSV, Excel) to add missing phone numbers to existing records by matching email addresses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-border rounded-xl p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => document.getElementById('enrichment-file-input')?.click()}
            >
              <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Drop your contact export here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
              <p className="text-xs text-muted-foreground mt-4">
                Supports CSV and Excel files with Name, Email, and Phone columns
              </p>
              <input
                id="enrichment-file-input"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parsing State */}
      {step === 'parsing' && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">Parsing file...</p>
            <p className="text-sm text-muted-foreground mt-1">{file?.name}</p>
          </CardContent>
        </Card>
      )}

      {/* Preview State */}
      {step === 'preview' && parseResult && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                File Preview
              </CardTitle>
              <CardDescription>
                {file?.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <div className="text-2xl font-bold">{parseResult.totalRows.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Contacts in File</div>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <div className="text-2xl font-bold">{parseResult.withPhone.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">With Phone</div>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <div className="text-2xl font-bold">{recordsNeedingPhone.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Records Need Phone</div>
                </div>
                <div className="p-4 bg-primary/10 rounded-lg text-center">
                  <div className="text-2xl font-bold text-primary">{potentialMatches.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Potential Matches</div>
                </div>
              </div>

              {/* Sample Preview */}
              {parseResult.contacts.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Sample Contacts (first 5)</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parseResult.contacts.slice(0, 5).map((contact, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{contact.name || '-'}</TableCell>
                            <TableCell className="text-muted-foreground">{contact.email || '-'}</TableCell>
                            <TableCell>
                              {contact.phone ? (
                                <Badge variant="outline" className="font-mono text-xs">
                                  {contact.phone}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {potentialMatches === 0 && (
                <div className="p-4 bg-warning/10 rounded-lg flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                  <div>
                    <p className="font-medium text-warning">No matches found</p>
                    <p className="text-sm text-muted-foreground">
                      None of the emails in your file match records in the database that need phone numbers.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={reset}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={executeEnrichment} disabled={potentialMatches === 0}>
              <Upload className="w-4 h-4 mr-2" />
              Start Enrichment ({potentialMatches.toLocaleString()} records)
            </Button>
          </div>
        </div>
      )}

      {/* Enriching State */}
      {step === 'enriching' && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center mb-6">
              <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary mb-4" />
              <p className="text-lg font-medium">Enriching records...</p>
              <p className="text-sm text-muted-foreground mt-1">Please do not close this page</p>
            </div>
            <Progress value={enrichProgress} className="h-2" />
            <p className="text-center text-sm text-muted-foreground mt-2">
              {enrichProgress}% complete
            </p>
          </CardContent>
        </Card>
      )}

      {/* Complete State */}
      {step === 'complete' && results && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center mb-6">
              <CheckCircle className="w-16 h-16 mx-auto text-success mb-4" />
              <h2 className="text-2xl font-bold">Enrichment Complete!</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 max-w-md mx-auto">
              <div className="text-center p-4 bg-success/10 rounded-lg">
                <div className="text-2xl font-bold text-success">{results.updated.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Records Updated</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-muted-foreground">{results.noMatch.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">No Match</div>
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={reset}>
                Enrich More
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
