import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, FileText, ClipboardList, Eye, ToggleLeft, ToggleRight } from 'lucide-react';
import { useResearchScripts, type ResearchScript, type ScriptQuestion } from '@/hooks/useResearchScripts';
import { ResearchScriptDialog } from '@/components/research/ResearchScriptDialog';
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

const QUESTION_TYPE_LABELS: Record<string, string> = {
  scale: 'Scale (1-10)',
  open_ended: 'Open Ended',
  multiple_choice: 'Multiple Choice',
  yes_no: 'Yes/No',
};

export default function ScriptBuilder() {
  const { scripts, isLoading, createScript, updateScript, deleteScript } = useResearchScripts();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<ResearchScript | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ResearchScript | null>(null);
  const [previewScript, setPreviewScript] = useState<ResearchScript | null>(null);
  const [filterType, setFilterType] = useState('all');

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

  return (
    <DashboardLayout
      title="Script Builder"
      subtitle="Create questionnaires for research campaigns"
      actions={
        <Button onClick={() => { setEditingScript(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> New Script
        </Button>
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
            <p className="text-sm text-muted-foreground mb-4">Create a questionnaire to guide researchers during calls</p>
            <Button onClick={() => { setEditingScript(null); setDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Create First Script
            </Button>
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
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreviewScript(script)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingScript(script); setDialogOpen(true); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteTarget(script)}>
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
        onOpenChange={setDialogOpen}
        script={editingScript}
        onSave={handleSave}
      />

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

      {/* Preview dialog */}
      {previewScript && (
        <PreviewDialog script={previewScript} onClose={() => setPreviewScript(null)} />
      )}
    </DashboardLayout>
  );
}

function PreviewDialog({ script, onClose }: { script: ResearchScript; onClose: () => void }) {
  return (
    <AlertDialog open onOpenChange={onClose}>
      <AlertDialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Script Preview
          </AlertDialogTitle>
          <AlertDialogDescription>
            Full call flow as the researcher will experience it
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <h4 className="font-semibold text-sm">{script.name}</h4>
            {script.description && <p className="text-xs text-muted-foreground mt-0.5">{script.description}</p>}
          </div>

          {/* Intro Script */}
          {script.intro_script && (
            <div className="border rounded-lg p-3 space-y-1 bg-primary/5">
              <Badge variant="outline" className="text-xs">Opening Introduction</Badge>
              <p className="text-sm whitespace-pre-wrap">{script.intro_script}</p>
            </div>
          )}

          {/* Consent Gate */}
          <div className="border rounded-lg p-3 space-y-2 bg-accent/30">
            <Badge variant="outline" className="text-xs">Consent Gate</Badge>
            <p className="text-sm italic">"May I ask you a few questions?"</p>
            <div className="flex gap-2">
              <Badge>Yes → Questions</Badge>
              <Badge variant="secondary">No → Rebuttal</Badge>
            </div>
          </div>

          {/* Questions */}
          {script.questions.map((q, idx) => (
            <div key={idx} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs shrink-0">Q{q.order}</Badge>
                <span className="text-sm font-medium">{q.question}</span>
                {q.required && <span className="text-destructive text-xs">*</span>}
              </div>
              <div className="pl-8">
                {q.type === 'scale' && (
                  <div className="flex gap-1">
                    {Array.from({ length: 10 }, (_, i) => (
                      <div key={i} className="w-7 h-7 rounded border border-border flex items-center justify-center text-xs text-muted-foreground">{i + 1}</div>
                    ))}
                  </div>
                )}
                {q.type === 'yes_no' && (
                  <div className="flex gap-2">
                    <Badge variant="outline">Yes</Badge>
                    <Badge variant="outline">No</Badge>
                  </div>
                )}
                {q.type === 'multiple_choice' && (
                  <div className="space-y-1">
                    {(q.options || []).map((opt, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full border border-border" />
                        {opt}
                      </div>
                    ))}
                  </div>
                )}
                {q.type === 'open_ended' && (
                  <div className="border border-dashed border-border rounded-md h-16 flex items-center justify-center text-xs text-muted-foreground">
                    Free-text response (AI extracts from recording)
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Closing Script */}
          {script.closing_script && (
            <div className="border rounded-lg p-3 space-y-1 bg-primary/5">
              <Badge variant="outline" className="text-xs">Closing Script</Badge>
              <p className="text-sm whitespace-pre-wrap">{script.closing_script}</p>
            </div>
          )}

          {/* Rebuttal Script */}
          {script.rebuttal_script && (
            <div className="border rounded-lg p-3 space-y-1 bg-destructive/5">
              <Badge variant="outline" className="text-xs">Rebuttal (if declined)</Badge>
              <p className="text-sm whitespace-pre-wrap">{script.rebuttal_script}</p>
            </div>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onClose}>Close</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
