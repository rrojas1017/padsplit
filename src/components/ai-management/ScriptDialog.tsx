import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";

type ScriptTemplate = Tables<"script_templates">;
type CallType = Tables<"call_types">;

interface ScriptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  script?: ScriptTemplate | null;
  onSaved: () => void;
}

export function ScriptDialog({ open, onOpenChange, script, onSaved }: ScriptDialogProps) {
  const [name, setName] = useState("");
  const [callTypeId, setCallTypeId] = useState("");
  const [scriptContent, setScriptContent] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [callTypes, setCallTypes] = useState<CallType[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetchCallTypes();
      if (script) {
        setName(script.name);
        setCallTypeId(script.call_type_id || "");
        setScriptContent(script.script_content);
        setIsActive(script.is_active ?? true);
      } else {
        setName("");
        setCallTypeId("");
        setScriptContent("");
        setIsActive(true);
      }
    }
  }, [open, script]);

  const fetchCallTypes = async () => {
    const { data, error } = await supabase
      .from("call_types")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("Error fetching call types:", error);
      return;
    }
    setCallTypes(data || []);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Script name is required");
      return;
    }
    if (!callTypeId) {
      toast.error("Call type is required");
      return;
    }
    if (!scriptContent.trim()) {
      toast.error("Script content is required");
      return;
    }

    setIsSaving(true);

    const scriptData = {
      name: name.trim(),
      call_type_id: callTypeId,
      script_content: scriptContent.trim(),
      is_active: isActive,
    };

    try {
      if (script) {
        const { error } = await supabase
          .from("script_templates")
          .update(scriptData)
          .eq("id", script.id);

        if (error) throw error;
        toast.success("Script updated successfully");
      } else {
        const { error } = await supabase
          .from("script_templates")
          .insert(scriptData);

        if (error) throw error;
        toast.success("Script created successfully");
      }

      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving script:", error);
      toast.error(error.message || "Failed to save script");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{script ? "Edit Script Template" : "Add Script Template"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Script Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Inbound Sales Script v2"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="callType">Call Type *</Label>
            <Select value={callTypeId} onValueChange={setCallTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select call type" />
              </SelectTrigger>
              <SelectContent>
                {callTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scriptContent">Script Content *</Label>
            <Textarea
              id="scriptContent"
              value={scriptContent}
              onChange={(e) => setScriptContent(e.target.value)}
              placeholder="Enter the full conversation script here..."
              rows={12}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground text-right">
              {scriptContent.length.toLocaleString()} characters
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="isActive">Active</Label>
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : script ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
