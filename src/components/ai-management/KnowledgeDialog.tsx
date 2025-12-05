import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CATEGORY_OPTIONS = [
  { value: "products", label: "Products" },
  { value: "policies", label: "Policies" },
  { value: "faq", label: "FAQ" },
  { value: "pricing", label: "Pricing" },
  { value: "processes", label: "Processes" },
  { value: "other", label: "Other" },
];

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

interface KnowledgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  knowledge?: Knowledge | null;
  onSuccess: () => void;
}

export function KnowledgeDialog({ open, onOpenChange, knowledge, onSuccess }: KnowledgeDialogProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("products");
  const [content, setContent] = useState("");
  const [selectedCallTypes, setSelectedCallTypes] = useState<string[]>([]);
  const [priority, setPriority] = useState(50);
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [callTypes, setCallTypes] = useState<CallType[]>([]);

  useEffect(() => {
    if (open) {
      fetchCallTypes();
    }
  }, [open]);

  useEffect(() => {
    if (knowledge) {
      setTitle(knowledge.title);
      setCategory(knowledge.category);
      setContent(knowledge.content);
      setSelectedCallTypes(knowledge.call_type_ids || []);
      setPriority(knowledge.priority || 50);
      setIsActive(knowledge.is_active !== false);
    } else {
      setTitle("");
      setCategory("products");
      setContent("");
      setSelectedCallTypes([]);
      setPriority(50);
      setIsActive(true);
    }
  }, [knowledge, open]);

  const fetchCallTypes = async () => {
    const { data } = await supabase
      .from("call_types")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    if (data) setCallTypes(data);
  };

  const handleCallTypeToggle = (callTypeId: string) => {
    setSelectedCallTypes(prev => 
      prev.includes(callTypeId)
        ? prev.filter(id => id !== callTypeId)
        : [...prev, callTypeId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!content.trim()) {
      toast.error("Content is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = {
        title: title.trim(),
        category,
        content: content.trim(),
        call_type_ids: selectedCallTypes.length > 0 ? selectedCallTypes : null,
        priority,
        is_active: isActive,
      };

      if (knowledge) {
        const { error } = await supabase
          .from("company_knowledge")
          .update(data)
          .eq("id", knowledge.id);
        if (error) throw error;
        toast.success("Knowledge entry updated");
      } else {
        const { error } = await supabase
          .from("company_knowledge")
          .insert(data);
        if (error) throw error;
        toast.success("Knowledge entry created");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save knowledge entry");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{knowledge ? "Edit Knowledge Entry" : "Add Knowledge Entry"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Pricing Policy, Move-in Process"
            />
          </div>

          <div className="space-y-2">
            <Label>Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content *</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter the knowledge content that the AI should use when analyzing calls..."
              rows={6}
            />
            <p className="text-xs text-muted-foreground">
              This content will be included in AI prompts to provide context during call analysis.
            </p>
          </div>

          {callTypes.length > 0 && (
            <div className="space-y-2">
              <Label>Apply to Call Types</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Leave all unchecked to apply to all call types
              </p>
              <div className="grid grid-cols-2 gap-2 p-3 border rounded-md bg-muted/30">
                {callTypes.map((ct) => (
                  <div key={ct.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`ct-${ct.id}`}
                      checked={selectedCallTypes.includes(ct.id)}
                      onCheckedChange={() => handleCallTypeToggle(ct.id)}
                    />
                    <Label htmlFor={`ct-${ct.id}`} className="cursor-pointer text-sm font-normal">
                      {ct.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="priority">Priority (1-100)</Label>
            <Input
              id="priority"
              type="number"
              min={1}
              max={100}
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value) || 50)}
            />
            <p className="text-xs text-muted-foreground">
              Higher priority entries appear first in AI prompts
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="isActive" className="cursor-pointer">Active</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : knowledge ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
