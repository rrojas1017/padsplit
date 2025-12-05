import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, ScrollText, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { ScriptDialog } from "./ScriptDialog";

type ScriptTemplate = Tables<"script_templates">;
type CallType = Tables<"call_types">;

interface ScriptWithCallType extends ScriptTemplate {
  callTypeName?: string;
}

export function ScriptList() {
  const [scripts, setScripts] = useState<ScriptWithCallType[]>([]);
  const [callTypes, setCallTypes] = useState<CallType[]>([]);
  const [selectedCallType, setSelectedCallType] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<ScriptTemplate | null>(null);
  const [deleteScript, setDeleteScript] = useState<ScriptTemplate | null>(null);
  const [expandedScript, setExpandedScript] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    
    const [scriptsRes, callTypesRes] = await Promise.all([
      supabase.from("script_templates").select("*").order("name"),
      supabase.from("call_types").select("*").eq("is_active", true).order("name"),
    ]);

    if (scriptsRes.error) {
      console.error("Error fetching scripts:", scriptsRes.error);
      toast.error("Failed to load scripts");
    }

    if (callTypesRes.error) {
      console.error("Error fetching call types:", callTypesRes.error);
    }

    const callTypesData = callTypesRes.data || [];
    const scriptsData = scriptsRes.data || [];

    // Map call type names to scripts
    const scriptsWithNames = scriptsData.map((script) => ({
      ...script,
      callTypeName: callTypesData.find((ct) => ct.id === script.call_type_id)?.name,
    }));

    setScripts(scriptsWithNames);
    setCallTypes(callTypesData);
    setIsLoading(false);
  };

  const handleEdit = (script: ScriptTemplate) => {
    setEditingScript(script);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingScript(null);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteScript) return;

    const { error } = await supabase
      .from("script_templates")
      .delete()
      .eq("id", deleteScript.id);

    if (error) {
      console.error("Error deleting script:", error);
      toast.error("Failed to delete script");
      return;
    }

    toast.success("Script deleted successfully");
    setDeleteScript(null);
    fetchData();
  };

  const filteredScripts = selectedCallType === "all"
    ? scripts
    : scripts.filter((s) => s.call_type_id === selectedCallType);

  const truncateContent = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + "...";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Select value={selectedCallType} onValueChange={setSelectedCallType}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by call type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Call Types</SelectItem>
            {callTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={handleAdd} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Script
        </Button>
      </div>

      {filteredScripts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No scripts found</p>
          <p className="text-sm">
            {selectedCallType === "all"
              ? "Create your first script template to get started"
              : "No scripts for this call type"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredScripts.map((script) => (
            <Card key={script.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-medium">
                        {script.name}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        {script.callTypeName && (
                          <Badge variant="outline" className="text-xs">
                            {script.callTypeName}
                          </Badge>
                        )}
                        <Badge
                          variant={script.is_active ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {script.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(script)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteScript(script)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground font-mono bg-muted/50 p-3 rounded-md">
                  {expandedScript === script.id
                    ? script.script_content
                    : truncateContent(script.script_content)}
                </div>
                {script.script_content.length > 150 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-xs"
                    onClick={() =>
                      setExpandedScript(
                        expandedScript === script.id ? null : script.id
                      )
                    }
                  >
                    {expandedScript === script.id ? "Show less" : "Show more"}
                  </Button>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  {script.script_content.length.toLocaleString()} characters
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ScriptDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        script={editingScript}
        onSaved={fetchData}
      />

      <AlertDialog open={!!deleteScript} onOpenChange={() => setDeleteScript(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Script Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteScript?.name}"? This action cannot be undone.
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
    </div>
  );
}
