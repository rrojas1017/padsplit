import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit2, Trash2, Save, Target, ClipboardCheck, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface QACategory {
  name: string;
  maxPoints: number;
  criteria: string;
}

interface QARubric {
  id: string;
  name: string;
  categories: QACategory[];
  isActive: boolean;
}

export function QARubricSettings() {
  const [rubric, setRubric] = useState<QARubric | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingCategory, setEditingCategory] = useState<QACategory | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<QACategory>({ name: '', maxPoints: 10, criteria: '' });

  useEffect(() => {
    fetchRubric();
  }, []);

  const fetchRubric = async () => {
    try {
      const { data, error } = await supabase
        .from('qa_settings')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (error) throw error;

      if (data) {
        setRubric({
          id: data.id,
          name: data.name,
          categories: data.categories as unknown as QACategory[],
          isActive: data.is_active ?? true,
        });
      }
    } catch (error) {
      console.error('Error fetching QA rubric:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveRubric = async () => {
    if (!rubric) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('qa_settings')
        .update({
          name: rubric.name,
          categories: rubric.categories as unknown as any,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rubric.id);

      if (error) throw error;

      toast.success('QA rubric saved successfully');
    } catch (error) {
      console.error('Error saving rubric:', error);
      toast.error('Failed to save QA rubric');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCategory = () => {
    if (!rubric || !newCategory.name) return;
    
    const updatedCategories = [...rubric.categories, newCategory];
    setRubric({ ...rubric, categories: updatedCategories });
    setNewCategory({ name: '', maxPoints: 10, criteria: '' });
    setCategoryDialogOpen(false);
  };

  const handleUpdateCategory = () => {
    if (!rubric || !editingCategory) return;
    
    const updatedCategories = rubric.categories.map(cat =>
      cat.name === editingCategory.name ? newCategory : cat
    );
    setRubric({ ...rubric, categories: updatedCategories });
    setEditingCategory(null);
    setNewCategory({ name: '', maxPoints: 10, criteria: '' });
    setCategoryDialogOpen(false);
  };

  const handleDeleteCategory = (categoryName: string) => {
    if (!rubric) return;
    
    const updatedCategories = rubric.categories.filter(cat => cat.name !== categoryName);
    setRubric({ ...rubric, categories: updatedCategories });
  };

  const openEditDialog = (category: QACategory) => {
    setEditingCategory(category);
    setNewCategory({ ...category });
    setCategoryDialogOpen(true);
  };

  const totalMaxPoints = rubric?.categories.reduce((sum, cat) => sum + cat.maxPoints, 0) || 0;

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading QA rubric...</div>;
  }

  if (!rubric) {
    return <div className="text-center py-8 text-muted-foreground">No QA rubric configured</div>;
  }

  return (
    <div className="space-y-6">
      {/* Rubric Name */}
      <div className="flex items-center justify-between">
        <div className="flex-1 max-w-md">
          <Label>Rubric Name</Label>
          <Input
            value={rubric.name}
            onChange={(e) => setRubric({ ...rubric, name: e.target.value })}
            className="mt-1"
          />
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1">
            <Target className="w-3 h-3" />
            {totalMaxPoints} Total Points
          </Badge>
          <Button onClick={handleSaveRubric} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Categories Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" />
            Scoring Categories
          </CardTitle>
          <Dialog open={categoryDialogOpen} onOpenChange={(open) => {
            setCategoryDialogOpen(open);
            if (!open) {
              setEditingCategory(null);
              setNewCategory({ name: '', maxPoints: 10, criteria: '' });
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCategory ? 'Edit Category' : 'Add Category'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Category Name</Label>
                  <Input
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                    placeholder="e.g., Greeting & Introduction"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Max Points</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={newCategory.maxPoints}
                    onChange={(e) => setNewCategory({ ...newCategory, maxPoints: parseInt(e.target.value) || 0 })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Scoring Criteria</Label>
                  <Textarea
                    value={newCategory.criteria}
                    onChange={(e) => setNewCategory({ ...newCategory, criteria: e.target.value })}
                    placeholder="Describe what the AI should evaluate for this category..."
                    rows={3}
                    className="mt-1"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
                <Button onClick={editingCategory ? handleUpdateCategory : handleAddCategory}>
                  {editingCategory ? 'Update' : 'Add'} Category
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">Category</TableHead>
                <TableHead className="w-[100px] text-center">Max Points</TableHead>
                <TableHead>Criteria</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rubric.categories.map((category, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{category.maxPoints}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                    {category.criteria}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(category)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteCategory(category.name)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Info Box */}
      <div className="bg-muted/50 border rounded-lg p-4">
        <p className="text-sm text-muted-foreground">
          <strong>Note:</strong> Changes to the rubric will only affect future QA scores. 
          Previously scored calls will retain their original scores. 
          Use the "Score All Calls" button on the QA Dashboard to re-score existing calls with the updated rubric.
        </p>
      </div>
    </div>
  );
}
