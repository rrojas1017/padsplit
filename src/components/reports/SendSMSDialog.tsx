import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Send, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

interface SendSMSDialogProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  recipientPhone: string;
  memberName: string;
  marketCity?: string;
  marketState?: string;
  moveInDate?: Date;
  status?: string;
  onSMSSent?: () => void;
}

type TemplateType = 'quick-follow-up' | 'move-in-reminder' | 're-engagement' | 'custom';

interface SMSTemplate {
  id: TemplateType;
  label: string;
  message: string;
}

// SMS segment calculation constants
const GSM7_SINGLE_MAX = 160;
const GSM7_CONCAT_MAX = 153;

function calculateSMSSegments(message: string): { chars: number; segments: number } {
  const chars = message.length;
  if (chars === 0) return { chars: 0, segments: 0 };
  if (chars <= GSM7_SINGLE_MAX) return { chars, segments: 1 };
  return { chars, segments: Math.ceil(chars / GSM7_CONCAT_MAX) };
}

export function SendSMSDialog({
  isOpen,
  onClose,
  bookingId,
  recipientPhone,
  memberName,
  marketCity,
  marketState,
  moveInDate,
  status,
  onSMSSent,
}: SendSMSDialogProps) {
  const { user } = useAuth();
  const [isSending, setIsSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('quick-follow-up');
  const [message, setMessage] = useState('');

  const agentFirstName = user?.name?.split(' ')[0] || 'Your Agent';
  const memberFirstName = memberName.split(' ')[0];
  const formattedMoveIn = moveInDate ? format(moveInDate, 'MMM d') : '';
  const market = marketCity || marketState || 'your area';

  // Format phone for display
  const formattedPhone = useMemo(() => {
    const digits = recipientPhone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return recipientPhone;
  }, [recipientPhone]);

  // Define templates with placeholders replaced
  const templates: SMSTemplate[] = useMemo(() => [
    {
      id: 'quick-follow-up',
      label: 'Quick Follow-Up',
      message: `Hi ${memberFirstName}, checking in on your PadSplit interest in ${market}. Any questions? -${agentFirstName}`,
    },
    {
      id: 'move-in-reminder',
      label: 'Move-In Reminder',
      message: `Hi ${memberFirstName}, reminder about your move-in${formattedMoveIn ? ` on ${formattedMoveIn}` : ''}. Need anything? -${agentFirstName}`,
    },
    {
      id: 're-engagement',
      label: 'Re-Engagement',
      message: `Hi ${memberFirstName}, still looking in ${market}? I can help find the right fit. -${agentFirstName}`,
    },
    {
      id: 'custom',
      label: 'Custom Message',
      message: `Hi ${memberFirstName},\n\n-${agentFirstName}`,
    },
  ], [memberFirstName, market, formattedMoveIn, agentFirstName]);

  // Update message when template changes
  useEffect(() => {
    const template = templates.find(t => t.id === selectedTemplate);
    if (template) {
      setMessage(template.message);
    }
  }, [selectedTemplate, templates]);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Default to appropriate template based on status
      if (status === 'Pending Move-In') {
        setSelectedTemplate('move-in-reminder');
      } else if (status === 'Non Booking' || status === 'Postponed') {
        setSelectedTemplate('re-engagement');
      } else {
        setSelectedTemplate('quick-follow-up');
      }
    }
  }, [isOpen, status]);

  const { chars, segments } = calculateSMSSegments(message);
  const isOverLimit = chars > 1600;

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    if (isOverLimit) {
      toast.error('Message is too long. Maximum 1600 characters.');
      return;
    }

    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-follow-up-sms', {
        body: {
          bookingId,
          recipientPhone,
          recipientName: memberName,
          message: message.trim(),
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to send SMS');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success('SMS sent successfully!');
      onSMSSent?.();
      onClose();
    } catch (error: any) {
      console.error('Error sending SMS:', error);
      toast.error(error.message || 'Failed to send SMS');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Send SMS
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Recipient */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">To</Label>
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <span className="font-medium">{memberName}</span>
              <span className="text-muted-foreground">({formattedPhone})</span>
            </div>
          </div>

          {/* Template Selector */}
          <div className="space-y-2">
            <Label htmlFor="template">Template</Label>
            <Select value={selectedTemplate} onValueChange={(v) => setSelectedTemplate(v as TemplateType)}>
              <SelectTrigger id="template">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Message Body */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="message">Message</Label>
              <div className="flex items-center gap-2 text-xs">
                <span className={chars > GSM7_SINGLE_MAX ? 'text-warning' : 'text-muted-foreground'}>
                  {chars} chars
                </span>
                <span className="text-muted-foreground">•</span>
                <span className={segments > 1 ? 'text-warning font-medium' : 'text-muted-foreground'}>
                  {segments} {segments === 1 ? 'segment' : 'segments'}
                </span>
              </div>
            </div>
            
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Your message..."
              className="min-h-[120px] resize-y"
              maxLength={1600}
            />

            {segments > 1 && (
              <p className="text-xs text-muted-foreground">
                💡 Messages over 160 characters are sent as multiple segments and may cost more.
              </p>
            )}

            {isOverLimit && (
              <p className="text-xs text-destructive">
                Message exceeds maximum length of 1600 characters.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isSending}>
            Cancel
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={isSending || !message.trim() || isOverLimit}
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send SMS
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
