import React, { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Mail, MessageSquare, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';

interface CommunicationPermissionsCellProps {
  userId: string;
  userName: string;
  canSendCommunications: boolean;
  canSendEmail: boolean;
  canSendSMS: boolean;
  canSendVoice: boolean;
  onToggleMaster: (userId: string, userName: string, currentValue: boolean) => void;
  onToggleChannel: (userId: string, userName: string, channel: 'email' | 'sms' | 'voice', currentValue: boolean) => void;
}

export function CommunicationPermissionsCell({
  userId,
  userName,
  canSendCommunications,
  canSendEmail,
  canSendSMS,
  canSendVoice,
  onToggleMaster,
  onToggleChannel,
}: CommunicationPermissionsCellProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Count enabled channels
  const enabledCount = [canSendEmail, canSendSMS, canSendVoice].filter(Boolean).length;

  return (
    <div className="space-y-1">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-2">
          <Switch
            checked={canSendCommunications}
            onCheckedChange={() => onToggleMaster(userId, userName, canSendCommunications)}
          />
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-6 px-2 text-xs gap-1",
                canSendCommunications ? "text-success" : "text-muted-foreground"
              )}
            >
              {canSendCommunications 
                ? enabledCount === 3 
                  ? 'All' 
                  : enabledCount > 0 
                    ? `${enabledCount}/3` 
                    : 'None'
                : 'Off'}
              {canSendCommunications && (
                isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          </CollapsibleTrigger>
        </div>

        {canSendCommunications && (
          <CollapsibleContent className="pt-2 pl-1">
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={canSendEmail}
                  onCheckedChange={() => onToggleChannel(userId, userName, 'email', canSendEmail)}
                  className="h-3.5 w-3.5"
                />
                <Mail className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Email</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={canSendSMS}
                  onCheckedChange={() => onToggleChannel(userId, userName, 'sms', canSendSMS)}
                  className="h-3.5 w-3.5"
                />
                <MessageSquare className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">SMS</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={canSendVoice}
                  onCheckedChange={() => onToggleChannel(userId, userName, 'voice', canSendVoice)}
                  className="h-3.5 w-3.5"
                />
                <Mic className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Voice</span>
              </label>
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}
