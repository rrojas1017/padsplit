import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Pencil, Trash2, FileText, ClipboardList, Eye, Upload, Play, Link, Copy, RefreshCw, X, Languages, Loader2 } from 'lucide-react';
import { useResearchScripts, type ResearchScript } from '@/hooks/useResearchScripts';
import { useScriptTokens, getScriptPublicUrl } from '@/hooks/useScriptTokens';
import { ResearchScriptDialog } from '@/components/research/ResearchScriptDialog';
import { ResearchScriptImportDialog } from '@/components/research/ResearchScriptImportDialog';
import { ScriptTesterDialog } from '@/components/research/ScriptTesterDialog';
import { ScriptWizard } from '@/components/script-builder/ScriptWizard';
import type { WizardData } from '@/components/script-builder/StepUpload';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  satisfaction: 'Satisfaction',
  market_research: 'Market Research',
  retention: 'Retention',
  audience_survey: 'Audience Survey',
};

const AUDIENCE_LABELS: Record<string, string> = {
  existing_member: 'Existing Members',
  former_booking: 'Former Bookings',
  rejected: 'Rejected Leads',
  account_created: 'Account Created',
  application_started: 'Application Started',
  approved_not_booked: 'Approved (Not Booked)',
  active_member: 'Active Members',
};

