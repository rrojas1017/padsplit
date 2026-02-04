import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Play, Pause, Square, RefreshCw, AlertTriangle, CheckCircle, 
  Clock, Loader2, ChevronDown, Building2, Users, Mic
} from 'lucide-react';
import { useBulkProcessingJobs, BulkProcessingJob } from '@/hooks/useBulkProcessingJobs';
import { format } from 'date-fns';

export function BulkProcessingTab() {
  const {
    jobs,
    activeJob,
    pendingStats,
    loading,
    createJob,
    startJob,
    pauseJob,
    stopJob,
    refreshJobs,
    refreshStats
  } = useBulkProcessingJobs();

  // New job form state
  const [jobName, setJobName] = useState('');
  const [siteFilter, setSiteFilter] = useState<'vixicom_only' | 'non_vixicom' | 'all'>('vixicom_only');
  const [includeTts, setIncludeTts] = useState(true);
  const [pacingSeconds, setPacingSeconds] = useState(10);
  const [isCreating, setIsCreating] = useState(false);
  const [showErrorLog, setShowErrorLog] = useState(false);

  // Calculate estimates based on selection
  const getEstimates = () => {
    let recordCount = 0;
    let costEstimate = 0;
    
    switch (siteFilter) {
      case 'vixicom_only':
        recordCount = pendingStats.vixicom;
        // Full pipeline: STT ($0.12/record avg) + TTS Jeff ($0.15) + TTS Katty ($0.10) + AI ($0.005)
        costEstimate = recordCount * (includeTts ? 0.29 : 0.125);
        break;
      case 'non_vixicom':
        recordCount = pendingStats.nonVixicom;
        // STT only + AI: $0.125/record avg
        costEstimate = recordCount * 0.035; // No TTS
        break;
      case 'all':
        recordCount = pendingStats.total;
        // Mixed: Vixicom gets full, others get STT only
        const vixicomCost = pendingStats.vixicom * (includeTts ? 0.29 : 0.125);
        const nonVixicomCost = pendingStats.nonVixicom * 0.035;
        costEstimate = vixicomCost + nonVixicomCost;
        break;
    }
    
    const timeHours = (recordCount * pacingSeconds) / 3600;
    
    return {
      recordCount,
      costEstimate,
      timeHours
    };
  };

  const estimates = getEstimates();

  const handleCreateAndStart = async () => {
    if (!jobName.trim()) return;
    
    setIsCreating(true);
    try {
      const job = await createJob({
        jobName: jobName.trim(),
        siteFilter,
        includeTts,
        pacingSeconds
      });
      
      if (job) {
        await startJob(job.id, 'start');
        setJobName('');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const getStatusBadge = (status: BulkProcessingJob['status']) => {
    switch (status) {
      case 'running':
        return <Badge className="bg-blue-500"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Running</Badge>;
      case 'paused':
        return <Badge variant="secondary"><Pause className="w-3 h-3 mr-1" />Paused</Badge>;
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'stopped':
        return <Badge variant="outline"><Square className="w-3 h-3 mr-1" />Stopped</Badge>;
      default:
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const formatDuration = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} minutes`;
    }
    return `${hours.toFixed(1)} hours`;
  };

  return (
    <div className="space-y-6">
      {/* Pending Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vixicom (Full Pipeline)</p>
                <p className="text-2xl font-bold">
                  {pendingStats.loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    pendingStats.vixicom.toLocaleString()
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Users className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">PadSplit (STT Only)</p>
                <p className="text-2xl font-bold">
                  {pendingStats.loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    pendingStats.nonVixicom.toLocaleString()
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Mic className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Pending</p>
                <p className="text-2xl font-bold">
                  {pendingStats.loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    pendingStats.total.toLocaleString()
                  )}
                </p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-2 w-full"
              onClick={() => refreshStats()}
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Refresh
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Active Job Card */}
      {activeJob && (
        <Card className="border-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {activeJob.job_name}
                  {getStatusBadge(activeJob.status)}
                </CardTitle>
                <CardDescription>
                  Started {activeJob.started_at ? format(new Date(activeJob.started_at), 'MMM d, h:mm a') : 'Not started'}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {activeJob.status === 'running' && (
                  <Button variant="outline" size="sm" onClick={() => pauseJob(activeJob.id)}>
                    <Pause className="w-4 h-4 mr-1" />
                    Pause
                  </Button>
                )}
                {activeJob.status === 'paused' && (
                  <Button size="sm" onClick={() => startJob(activeJob.id, 'resume')}>
                    <Play className="w-4 h-4 mr-1" />
                    Resume
                  </Button>
                )}
                {(activeJob.status === 'running' || activeJob.status === 'paused') && (
                  <Button variant="destructive" size="sm" onClick={() => stopJob(activeJob.id)}>
                    <Square className="w-4 h-4 mr-1" />
                    Stop
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>
                  {activeJob.processed_count.toLocaleString()} / {activeJob.total_records.toLocaleString()}
                  {activeJob.total_records > 0 && 
                    ` (${Math.round((activeJob.processed_count / activeJob.total_records) * 100)}%)`
                  }
                </span>
              </div>
              <Progress 
                value={activeJob.total_records > 0 
                  ? (activeJob.processed_count / activeJob.total_records) * 100 
                  : 0
                } 
              />
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Processed</p>
                <p className="text-lg font-semibold text-green-500">{activeJob.processed_count}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Failed</p>
                <p className="text-lg font-semibold text-red-500">{activeJob.failed_count}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Skipped</p>
                <p className="text-lg font-semibold text-yellow-500">{activeJob.skipped_count}</p>
              </div>
            </div>
            
            {/* ETA */}
            {activeJob.status === 'running' && activeJob.total_records > 0 && (
              <div className="text-sm text-muted-foreground">
                <Clock className="w-3 h-3 inline mr-1" />
                ETA: {formatDuration(
                  ((activeJob.total_records - activeJob.processed_count) * activeJob.pacing_seconds) / 3600
                )}
              </div>
            )}
            
            {/* Error Log */}
            {activeJob.error_log && activeJob.error_log.length > 0 && (
              <Collapsible open={showErrorLog} onOpenChange={setShowErrorLog}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                      {activeJob.error_log.length} Error(s)
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${showErrorLog ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 max-h-48 overflow-y-auto space-y-2">
                    {activeJob.error_log.slice(-10).reverse().map((err, i) => (
                      <div key={i} className="p-2 bg-destructive/10 rounded text-sm">
                        <p className="font-mono text-xs text-muted-foreground">
                          {format(new Date(err.timestamp), 'HH:mm:ss')} - {err.bookingId.slice(0, 8)}...
                        </p>
                        <p className="text-destructive">{err.error}</p>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create New Job */}
      {!activeJob && (
        <Card>
          <CardHeader>
            <CardTitle>Start New Processing Job</CardTitle>
            <CardDescription>
              Process pending transcriptions with conditional coaching audio generation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="job-name">Job Name</Label>
              <Input
                id="job-name"
                placeholder="e.g., Vixicom Wave 1"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Site Filter</Label>
              <Select value={siteFilter} onValueChange={(v: any) => setSiteFilter(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vixicom_only">
                    Vixicom Only ({pendingStats.vixicom.toLocaleString()} records)
                  </SelectItem>
                  <SelectItem value="non_vixicom">
                    Non-Vixicom Only ({pendingStats.nonVixicom.toLocaleString()} records)
                  </SelectItem>
                  <SelectItem value="all">
                    All Records ({pendingStats.total.toLocaleString()} records)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Pacing: {pacingSeconds} seconds between records</Label>
              <Slider
                value={[pacingSeconds]}
                onValueChange={([v]) => setPacingSeconds(v)}
                min={5}
                max={30}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                Lower = faster processing, higher API load. Recommended: 10s
              </p>
            </div>
            
            {siteFilter !== 'non_vixicom' && (
              <div className="flex items-center justify-between">
                <div>
                  <Label>Include TTS Coaching Audio</Label>
                  <p className="text-xs text-muted-foreground">
                    Generate Jeff & Katty audio for Vixicom agents
                  </p>
                </div>
                <Switch checked={includeTts} onCheckedChange={setIncludeTts} />
              </div>
            )}
            
            {/* Estimates */}
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span>Records to process:</span>
                <span className="font-semibold">{estimates.recordCount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Estimated time:</span>
                <span className="font-semibold">{formatDuration(estimates.timeHours)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Estimated cost:</span>
                <span className="font-semibold">${estimates.costEstimate.toFixed(2)}</span>
              </div>
            </div>
            
            <Button 
              className="w-full" 
              size="lg"
              disabled={!jobName.trim() || isCreating || estimates.recordCount === 0}
              onClick={handleCreateAndStart}
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Processing
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Job History */}
      {jobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Job History
              <Button variant="ghost" size="sm" onClick={() => refreshJobs()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {jobs.filter(j => j.id !== activeJob?.id).slice(0, 5).map((job) => (
                <div key={job.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{job.job_name}</span>
                      {getStatusBadge(job.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {job.processed_count.toLocaleString()} processed • 
                      {job.failed_count > 0 && ` ${job.failed_count} failed •`}
                      {' '}{format(new Date(job.created_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                  {job.status === 'paused' && (
                    <Button size="sm" onClick={() => startJob(job.id, 'resume')}>
                      <Play className="w-4 h-4 mr-1" />
                      Resume
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
