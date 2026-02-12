import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, FileText, ClipboardList, Eye, Upload, Play } from 'lucide-react';
import { useResearchScripts, type ResearchScript, type ScriptQuestion } from '@/hooks/useResearchScripts';
import { ResearchScriptDialog } from '@/components/research/ResearchScriptDialog';
import { ResearchScriptImportDialog } from '@/components/research/ResearchScriptImportDialog';
import { ScriptTesterDialog } from '@/components/research/ScriptTesterDialog';
import { Skeleton } from '@/components/ui/skeleton';

const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  satisfaction: 'Satisfaction',
  market_research: 'Market Research',
  retention: 'Retention',
};

const AUDIENCE_LABELS: Record<string, string> = {
  existing_member: 'Existing Members',
  former_booking: 'Former Bookings',
  rejected: 'Rejected Leads',
};

export default function ScriptBuilder() {
  const { scripts, isLoading, createScript, updateScript, deleteScript } = useResearchScripts();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<ResearchScript | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ResearchScript | null>(null);
  const [filterType, setFilterType] = useState('all');
  const [importOpen, setImportOpen] = useState(false);
  const [testScript, setTestScript] = useState<ResearchScript | null>(null);

  // State for pre-populating dialog from AI import
  const [importedData, setImportedData] = useState<any>(null);

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
            {filtered.map(script => (
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
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {script.questions.length} question{script.questions.length !== 1 ? 's' : ''} • Created {new Date(script.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
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
