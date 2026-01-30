import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { BroadcastManagement } from '@/components/broadcast/BroadcastManagement';
import { usePageTracking } from '@/hooks/usePageTracking';

export default function BroadcastMessages() {
  usePageTracking('view_broadcasts');

  return (
    <DashboardLayout
      title="Broadcast Messages"
      subtitle="Send rolling announcements to agents"
    >
      <BroadcastManagement />
    </DashboardLayout>
  );
}
