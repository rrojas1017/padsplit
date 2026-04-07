import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { usePageTracking } from '@/hooks/usePageTracking';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Database, Bell, Moon, Sun, Upload, Key, FileText, Download, Brain, Phone, BookOpen, Shield, ScrollText, Zap, Volume2, Loader2, ClipboardCheck, RefreshCw, AlertTriangle, FlaskConical, Lock, Microscope, GraduationCap } from 'lucide-react';
import { useCoachingSettings } from '@/hooks/useCoachingSettings';
import { ResearchPromptsSettings } from '@/components/research-insights/ResearchPromptsSettings';
import { generateRoleDocumentationPDF } from '@/utils/roleDocumentation';
import { generateQADocumentationPDF } from '@/utils/qaDocumentation';
import { CallTypeList } from '@/components/ai-management/CallTypeList';
import { KnowledgeList } from '@/components/ai-management/KnowledgeList';
import { CallRulesList } from '@/components/ai-management/CallRulesList';
import { ScriptList } from '@/components/ai-management/ScriptList';
import { AutoTranscriptionSettings } from '@/components/ai-management/AutoTranscriptionSettings';
import { QARubricSettings } from '@/components/ai-management/QARubricSettings';
import { STTComparisonPanel } from '@/components/ai-management/STTComparisonPanel';
import { LLMComparisonPanel } from '@/components/ai-management/LLMComparisonPanel';
import { KattyQASettings } from '@/components/ai-management/KattyQASettings';
import { IPAllowlistManager } from '@/components/security/IPAllowlistManager';
import { MovedInNotificationSettings } from '@/components/settings/MovedInNotificationSettings';
import { BulkProcessingTab } from '@/components/import/BulkProcessingTab';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';