export default function ScriptBuilder() {
  const { scripts, isLoading, createScript, updateScript, deleteScript, retranslateScript } = useResearchScripts();
  const scriptIds = scripts.map(s => s.id);
  const { tokens, generateToken, copyToken, revokeToken, regenerateToken } = useScriptTokens(scriptIds);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<ResearchScript | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ResearchScript | null>(null);
  const [filterType, setFilterType] = useState('all');
  const [importOpen, setImportOpen] = useState(false);
  const [testScript, setTestScript] = useState<ResearchScript | null>(null);
  const [importedData, setImportedData] = useState<any>(null);
  const [linkLoadingId, setLinkLoadingId] = useState<string | null>(null);
  const [wizardMode, setWizardMode] = useState(false);

  const filtered = filterType === 'all' ? scripts : scripts.filter(s => s.campaign_type === filterType);

  const handleSave = async (data: Omit<ResearchScript, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
    if (editingScript) {
      await updateScript(editingScript.id, data);
    } else {
      await createScript(data);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteScript(deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleImported = (data: any) => {
    setImportedData(data);
    setEditingScript(null);
    setDialogOpen(true);
  };

  const handleGenerateLink = async (scriptId: string) => {
    setLinkLoadingId(scriptId);
    await generateToken(scriptId);
    setLinkLoadingId(null);
  };

  const handleWizardSave = async (wizardData: WizardData, isDraft: boolean) => {
    await createScript({
      name: wizardData.name,
      description: wizardData.description || null,
      campaign_type: wizardData.campaignType,
      target_audience: wizardData.targetAudience,
      questions: wizardData.questions,
      intro_script: wizardData.introScript || null,
      rebuttal_script: wizardData.rebuttalScript || null,
      closing_script: wizardData.closingScript || null,
      is_active: isDraft ? false : wizardData.isActive,
    } as any);
    setWizardMode(false);
    toast.success(isDraft ? 'Script saved as draft' : 'Script launched!');
  };

  // Wizard mode
  if (wizardMode) {
    return (
      <DashboardLayout title="Script Builder" subtitle="Create a new research script">
        <ScriptWizard onClose={() => setWizardMode(false)} onSave={handleWizardSave} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Script Builder"
      subtitle="Create questionnaires for research campaigns"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4 mr-2" /> Import from Document
          </Button>
          <Button onClick={() => { setEditingScript(null); setImportedData(null); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> New Script
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Filter bar */}
        <div className="flex items-center gap-4">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Campaign Types</SelectItem>
              <SelectItem value="satisfaction">Satisfaction</SelectItem>
              <SelectItem value="market_research">Market Research</SelectItem>
              <SelectItem value="retention">Retention</SelectItem>
              <SelectItem value="audience_survey">Audience Survey</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{filtered.length} script{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3].map(i => (
              <Card key={i}><CardContent className="p-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-16">
            <ClipboardList className="w-14 h-14 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-1">No scripts found</h3>
            <p className="text-sm text-muted-foreground mb-4">Create a questionnaire or import from a Word document</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="w-4 h-4 mr-2" /> Import from Document
              </Button>
              <Button onClick={() => { setEditingScript(null); setImportedData(null); setDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Create First Script
              </Button>
            </div>
          </div>
        )}

        {/* Script cards */}
        {!isLoading && filtered.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map(script => {
              const token = tokens[script.id];
              const hasToken = !!token;

              return (
                <Card key={script.id} className="relative group hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                          <FileText className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-base font-medium truncate">{script.name}</CardTitle>
                          {script.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{script.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-0.5 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Test Script" onClick={() => setTestScript(script)}>
                          <Play className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => { setEditingScript(script); setImportedData(null); setDialogOpen(true); }}>
                          <Pencil className="w-4 h-4" />
                        </Button>

                        {/* External Link button */}
                        {hasToken ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="External Link">
                                <Link className="w-4 h-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-4 space-y-3" align="end">
                              <div className="space-y-1">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Public Script Link</p>
                                <p className="text-xs text-muted-foreground break-all bg-muted rounded px-2 py-1 font-mono">
                                  {getScriptPublicUrl(token.token)}
                                </p>
                                {token.last_accessed_at && (
                                  <p className="text-xs text-muted-foreground">
                                    Last accessed: {new Date(token.last_accessed_at).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" className="flex-1" onClick={() => copyToken(token)}>
                                  <Copy className="w-3 h-3 mr-1.5" /> Copy Link
                                </Button>
                                <Button size="sm" variant="outline" className="flex-1" onClick={() => regenerateToken(script.id)}>
                                  <RefreshCw className="w-3 h-3 mr-1.5" /> Regenerate
                                </Button>
                                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => revokeToken(token.id, script.id)}>
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground"
                            title="Generate External Link"
                            disabled={linkLoadingId === script.id}
                            onClick={() => handleGenerateLink(script.id)}
                          >
                            <Link className="w-4 h-4" />
                          </Button>
                        )}

                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Delete" onClick={() => setDeleteTarget(script)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <Badge variant="outline" className="text-xs">{CAMPAIGN_TYPE_LABELS[script.campaign_type] || script.campaign_type}</Badge>
                      <Badge variant="secondary" className="text-xs">{AUDIENCE_LABELS[script.target_audience] || script.target_audience}</Badge>
                      <Badge variant={script.is_active ? 'default' : 'secondary'} className="text-xs">
                        {script.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      {hasToken && (
                        <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                          <Link className="w-2.5 h-2.5 mr-1" /> Public Link Active
                        </Badge>
                      )}
                      {/* Translation status badge */}
                      {script.translation_status === 'completed' && (
                        <Badge variant="outline" className="text-xs border-green-500/50 text-green-600 dark:text-green-400">
                          <Languages className="w-2.5 h-2.5 mr-1" /> ES: Ready
                        </Badge>
                      )}
                      {script.translation_status === 'translating' && (
                        <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-600 dark:text-amber-400">
                          <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" /> ES: Translating…
                        </Badge>
                      )}
                      {script.translation_status === 'failed' && (
                        <Badge
                          variant="outline"
                          className="text-xs border-destructive/50 text-destructive cursor-pointer hover:bg-destructive/10"
                          onClick={() => retranslateScript(script.id)}
                        >
                          <RefreshCw className="w-2.5 h-2.5 mr-1" /> ES: Failed — Retry
                        </Badge>
                      )}
                      {script.translation_status === 'pending' && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          <Languages className="w-2.5 h-2.5 mr-1" /> ES: Pending
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {script.questions.length} question{script.questions.length !== 1 ? 's' : ''} • Created {new Date(script.created_at).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit dialog */}
      <ResearchScriptDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setImportedData(null); }}
        script={editingScript}
        onSave={handleSave}
        importedData={importedData}
      />

      {/* Import dialog */}
      <ResearchScriptImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={handleImported}
      />

      {/* Test Script dialog */}
      {testScript && (
        <ScriptTesterDialog
          open={!!testScript}
          onOpenChange={(v) => { if (!v) setTestScript(null); }}
          script={testScript}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Script</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This cannot be undone. Any campaigns using this script will be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
