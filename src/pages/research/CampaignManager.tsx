import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Search, Pencil, Trash2, Users, Target, CalendarRange, FileText, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useResearchCampaigns, type ResearchCampaign, type CampaignInput } from '@/hooks/useResearchCampaigns';
import { useResearchScripts } from '@/hooks/useResearchScripts';
import { ResearchCampaignDialog } from '@/components/research/ResearchCampaignDialog';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  completed: 'bg-muted text-muted-foreground',
};

export default function CampaignManager() {
  const { campaigns, researchers, isLoading, createCampaign, updateCampaign, deleteCampaign } = useResearchCampaigns();
  const { scripts } = useResearchScripts();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<ResearchCampaign | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = campaigns.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleSave = async (data: CampaignInput) => {
    if (editingCampaign) {
      await updateCampaign(editingCampaign.id, data);
    } else {
      await createCampaign(data);
    }
  };

  const openCreate = () => {
    setEditingCampaign(null);
    setDialogOpen(true);
  };

  const openEdit = (c: ResearchCampaign) => {
    setEditingCampaign(c);
    setDialogOpen(true);
  };

  const getResearcherNames = (ids: string[]) => {
    return ids.map(id => {
      const r = researchers.find(r => r.id === id);
      return r?.name || r?.email || 'Unknown';
    });
  };

  return (
    <DashboardLayout title="Campaign Manager" subtitle="Create campaigns, assign scripts and researchers, track progress">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search campaigns..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> New Campaign
        </Button>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-6 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        /* Empty state */
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Target className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No campaigns found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {search || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first campaign to organize research efforts'}
            </p>
            {!search && statusFilter === 'all' && (
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" /> Create First Campaign
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Campaign cards */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(c => {
            const progress = c.target_count > 0 ? Math.min(100, Math.round(((c.completed_calls || 0) / c.target_count) * 100)) : 0;
            const researcherNames = getResearcherNames(c.assigned_researchers);

            return (
              <Card key={c.id} className="group hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{c.name}</CardTitle>
                      <div className="flex items-center gap-1.5 mt-1">
                        <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground truncate">{c.script_name}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="font-mono text-[10px] text-muted-foreground">ID: {c.id.slice(0, 8)}…</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(c.id);
                            toast.success('Campaign ID copied');
                          }}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Copy className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                    <Badge className={`shrink-0 text-xs ${STATUS_COLORS[c.status] || ''}`}>
                      {c.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {/* Progress */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>{c.completed_calls || 0} / {c.target_count} calls</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>

                  {/* Date range */}
                  {(c.start_date || c.end_date) && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarRange className="w-3 h-3 shrink-0" />
                      <span>
                        {c.start_date ? new Date(c.start_date).toLocaleDateString() : '—'}
                        {' → '}
                        {c.end_date ? new Date(c.end_date).toLocaleDateString() : '—'}
                      </span>
                    </div>
                  )}

                  {/* Researchers */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      {researcherNames.length} researcher{researcherNames.length !== 1 ? 's' : ''}
                      {researcherNames.length <= 3 && `: ${researcherNames.join(', ')}`}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEdit(c)}>
                      <Pencil className="w-3 h-3 mr-1" /> Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive">
                          <Trash2 className="w-3 h-3 mr-1" /> Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete "{c.name}". This action cannot be undone. Campaigns with logged calls cannot be deleted.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteCampaign(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ResearchCampaignDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        campaign={editingCampaign}
        scripts={scripts}
        researchers={researchers}
        onSave={handleSave}
      />
    </DashboardLayout>
  );
}
