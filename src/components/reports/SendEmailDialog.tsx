import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Send, Mail, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

interface SendEmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  recipientEmail: string;
  memberName: string;
  marketCity?: string;
  marketState?: string;
  moveInDate?: Date;
  status?: string;
  onEmailSent?: () => void;
}

type TemplateType = 'quick-follow-up' | 'move-in-reminder' | 're-engagement' | 'custom';

interface EmailTemplate {
  id: TemplateType;
  label: string;
  subject: string;
  body: string;
}

export function SendEmailDialog({
  isOpen,
  onClose,
  bookingId,
  recipientEmail,
  memberName,
  marketCity,
  marketState,
  moveInDate,
  status,
  onEmailSent,
}: SendEmailDialogProps) {
  const { user } = useAuth();
  const [isSending, setIsSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('quick-follow-up');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const agentName = user?.name || 'Your PadSplit Agent';
  const formattedMoveIn = moveInDate ? format(moveInDate, 'MMMM d, yyyy') : '';
  const market = marketCity && marketState ? `${marketCity}, ${marketState}` : marketCity || marketState || 'your area';

  // Define templates with placeholders replaced
  const templates: EmailTemplate[] = [
    {
      id: 'quick-follow-up',
      label: 'Quick Follow-Up',
      subject: `Following up on your PadSplit interest, ${memberName}`,
      body: `Hi ${memberName},

I wanted to check in following our recent conversation about PadSplit housing in ${market}.

Do you have any questions I can help answer?

Best regards,
${agentName}
PadSplit Team`,
    },
    {
      id: 'move-in-reminder',
      label: 'Move-In Reminder',
      subject: `Your upcoming move-in${formattedMoveIn ? ` on ${formattedMoveIn}` : ''}`,
      body: `Hi ${memberName},

Just a friendly reminder about your scheduled move-in${formattedMoveIn ? ` on ${formattedMoveIn}` : ''} in ${market}.

Please let us know if anything has changed or if you need any assistance preparing for your move.

Best regards,
${agentName}
PadSplit Team`,
    },
    {
      id: 're-engagement',
      label: 'Re-Engagement',
      subject: `Still looking for housing, ${memberName}?`,
      body: `Hi ${memberName},

I noticed your search for housing in ${market} hasn't moved forward yet.

I'd love to help you find the right fit. Would you like to schedule a quick call to discuss your options?

Best regards,
${agentName}
PadSplit Team`,
    },
    {
      id: 'custom',
      label: 'Custom Message',
      subject: '',
      body: `Hi ${memberName},



Best regards,
${agentName}
PadSplit Team`,
    },
  ];

  // Update subject and body when template changes
  useEffect(() => {
    const template = templates.find(t => t.id === selectedTemplate);
    if (template) {
      setSubject(template.subject);
      setBody(template.body);
    }
  }, [selectedTemplate, memberName, market, formattedMoveIn, agentName]);

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
      setShowPreview(false);
    }
  }, [isOpen, status]);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error('Please fill in both subject and message');
      return;
    }

    setIsSending(true);

    try {
      // Convert plain text body to HTML
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">
          ${body.split('\n').map(line => 
            line.trim() === '' ? '<br/>' : `<p style="margin: 0 0 12px 0;">${line}</p>`
          ).join('')}
        </div>
      `;

      const { data, error } = await supabase.functions.invoke('send-follow-up-email', {
        body: {
          bookingId,
          recipientEmail,
          recipientName: memberName,
          subject: subject.trim(),
          htmlBody,
          textBody: body,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to send email');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success('Email sent successfully!');
      onEmailSent?.();
      onClose();
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast.error(error.message || 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  const htmlPreview = body.split('\n').map(line => 
    line.trim() === '' ? '<br/>' : `<p style="margin: 0 0 12px 0;">${line}</p>`
  ).join('');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Send Follow-Up Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Recipient */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">To</Label>
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <span className="font-medium">{memberName}</span>
              <span className="text-muted-foreground">({recipientEmail})</span>
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

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
            />
          </div>

          {/* Message Body / Preview Toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="body">Message</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="h-7 px-2 text-xs"
              >
                {showPreview ? (
                  <>
                    <EyeOff className="h-3 w-3 mr-1" />
                    Edit
                  </>
                ) : (
                  <>
                    <Eye className="h-3 w-3 mr-1" />
                    Preview
                  </>
                )}
              </Button>
            </div>
            
            {showPreview ? (
              <div 
                className="min-h-[200px] p-4 border rounded-md bg-background text-sm"
                dangerouslySetInnerHTML={{ __html: htmlPreview }}
              />
            ) : (
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Your message..."
                className="min-h-[200px] resize-y"
              />
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending || !subject.trim() || !body.trim()}>
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
