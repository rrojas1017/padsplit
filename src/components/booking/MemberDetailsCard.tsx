import { Phone, Mail, Calendar, DollarSign, Users, MapPin, CreditCard, Clock } from 'lucide-react';
import { MemberDetails } from '@/types';

interface MemberDetailsCardProps {
  memberDetails: MemberDetails;
  memberName?: string;
}

export function MemberDetailsCard({ memberDetails, memberName }: MemberDetailsCardProps) {
  // Check if we have any meaningful data to display
  const hasData = memberDetails.firstName || memberDetails.lastName || 
                  memberDetails.phoneNumber || memberDetails.email ||
                  memberDetails.weeklyBudget || memberDetails.moveInDate ||
                  memberDetails.householdSize || memberDetails.commitmentWeeks ||
                  memberDetails.preferredPaymentMethod || memberDetails.propertyAddress;

  if (!hasData) return null;

  const fullName = [memberDetails.firstName, memberDetails.lastName].filter(Boolean).join(' ');
  const displayName = fullName || memberName || 'Unknown';

  const formatBudget = (budget?: number | null) => {
    if (!budget) return null;
    return `$${budget}/week`;
  };

  const details = [
    { icon: Phone, label: 'Phone', value: memberDetails.phoneNumber, color: 'text-success' },
    { icon: Mail, label: 'Email', value: memberDetails.email, color: 'text-primary' },
    { icon: DollarSign, label: 'Budget', value: formatBudget(memberDetails.weeklyBudget), color: 'text-warning' },
    { icon: Calendar, label: 'Move-In', value: memberDetails.moveInDate, color: 'text-accent' },
    { icon: Users, label: 'Household', value: memberDetails.householdSize ? `${memberDetails.householdSize} person${memberDetails.householdSize > 1 ? 's' : ''}` : null, color: 'text-muted-foreground' },
    { icon: Clock, label: 'Commitment', value: memberDetails.commitmentWeeks ? `${memberDetails.commitmentWeeks} weeks` : null, color: 'text-muted-foreground' },
    { icon: CreditCard, label: 'Payment', value: memberDetails.preferredPaymentMethod, color: 'text-muted-foreground' },
    { icon: MapPin, label: 'Property', value: memberDetails.propertyAddress, color: 'text-muted-foreground' },
  ].filter(d => d.value);

  if (details.length === 0 && !fullName) return null;

  return (
    <div className="bg-accent/5 rounded-lg p-4 border border-accent/20">
      <h4 className="font-semibold mb-3 flex items-center gap-2 text-accent">
        <Users className="h-4 w-4" />
        Member Details
        {fullName && fullName !== memberName && (
          <span className="text-xs text-muted-foreground font-normal">
            ({displayName})
          </span>
        )}
      </h4>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {details.map((detail, index) => {
          const IconComponent = detail.icon;
          return (
            <div key={index} className="flex items-start gap-2">
              <IconComponent className={`h-4 w-4 mt-0.5 ${detail.color} shrink-0`} />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{detail.label}</p>
                <p className="text-sm font-medium truncate" title={detail.value || ''}>
                  {detail.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}