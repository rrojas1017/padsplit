import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface BookingEditReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newStatus: string;
  memberName: string;
  onConfirm: (reason: string, newMoveInDate?: Date) => void;
  isSubmitting?: boolean;
}

export function BookingEditReasonDialog({
  open,
  onOpenChange,
  newStatus,
  memberName,
  onConfirm,
  isSubmitting = false,
}: BookingEditReasonDialogProps) {
  const [reason, setReason] = useState('');
  const [newMoveInDate, setNewMoveInDate] = useState<Date | undefined>();

  const showMoveInDatePicker = newStatus === 'Postponed';
  const isValid = reason.trim().length >= 10;

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm(reason.trim(), showMoveInDatePicker ? newMoveInDate : undefined);
    setReason('');
    setNewMoveInDate(undefined);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setReason('');
      setNewMoveInDate(undefined);
    }
    onOpenChange(open);
  };

  const getStatusDescription = (status: string) => {
    switch (status) {
      case 'Moved In':
        return 'Member has successfully moved into their new place.';
      case 'Postponed':
        return 'Member wants to reschedule their move-in date.';
      case 'No Show':
        return 'Member did not show up for their scheduled move-in.';
      case 'Member Rejected':
        return 'Member was rejected and cannot move in.';
      case 'Cancelled':
        return 'The booking has been cancelled.';
      default:
        return `Status will be changed to "${status}".`;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-warning" />
            Update Booking Status
          </DialogTitle>
          <DialogDescription>
            You are changing the status for <span className="font-semibold text-foreground">{memberName}</span> to{' '}
            <span className="font-semibold text-foreground">{newStatus}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            {getStatusDescription(newStatus)}
          </div>

          {showMoveInDatePicker && (
            <div className="space-y-2">
              <Label>New Move-In Date (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !newMoveInDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newMoveInDate ? format(newMoveInDate, 'PPP') : 'Select new date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={newMoveInDate}
                    onSelect={setNewMoveInDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason for Change <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Please explain why you are making this change (minimum 10 characters)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {reason.length}/10 characters minimum
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Confirm Change'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}