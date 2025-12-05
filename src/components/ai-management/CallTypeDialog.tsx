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
import { Phone, PhoneCall, PhoneIncoming, PhoneOutgoing, Headphones, MessageSquare, Users, HelpCircle, ClipboardList, Target } from "lucide-react";

const ICON_OPTIONS = [
  { value: "phone", label: "Phone", Icon: Phone },
  { value: "phone-call", label: "Phone Call", Icon: PhoneCall },
  { value: "phone-incoming", label: "Incoming", Icon: PhoneIncoming },
  { value: "phone-outgoing", label: "Outgoing", Icon: PhoneOutgoing },
  { value: "headphones", label: "Headphones", Icon: Headphones },
  { value: "message-square", label: "Message", Icon: MessageSquare },
  { value: "users", label: "Users", Icon: Users },
  { value: "help-circle", label: "Help", Icon: HelpCircle },
  { value: "clipboard-list", label: "Clipboard", Icon: ClipboardList },
  { value: "target", label: "Target", Icon: Target },
];

interface CallType {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  analysis_focus: string | null;
  is_default: boolean | null;
  is_active: boolean | null;
}

interface CallTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callType?: CallType | null;
  onSuccess: () => void;
}

export function CallTypeDialog({ open, onOpenChange, callType, onSuccess }: CallTypeDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("phone");
  const [analysisFocus, setAnalysisFocus] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (callType) {
      setName(callType.name);
      setDescription(callType.description || "");
      setIcon(callType.icon || "phone");
      setAnalysisFocus(callType.analysis_focus || "");
      setIsDefault(callType.is_default || false);
      setIsActive(callType.is_active !== false);
    } else {
      setName("");
      setDescription("");
      setIcon("phone");
      setAnalysisFocus("");
      setIsDefault(false);
      setIsActive(true);
    }
  }, [callType, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      // If setting as default, unset other defaults first
      if (isDefault) {
        await supabase
          .from("call_types")
          .update({ is_default: false })
          .neq("id", callType?.id || "");
      }

      const data = {
        name: name.trim(),
        description: description.trim() || null,
        icon,
        analysis_focus: analysisFocus.trim() || null,
        is_default: isDefault,
        is_active: isActive,
      };

      if (callType) {
        const { error } = await supabase
          .from("call_types")
          .update(data)
          .eq("id", callType.id);
        if (error) throw error;
        toast.success("Call type updated");
      } else {
        const { error } = await supabase
          .from("call_types")
          .insert(data);
        if (error) throw error;
        toast.success("Call type created");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save call type");
    } finally {
      setIsSubmitting(false);
    }
  };

  const SelectedIcon = ICON_OPTIONS.find(opt => opt.value === icon)?.Icon || Phone;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{callType ? "Edit Call Type" : "Add Call Type"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Sales Call, Survey Call"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this call type"
            />
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <Select value={icon} onValueChange={setIcon}>
              <SelectTrigger>
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <SelectedIcon className="h-4 w-4" />
                    <span>{ICON_OPTIONS.find(opt => opt.value === icon)?.label}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ICON_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      <opt.Icon className="h-4 w-4" />
                      <span>{opt.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="analysisFocus">Analysis Focus</Label>
            <Textarea
              id="analysisFocus"
              value={analysisFocus}
              onChange={(e) => setAnalysisFocus(e.target.value)}
              placeholder="What should the AI focus on when analyzing this type of call? e.g., 'Focus on booking conversion, objection handling, and move-in readiness assessment'"
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                id="isDefault"
                checked={isDefault}
                onCheckedChange={setIsDefault}
              />
              <Label htmlFor="isDefault" className="cursor-pointer">Set as default for new bookings</Label>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="isActive" className="cursor-pointer">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : callType ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