export default function Settings() {
  usePageTracking('view_settings');
  const { theme, toggleTheme } = useTheme();
  const { hasRole } = useAuth();
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isRetryingTranscriptions, setIsRetryingTranscriptions] = useState(false);
  const [failedTranscriptionCount, setFailedTranscriptionCount] = useState<number | null>(null);
  
  const canAccessAIManagement = hasRole(['super_admin', 'admin']);

  const handleBatchGenerateAudio = async () => {
    setIsGeneratingAudio(true);
    toast.info('Starting batch audio generation...', { duration: 5000 });
    
    try {
      const { data, error } = await supabase.functions.invoke('batch-regenerate-coaching');
      
      if (error) {
        throw error;
      }
      
      if (data?.results) {
        const { total, succeeded, failed } = data.results;
        if (total === 0) {
          toast.info('No bookings found needing coaching audio');
        } else {
          toast.success(
            `Batch complete: ${succeeded} of ${total} audio files generated${failed > 0 ? `, ${failed} failed` : ''}`,
            { duration: 10000 }
          );
        }
      }
    } catch (error) {
      console.error('Batch audio generation error:', error);
      toast.error('Failed to generate coaching audio. Please try again.');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // Check for failed transcriptions on mount
  useEffect(() => {
    if (canAccessAIManagement) {
      checkFailedTranscriptions();
    }
  }, [canAccessAIManagement]);

  const checkFailedTranscriptions = async () => {
    try {
      const { count, error } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .not('kixie_link', 'is', null)
        .in('transcription_status', ['failed', 'pending']);
      
      if (!error && count !== null) {
        setFailedTranscriptionCount(count);
      }
    } catch (error) {
      console.error('Error checking failed transcriptions:', error);
    }
  };

  const handleBatchRetryTranscriptions = async () => {
    setIsRetryingTranscriptions(true);
    toast.info('Starting batch retry of failed transcriptions...', { duration: 5000 });
    
    try {
      const { data, error } = await supabase.functions.invoke('batch-retry-transcriptions', {
        body: { dryRun: false, limit: 50 }
      });
      
      if (error) {
        throw error;
      }
      
      if (data?.success) {
        if (data.queued > 0) {
          toast.success(
            `Started re-transcription for ${data.queued} bookings. Processing in background with 30-second pacing.`,
            { duration: 10000 }
          );
          // Refresh count
          setTimeout(checkFailedTranscriptions, 2000);
        } else {
          toast.info(data.message || 'No failed transcriptions found to retry');
        }
      }
    } catch (error) {
      console.error('Batch retry transcriptions error:', error);
      toast.error('Failed to start batch retry. Please try again.');
    } finally {
      setIsRetryingTranscriptions(false);
    }
  };

  return (
    <DashboardLayout 
      title="Settings" 
      subtitle="Configure your dashboard preferences"
    >
      <div className="max-w-4xl">
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-7 h-auto gap-1">
            <TabsTrigger value="general" className="gap-2">
              <Sun className="w-4 h-4" />
              <span className="hidden sm:inline">General</span>
            </TabsTrigger>
            <TabsTrigger value="data" className="gap-2">
              <Database className="w-4 h-4" />
              <span className="hidden sm:inline">Data</span>
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2">
              <Key className="w-4 h-4" />
              <span className="hidden sm:inline">Integrations</span>
            </TabsTrigger>
            {canAccessAIManagement && (
              <TabsTrigger value="ai" className="gap-2">
                <Brain className="w-4 h-4" />
                <span className="hidden sm:inline">AI Management</span>
              </TabsTrigger>
            )}
            {canAccessAIManagement && (
              <TabsTrigger value="security" className="gap-2">
                <Lock className="w-4 h-4" />
                <span className="hidden sm:inline">Security</span>
              </TabsTrigger>
            )}
            {hasRole(['super_admin']) && (
              <TabsTrigger value="research-prompts" className="gap-2">
                <Microscope className="w-4 h-4" />
                <span className="hidden sm:inline">Research AI</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="docs" className="gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Docs</span>
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-6">
            {/* Appearance */}
            <div className="bg-card rounded-xl border border-border p-6 shadow-card">
              <div className="flex items-center gap-3 mb-6">
                {theme === 'dark' ? <Moon className="w-5 h-5 text-accent" /> : <Sun className="w-5 h-5 text-accent" />}
                <h3 className="text-lg font-semibold text-foreground">Appearance</h3>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Dark Mode</p>
                  <p className="text-sm text-muted-foreground">Toggle between light and dark themes</p>
                </div>
                <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
              </div>
            </div>

            {/* Notifications */}
            <div className="bg-card rounded-xl border border-border p-6 shadow-card">
              <div className="flex items-center gap-3 mb-6">
                <Bell className="w-5 h-5 text-accent" />
                <h3 className="text-lg font-semibold text-foreground">Notifications</h3>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">Receive daily performance reports via email</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Slack Alerts</p>
                    <p className="text-sm text-muted-foreground">Get notified when targets are reached</p>
                  </div>
                  <Switch />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Data Import Tab */}
          <TabsContent value="data" className="space-y-6">
            <div className="bg-card rounded-xl border border-border p-6 shadow-card">
              <div className="flex items-center gap-3 mb-6">
                <Database className="w-5 h-5 text-accent" />
                <h3 className="text-lg font-semibold text-foreground">Data Import</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label>Google Sheets URL</Label>
                  <Input 
                    placeholder="https://docs.google.com/spreadsheets/d/..." 
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Connect your Google Sheet for automatic data sync
                  </p>
                </div>
                
                <div className="flex gap-3">
                  <Button variant="outline" className="gap-2">
                    <Upload className="w-4 h-4" />
                    Upload CSV
                  </Button>
                  <Button className="gap-2">
                    <Database className="w-4 h-4" />
                    Sync Now
                  </Button>
                </div>
              </div>
            </div>

            {/* Bulk Transcription Processing */}
            {canAccessAIManagement && <BulkProcessingTab />}
          </TabsContent>

          {/* API Integrations Tab */}
          <TabsContent value="integrations" className="space-y-6">
            <div className="bg-card rounded-xl border border-border p-6 shadow-card">
              <div className="flex items-center gap-3 mb-6">
                <Key className="w-5 h-5 text-accent" />
                <h3 className="text-lg font-semibold text-foreground">API Integrations</h3>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                      <span className="font-bold text-orange-500">H</span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">HubSpot</p>
                      <p className="text-sm text-muted-foreground">Not connected</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Connect</Button>
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <span className="font-bold text-blue-500">K</span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Kixie</p>
                      <p className="text-sm text-muted-foreground">Not connected</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Connect</Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* AI Management Tab - Only for Admin/Super Admin */}
          {canAccessAIManagement && (
            <TabsContent value="ai" className="space-y-6">
              {/* Auto-Transcription Settings */}
              <AutoTranscriptionSettings />

              {/* Call Types Section */}
              <div className="bg-card rounded-xl border border-border p-6 shadow-card">
                <div className="flex items-center gap-3 mb-6">
                  <Phone className="w-5 h-5 text-accent" />
                  <h3 className="text-lg font-semibold text-foreground">Call Types</h3>
                </div>
                <CallTypeList />
              </div>

              {/* Company Knowledge Section */}
              <div className="bg-card rounded-xl border border-border p-6 shadow-card">
                <div className="flex items-center gap-3 mb-6">
                  <BookOpen className="w-5 h-5 text-accent" />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Company Knowledge</h3>
                    <p className="text-sm text-muted-foreground">Add context for AI to better understand your business</p>
                  </div>
                </div>
                <KnowledgeList />
              </div>

              {/* Call Rules Section */}
              <div className="bg-card rounded-xl border border-border p-6 shadow-card">
                <div className="flex items-center gap-3 mb-6">
                  <Shield className="w-5 h-5 text-accent" />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Call Rules</h3>
                    <p className="text-sm text-muted-foreground">Define evaluation criteria for each call type</p>
                  </div>
                </div>
                <CallRulesList />
              </div>

              {/* Script Templates Section */}
              <div className="bg-card rounded-xl border border-border p-6 shadow-card">
                <div className="flex items-center gap-3 mb-6">
                  <ScrollText className="w-5 h-5 text-accent" />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Script Templates</h3>
                    <p className="text-sm text-muted-foreground">Upload scripts for adherence checking</p>
                  </div>
                </div>
                <ScriptList />
              </div>

              {/* Batch Coaching Audio Generation */}
              <div className="bg-card rounded-xl border border-border p-6 shadow-card">
                <div className="flex items-center gap-3 mb-6">
                  <Volume2 className="w-5 h-5 text-accent" />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Coaching Audio Generation</h3>
                    <p className="text-sm text-muted-foreground">Generate missing voice coaching for all transcribed calls</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    This will generate coaching audio for all bookings that have been transcribed and analyzed 
                    but are missing voice coaching feedback. Processing may take several minutes depending on the number of bookings.
                  </p>
                  <Button 
                    onClick={handleBatchGenerateAudio}
                    disabled={isGeneratingAudio}
                    className="gap-2"
                  >
                    {isGeneratingAudio ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating Audio...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Generate Missing Coaching Audio
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Batch Retry Failed Transcriptions */}
              <div className="bg-card rounded-xl border border-border p-6 shadow-card">
                <div className="flex items-center gap-3 mb-6">
                  <RefreshCw className="w-5 h-5 text-accent" />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Retry Failed Transcriptions</h3>
                    <p className="text-sm text-muted-foreground">Re-attempt transcription for bookings that failed to process</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {failedTranscriptionCount !== null && failedTranscriptionCount > 0 && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span className="text-sm text-amber-600 dark:text-amber-400">
                        {failedTranscriptionCount} booking{failedTranscriptionCount === 1 ? '' : 's'} with failed/pending transcriptions
                      </span>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    This will find bookings with failed or pending transcription status that never got processed,
                    and retry the transcription pipeline. Processing uses 30-second pacing to avoid rate limits.
                  </p>
                  <div className="flex gap-3">
                    <Button 
                      onClick={handleBatchRetryTranscriptions}
                      disabled={isRetryingTranscriptions}
                      variant="outline"
                      className="gap-2"
                    >
                      {isRetryingTranscriptions ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Retrying...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          Retry Failed Transcriptions
                        </>
                      )}
                    </Button>
                    <Button 
                      onClick={checkFailedTranscriptions}
                      variant="ghost"
                      size="icon"
                      title="Refresh count"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* QA Rubric Settings */}
              <div className="bg-card rounded-xl border border-border p-6 shadow-card">
                <div className="flex items-center gap-3 mb-6">
                  <ClipboardCheck className="w-5 h-5 text-accent" />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">QA Scoring Rubric</h3>
                    <p className="text-sm text-muted-foreground">Configure quality assurance scoring categories and weights</p>
                  </div>
                </div>
                <QARubricSettings />
              </div>

              {/* Katty QA Voice Settings */}
              <KattyQASettings />

              {/* Coaching Enforcement Settings */}
              <CoachingEnforcementCard />

              {/* STT Quality Comparison */}
              <div className="bg-card rounded-xl border border-border p-6 shadow-card">
                <STTComparisonPanel />
              </div>

               {/* LLM Quality Comparison */}
               <div className="bg-card rounded-xl border border-border p-6 shadow-card">
                 <LLMComparisonPanel />
               </div>
 
              {/* Info Box */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <div className="flex gap-3">
                  <Brain className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-foreground mb-1">Default AI Behavior</p>
                    <p className="text-muted-foreground">
                      When no custom configurations are set, the AI uses built-in analysis optimized for sales calls. 
                      Add call types, knowledge, and rules to customize AI insights for your specific needs.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          )}

          {/* Security Tab - Only for Admin/Super Admin */}
          {canAccessAIManagement && (
            <TabsContent value="security" className="space-y-6">
              <div className="bg-card rounded-xl border border-border p-6 shadow-card">
                <div className="flex items-center gap-3 mb-6">
                  <Lock className="w-5 h-5 text-accent" />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">IP Login Restrictions</h3>
                    <p className="text-sm text-muted-foreground">Restrict agent login to approved IP addresses only</p>
                  </div>
                </div>
                <IPAllowlistManager />
              </div>

              {/* Move-In Notifications — super_admin only */}
              {hasRole(['super_admin']) && (
                <MovedInNotificationSettings />
              )}
            </TabsContent>
          )}

          {/* Research Prompts Tab - Super Admin only */}
          {hasRole(['super_admin']) && (
            <TabsContent value="research-prompts" className="space-y-6">
              <div className="bg-card rounded-xl border border-border p-6 shadow-card">
                <div className="flex items-center gap-3 mb-6">
                  <Microscope className="w-5 h-5 text-accent" />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Research AI Prompts</h3>
                    <p className="text-sm text-muted-foreground">Configure the AI prompts used for move-out research analysis</p>
                  </div>
                </div>
                <ResearchPromptsSettings />
              </div>
            </TabsContent>
          )}

          {/* Documentation Tab */}
          <TabsContent value="docs" className="space-y-6">
            <div className="bg-card rounded-xl border border-border p-6 shadow-card">
              <div className="flex items-center gap-3 mb-6">
                <FileText className="w-5 h-5 text-accent" />
                <h3 className="text-lg font-semibold text-foreground">Documentation</h3>
              </div>
              
              <div className="space-y-6">
                {/* Role & Permissions Guide */}
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-foreground">Role & Permissions Guide</p>
                      <p className="text-sm text-muted-foreground">
                        Complete user manual with role definitions, permissions, and responsibilities
                      </p>
                    </div>
                    <Button onClick={generateRoleDocumentationPDF} variant="outline" className="gap-2 shrink-0">
                      <Download className="w-4 h-4" />
                      Download
                    </Button>
                  </div>
                </div>

                {/* QA Process Guide */}
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-foreground">QA Process Guide</p>
                      <p className="text-sm text-muted-foreground">
                        Complete QA scoring documentation with rubric details, AI prompts, and calculation methods
                      </p>
                    </div>
                    <Button onClick={generateQADocumentationPDF} variant="outline" className="gap-2 shrink-0">
                      <Download className="w-4 h-4" />
                      Download
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
