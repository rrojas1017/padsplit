import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAgents } from '@/contexts/AgentsContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Upload, FileText, CheckCircle, AlertTriangle, Users, Play, 
  ArrowRight, Loader2, FileSpreadsheet, X, Trash2, Copy, Package
} from 'lucide-react';
import { parseHubspotCSV, ParsedCallRecord, toBookingInsert, ParseResult, generateImportBatchId } from '@/utils/hubspotCallParser';
import { AgentMappingDialog, AgentMapping } from '@/components/import/AgentMappingDialog';
import { ImportClassificationSummary } from '@/components/import/ImportClassificationSummary';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ExistingBatch {
  import_batch_id: string;
  record_count: number;
  imported_at: string;
}

type ImportStep = 'upload' | 'parsing' | 'agent-mapping' | 'summary' | 'importing' | 'complete';

interface Site {
  id: string;
  name: string;
}

export default function HistoricalImport() {
  const navigate = useNavigate();
  const { agents, addAgent } = useAgents();
  
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [showAgentMapping, setShowAgentMapping] = useState(false);
  const [agentMapping, setAgentMapping] = useState<AgentMapping | null>(null);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [importProgress, setImportProgress] = useState(0);
  const [importBatchId, setImportBatchId] = useState<string | null>(null);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);
  const [importResults, setImportResults] = useState<{
    imported: number;
    bookings: number;
    nonBookings: number;
    skipped: number;
    failed: number;
  } | null>(null);
  
  // Existing batches management
  const [existingBatches, setExistingBatches] = useState<ExistingBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [batchToDelete, setBatchToDelete] = useState<ExistingBatch | null>(null);
  const [isDeletingExistingBatch, setIsDeletingExistingBatch] = useState(false);
  
  // Fetch sites on mount
  useEffect(() => {
    const fetchSites = async () => {
      const { data } = await supabase.from('sites').select('id, name');
      if (data) setSites(data);
    };
    fetchSites();
  }, []);
  
  // Fetch existing import batches on mount
  const fetchExistingBatches = useCallback(async () => {
    setLoadingBatches(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('import_batch_id, created_at')
        .not('import_batch_id', 'is', null);
      
      if (error) throw error;
      
      // Group by import_batch_id and count
      const batchMap = new Map<string, { count: number; earliestDate: string }>();
      for (const row of data || []) {
        const batchId = row.import_batch_id!;
        const existing = batchMap.get(batchId);
        if (existing) {
          existing.count++;
          if (row.created_at < existing.earliestDate) {
            existing.earliestDate = row.created_at;
          }
        } else {
          batchMap.set(batchId, { count: 1, earliestDate: row.created_at });
        }
      }
      
      // Convert to array and sort by date descending
      const batches: ExistingBatch[] = Array.from(batchMap.entries())
        .map(([id, info]) => ({
          import_batch_id: id,
          record_count: info.count,
          imported_at: info.earliestDate,
        }))
        .sort((a, b) => new Date(b.imported_at).getTime() - new Date(a.imported_at).getTime());
      
      setExistingBatches(batches);
    } catch (err) {
      console.error('Failed to fetch existing batches:', err);
    } finally {
      setLoadingBatches(false);
    }
  }, []);
  
  useEffect(() => {
    fetchExistingBatches();
  }, [fetchExistingBatches]);
  
  // Delete an existing batch
  const deleteExistingBatch = async (batch: ExistingBatch) => {
    setIsDeletingExistingBatch(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('import_batch_id', batch.import_batch_id);
      
      if (error) throw error;
      
      toast.success(`Deleted ${batch.record_count.toLocaleString()} records from batch ${batch.import_batch_id}`);
      setBatchToDelete(null);
      fetchExistingBatches();
    } catch (err) {
      console.error('Failed to delete batch:', err);
      toast.error('Failed to delete batch');
    } finally {
      setIsDeletingExistingBatch(false);
    }
  };
  
  // Handle file drop/select
  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    setStep('parsing');
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const result = parseHubspotCSV(content);
        setParseResult(result);
        
        if (result.records.length === 0) {
          toast.error('No valid records found in file');
          setStep('upload');
          return;
        }
        
        // Check for unmatched agents
        const unmatchedAgents = result.uniqueAgentNames.filter(
          name => !agents.some(a => a.name.toLowerCase() === name.toLowerCase())
        );
        
        if (unmatchedAgents.length > 0) {
          setStep('agent-mapping');
          setShowAgentMapping(true);
        } else {
          // All agents matched - create auto mapping
          const mappings: Record<string, string> = {};
          for (const name of result.uniqueAgentNames) {
            const agent = agents.find(a => a.name.toLowerCase() === name.toLowerCase());
            if (agent) mappings[name] = agent.id;
          }
          setAgentMapping({ mappings, toCreate: [], toSkip: [] });
          await checkDuplicates(result.records, mappings);
          setStep('summary');
        }
      } catch (err) {
        toast.error('Failed to parse file');
        console.error(err);
        setStep('upload');
      }
    };
    reader.readAsText(selectedFile);
  }, [agents]);
  
  // Check for duplicates
  const checkDuplicates = async (records: ParsedCallRecord[], mappings: Record<string, string>) => {
    let duplicates = 0;
    
    // Get existing kixie_links
    const recordingUrls = records
      .map(r => r.recordingUrl)
      .filter(Boolean);
    
    if (recordingUrls.length > 0) {
      const { data: existingByUrl } = await supabase
        .from('bookings')
        .select('kixie_link')
        .in('kixie_link', recordingUrls);
      
      duplicates += existingByUrl?.length || 0;
    }
    
    setDuplicateCount(duplicates);
  };
  
  // Handle agent mapping confirmation
  const handleAgentMappingConfirm = async (mapping: AgentMapping) => {
    setShowAgentMapping(false);
    setAgentMapping(mapping);
    
    // Create new agents if needed
    if (mapping.toCreate.length > 0) {
      toast.info(`Creating ${mapping.toCreate.length} new agent(s)...`);
      
      for (const agentToCreate of mapping.toCreate) {
        try {
          const { data, error } = await supabase
            .from('agents')
            .insert({ name: agentToCreate.name, site_id: agentToCreate.siteId, active: true })
            .select()
            .single();
          
          if (data) {
            // Update mapping with real ID
            mapping.mappings[agentToCreate.name] = data.id;
          } else if (error) {
            toast.error(`Failed to create agent: ${agentToCreate.name}`);
          }
        } catch (err) {
          console.error('Error creating agent:', err);
        }
      }
    }
    
    if (parseResult) {
      await checkDuplicates(parseResult.records, mapping.mappings);
    }
    
    setStep('summary');
  };
  
  // Execute import
  const executeImport = async () => {
    if (!parseResult || !agentMapping) return;
    
    // Generate unique batch ID for this import
    const batchId = generateImportBatchId();
    setImportBatchId(batchId);
    
    setStep('importing');
    setImportProgress(0);
    
    const results = {
      imported: 0,
      bookings: 0,
      nonBookings: 0,
      skipped: 0,
      failed: 0,
    };
    
    // Filter out records from skipped agents
    const recordsToImport = parseResult.records.filter(
      r => !agentMapping.toSkip.includes(r.agentName)
    );
    
    const batchSize = 50;
    const totalBatches = Math.ceil(recordsToImport.length / batchSize);
    
    for (let i = 0; i < recordsToImport.length; i += batchSize) {
      const batch = recordsToImport.slice(i, i + batchSize);
      const inserts = [];
      
      for (const record of batch) {
        const agentId = agentMapping.mappings[record.agentName];
        if (!agentId || agentId.startsWith('__create__')) {
          results.skipped++;
          continue;
        }
        
        // Check for duplicate by recording URL
        if (record.recordingUrl) {
          const { data: existing } = await supabase
            .from('bookings')
            .select('id')
            .eq('kixie_link', record.recordingUrl)
            .maybeSingle();
          
          if (existing) {
            results.skipped++;
            continue;
          }
        }
        
        inserts.push(toBookingInsert(record, agentId, batchId));
        
        if (record.status === 'Pending Move-In') {
          results.bookings++;
        } else {
          results.nonBookings++;
        }
      }
      
      if (inserts.length > 0) {
        const { error } = await supabase.from('bookings').insert(inserts);
        
        if (error) {
          console.error('Batch insert error:', error);
          results.failed += inserts.length;
          results.bookings -= inserts.filter(r => r.status === 'Pending Move-In').length;
          results.nonBookings -= inserts.filter(r => r.status === 'Non Booking').length;
        } else {
          results.imported += inserts.length;
        }
      }
      
      // Update progress
      const progress = Math.round(((i + batch.length) / recordsToImport.length) * 100);
      setImportProgress(progress);
      
      // Small delay between batches
      if (i + batchSize < recordsToImport.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    setImportResults(results);
    setStep('complete');
    toast.success(`Imported ${results.imported} records successfully!`);
  };
  
  // File drop handler
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.csv') || droppedFile.name.endsWith('.xlsx'))) {
      handleFileSelect(droppedFile);
    } else {
      toast.error('Please upload a CSV or Excel file');
    }
  }, [handleFileSelect]);
  
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };
  
  const resetImport = () => {
    setStep('upload');
    setFile(null);
    setParseResult(null);
    setAgentMapping(null);
    setDuplicateCount(0);
    setImportProgress(0);
    setImportResults(null);
    setImportBatchId(null);
  };
  
  // Delete imported batch
  const deleteBatch = async () => {
    if (!importBatchId) return;
    
    setIsDeletingBatch(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('import_batch_id', importBatchId);
      
      if (error) {
        toast.error(`Failed to delete batch: ${error.message}`);
      } else {
        toast.success(`Deleted ${importResults?.imported || 0} records from batch ${importBatchId}`);
        resetImport();
      }
    } catch (err) {
      toast.error('Failed to delete batch');
      console.error(err);
    } finally {
      setIsDeletingBatch(false);
    }
  };
  
  const copyBatchId = () => {
    if (importBatchId) {
      navigator.clipboard.writeText(importBatchId);
      toast.success('Batch ID copied to clipboard');
    }
  };
  
  return (
    <DashboardLayout 
      title="Historical Import" 
      subtitle="Import HubSpot call recordings into the booking system"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Step Indicator */}
        <div className="flex items-center gap-2 text-sm">
          {['Upload', 'Parse', 'Agents', 'Review', 'Import', 'Complete'].map((label, i) => {
            const stepOrder: ImportStep[] = ['upload', 'parsing', 'agent-mapping', 'summary', 'importing', 'complete'];
            const currentIndex = stepOrder.indexOf(step);
            const isActive = i === currentIndex;
            const isComplete = i < currentIndex;
            
            return (
              <div key={label} className="flex items-center gap-2">
                {i > 0 && <div className="w-8 h-px bg-border" />}
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${
                  isActive ? 'bg-primary text-primary-foreground' : 
                  isComplete ? 'bg-success/20 text-success' : 
                  'bg-muted text-muted-foreground'
                }`}>
                  {isComplete ? <CheckCircle className="w-3 h-3" /> : <span className="w-4 text-center">{i + 1}</span>}
                  <span className="hidden sm:inline">{label}</span>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Upload Step */}
        {step === 'upload' && (
          <div className="space-y-6">
            {/* Existing Import Batches */}
            {(existingBatches.length > 0 || loadingBatches) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Existing Import Batches
                  </CardTitle>
                  <CardDescription>
                    Delete a batch before re-importing to avoid duplicates
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingBatches ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : existingBatches.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No existing import batches found
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {existingBatches.map((batch) => (
                        <div
                          key={batch.import_batch_id}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div>
                            <Badge variant="outline" className="font-mono text-xs">
                              {batch.import_batch_id}
                            </Badge>
                            <p className="text-sm text-muted-foreground mt-1">
                              {batch.record_count.toLocaleString()} records • Imported{' '}
                              {new Date(batch.imported_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setBatchToDelete(batch)}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            
            {/* Upload Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Upload HubSpot Export
                </CardTitle>
                <CardDescription>
                  Upload a CSV or Excel file exported from HubSpot containing call recordings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="border-2 border-dashed border-border rounded-xl p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">Drop your file here</p>
                  <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-4">Supports CSV and Excel files</p>
                  <input
                    id="file-input"
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Parsing Step */}
        {step === 'parsing' && (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary mb-4" />
              <p className="text-lg font-medium">Parsing file...</p>
              <p className="text-sm text-muted-foreground mt-1">{file?.name}</p>
            </CardContent>
          </Card>
        )}
        
        {/* Summary Step */}
        {step === 'summary' && parseResult && (
          <div className="space-y-4">
            <ImportClassificationSummary
              records={parseResult.records}
              bookingCount={parseResult.bookingCount}
              nonBookingCount={parseResult.nonBookingCount}
              duplicateCount={duplicateCount}
              errors={parseResult.errors}
            />
            
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={resetImport}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={executeImport}>
                <Play className="w-4 h-4 mr-2" />
                Start Import
              </Button>
            </div>
          </div>
        )}
        
        {/* Importing Step */}
        {step === 'importing' && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center mb-6">
                <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary mb-4" />
                <p className="text-lg font-medium">Importing records...</p>
                <p className="text-sm text-muted-foreground mt-1">Please do not close this page</p>
              </div>
              <Progress value={importProgress} className="h-2" />
              <p className="text-center text-sm text-muted-foreground mt-2">
                {importProgress}% complete
              </p>
            </CardContent>
          </Card>
        )}
        
        {/* Complete Step */}
        {step === 'complete' && importResults && (
          <Card>
            <CardContent className="py-8">
              <div className="text-center mb-6">
                <CheckCircle className="w-16 h-16 mx-auto text-success mb-4" />
                <h2 className="text-2xl font-bold">Import Complete!</h2>
                {importBatchId && (
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {importBatchId}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyBatchId}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-success/10 rounded-lg">
                  <div className="text-2xl font-bold text-success">{importResults.imported}</div>
                  <div className="text-sm text-muted-foreground">Imported</div>
                </div>
                <div className="text-center p-4 bg-warning/10 rounded-lg">
                  <div className="text-2xl font-bold text-warning">{importResults.bookings}</div>
                  <div className="text-sm text-muted-foreground">Bookings</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-muted-foreground">{importResults.nonBookings}</div>
                  <div className="text-sm text-muted-foreground">Non-Bookings</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{importResults.skipped}</div>
                  <div className="text-sm text-muted-foreground">Skipped</div>
                </div>
              </div>
              
              {importResults.failed > 0 && (
                <div className="mb-6 p-4 bg-destructive/10 rounded-lg text-center">
                  <AlertTriangle className="w-5 h-5 inline-block mr-2 text-destructive" />
                  <span className="text-destructive">{importResults.failed} records failed to import</span>
                </div>
              )}
              
              {/* Batch rollback info */}
              <div className="mb-6 p-4 bg-muted/50 rounded-lg text-sm">
                <p className="text-muted-foreground">
                  <strong>Rollback available:</strong> All {importResults.imported} records are tagged with batch ID{' '}
                  <code className="bg-muted px-1 rounded">{importBatchId}</code>.
                  You can delete this entire batch if needed.
                </p>
              </div>
              
              <div className="flex flex-wrap gap-3 justify-center">
                <Button variant="outline" onClick={resetImport}>
                  Import More
                </Button>
                <Button onClick={() => navigate('/reports')}>
                  <FileText className="w-4 h-4 mr-2" />
                  View in Reports
                </Button>
                <Button variant="secondary" onClick={() => navigate('/call-insights')}>
                  View Non-Bookings
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={deleteBatch}
                  disabled={isDeletingBatch}
                >
                  {isDeletingBatch ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Delete This Batch
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Agent Mapping Dialog */}
      <AgentMappingDialog
        open={showAgentMapping}
        onOpenChange={setShowAgentMapping}
        csvAgentNames={parseResult?.uniqueAgentNames || []}
        existingAgents={agents}
        sites={sites}
        onConfirm={handleAgentMappingConfirm}
      />
      
      {/* Delete Batch Confirmation Dialog */}
      <AlertDialog open={!!batchToDelete} onOpenChange={(open) => !open && setBatchToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Import Batch?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{' '}
              <strong>{batchToDelete?.record_count.toLocaleString()}</strong> records from batch{' '}
              <code className="bg-muted px-1 rounded">{batchToDelete?.import_batch_id}</code>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingExistingBatch}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => batchToDelete && deleteExistingBatch(batchToDelete)}
              disabled={isDeletingExistingBatch}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingExistingBatch ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete {batchToDelete?.record_count.toLocaleString()} Records
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
