import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Phone, PhoneCall, PhoneIncoming, PhoneOutgoing, Headphones, MessageSquare, Users, HelpCircle, ClipboardList, Target } from "lucide-react";
import { CallTypeDialog } from "./CallTypeDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  "phone": Phone,
  "phone-call": PhoneCall,
  "phone-incoming": PhoneIncoming,
  "phone-outgoing": PhoneOutgoing,
  "headphones": Headphones,
  "message-square": MessageSquare,
  "users": Users,
  "help-circle": HelpCircle,
  "clipboard-list": ClipboardList,
  "target": Target,
};

interface CallType {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  analysis_focus: string | null;
  is_default: boolean | null;
  is_active: boolean | null;
  created_at: string | null;
}

export function CallTypeList() {
  const [callTypes, setCallTypes] = useState<CallType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCallType, setEditingCallType] = useState<CallType | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingCallType, setDeletingCallType] = useState<CallType | null>(null);

  const fetchCallTypes = async () => {
    try {
      const { data, error } = await supabase
        .from("call_types")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      setCallTypes(data || []);
    } catch (error: any) {
      toast.error("Failed to load call types");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCallTypes();
  }, []);

  const handleToggleActive = async (callType: CallType) => {
    try {
      const { error } = await supabase
        .from("call_types")
        .update({ is_active: !callType.is_active })
        .eq("id", callType.id);

      if (error) throw error;
      toast.success(`Call type ${callType.is_active ? "deactivated" : "activated"}`);
      fetchCallTypes();
    } catch (error: any) {
      toast.error("Failed to update call type");
    }
  };

  const handleDelete = async () => {
    if (!deletingCallType) return;

    try {
      const { error } = await supabase
        .from("call_types")
        .delete()
        .eq("id", deletingCallType.id);

      if (error) throw error;
      toast.success("Call type deleted");
      fetchCallTypes();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete call type");
    } finally {
      setDeleteConfirmOpen(false);
      setDeletingCallType(null);
    }
  };

  const openEditDialog = (callType: CallType) => {
    setEditingCallType(callType);
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingCallType(null);
    setDialogOpen(true);
  };

  const confirmDelete = (callType: CallType) => {
    setDeletingCallType(callType);
    setDeleteConfirmOpen(true);
  };

  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading call types...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Define different types of calls for specialized AI analysis
        </p>
        <Button onClick={openCreateDialog} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Call Type
        </Button>
      </div>

      {callTypes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No call types configured yet.</p>
            <p className="text-sm">Add your first call type to customize AI analysis.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {callTypes.map((callType) => {
            const IconComponent = ICON_MAP[callType.icon || "phone"] || Phone;
            return (
              <Card key={callType.id} className={!callType.is_active ? "opacity-60" : ""}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium">{callType.name}</h4>
                          {callType.is_default && (
                            <Badge variant="secondary" className="text-xs">Default</Badge>
                          )}
                          {!callType.is_active && (
                            <Badge variant="outline" className="text-xs">Inactive</Badge>
                          )}
                        </div>
                        {callType.description && (
                          <p className="text-sm text-muted-foreground mt-1">{callType.description}</p>
                        )}
                        {callType.analysis_focus && (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                            <span className="font-medium">Focus:</span> {callType.analysis_focus}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={callType.is_active !== false}
                        onCheckedChange={() => handleToggleActive(callType)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(callType)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => confirmDelete(callType)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CallTypeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        callType={editingCallType}
        onSuccess={fetchCallTypes}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Call Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingCallType?.name}"? This will also delete all associated rules and scripts.
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
