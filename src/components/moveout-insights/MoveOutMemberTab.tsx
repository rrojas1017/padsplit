import { MemberDataTab } from '@/components/research-insights/MemberDataTab';

interface MoveOutMemberTabProps {
  isAdmin: boolean;
}

export function MoveOutMemberTab({ isAdmin }: MoveOutMemberTabProps) {
  return <MemberDataTab isAdmin={isAdmin} />;
}
