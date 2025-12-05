import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { KnowledgeDialog } from "./KnowledgeDialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CallType {
  id: string;
  name: string;
}

interface Knowledge {
  id: string;
  title: string;
  category: string;
  content: string;
  call_type_ids: string[] | null;
  priority: number | null;
  is_active: boolean | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  products: "Products",
  policies: "Policies",
  faq: "FAQ",
  pricing: "Pricing",
  processes: "Processes",
  other: "Other",
};

const CATEGORY_COLORS: Record<string, string> = {
  products: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  policies: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  faq: "bg-green-500/10 text-green-600 border-green-500/20",
  pricing: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  processes: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  other: "bg-gray-500/10 text-gray-600 border-gray-500/20",
};

export function KnowledgeList() {
  const [knowledgeList, setKnowledgeList] = useState<Knowledge[]>([]);
  const [callTypes, setCallTypes] = useState<CallType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKnowledge, setEditingKnowledge] = useState<Knowledge | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [knowledgeRes, callTypesRes] = await Promise.all([
      supabase
        .from("company_knowledge")
        .select("*")
        .order("priority", { ascending: false })
        .order("title"),
      supabase
        .from("call_types")
        .select("id, name")
        .eq("is_active", true)
        .order("name"),
    ]);

    if (knowledgeRes.data) setKnowledgeList(knowledgeRes.data);
    if (callTypesRes.data) setCallTypes(callTypesRes.data);
    setLoading(false);
  };

  const handleEdit = (knowledge: Knowledge) => {
    setEditingKnowledge(knowledge);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingKnowledge(null);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase
        .from("company_knowledge")
        .delete()
        .eq("id", deleteId);
      if (error) throw error;
      toast.success("Knowledge entry deleted");
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete");
    }
    setDeleteId(null);
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getCallTypeNames = (callTypeIds: string[] | null) => {
    if (!callTypeIds || callTypeIds.length === 0) return "All Types";
    return callTypeIds
      .map(id => callTypes.find(ct => ct.id === id)?.name)
      .filter(Boolean)
      .join(", ") || "All Types";
  };

  const filteredList = categoryFilter === "all"
    ? knowledgeList
    : knowledgeList.filter(k => k.category === categoryFilter);

  const uniqueCategories = [...new Set(knowledgeList.map(k => k.category))];

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {uniqueCategories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {CATEGORY_LABELS[cat] || cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleAdd} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Knowledge
          </Button>
        </div>

        {filteredList.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No knowledge entries</p>
            <p className="text-sm">Add product info, policies, or FAQs for better AI insights</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredList.map((knowledge) => {
              const isExpanded = expandedIds.has(knowledge.id);
              const contentPreview = knowledge.content.length > 150
                ? knowledge.content.substring(0, 150) + "..."
                : knowledge.content;

              return (
                <div
                  key={knowledge.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    knowledge.is_active !== false
                      ? "bg-muted/30 border-border"
                      : "bg-muted/10 border-border/50 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-medium text-foreground">{knowledge.title}</h4>
                        <Badge 
                          variant="outline" 
                          className={CATEGORY_COLORS[knowledge.category] || CATEGORY_COLORS.other}
                        >
                          {CATEGORY_LABELS[knowledge.category] || knowledge.category}
                        </Badge>
                        {knowledge.is_active === false && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          Priority: {knowledge.priority || 50}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        Applies to: {getCallTypeNames(knowledge.call_type_ids)}
                      </p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {isExpanded ? knowledge.content : contentPreview}
                      </p>
                      {knowledge.content.length > 150 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpanded(knowledge.id)}
                          className="mt-1 h-auto p-0 text-xs text-primary hover:text-primary/80"
                        >
                          {isExpanded ? (
                            <>Show less <ChevronUp className="w-3 h-3 ml-1" /></>
                          ) : (
                            <>Show more <ChevronDown className="w-3 h-3 ml-1" /></>
                          )}
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(knowledge)}
                        className="h-8 w-8"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(knowledge.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <KnowledgeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        knowledge={editingKnowledge}
        onSuccess={fetchData}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Knowledge Entry</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this knowledge entry. This action cannot be undone.
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
    </>
  );
}
