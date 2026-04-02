import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Video, Download, Users, UserCheck, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { AudienceSurveyRecord } from '@/hooks/useAudienceSurveyResponses';

interface Props {
  records: AudienceSurveyRecord[];
  isAdmin: boolean;
  onRefetch: () => void;
}

const STATUS_OPTIONS = ['new', 'contacted', 'scheduled', 'filmed', 'published'] as const;
const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/10 text-blue-700',
  contacted: 'bg-amber-500/10 text-amber-700',
  scheduled: 'bg-purple-500/10 text-purple-700',
  filmed: 'bg-green-500/10 text-green-700',
  published: 'bg-primary/10 text-primary',
};

export function TestimonialPipeline({ records, isAdmin, onRefetch }: Props) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const optIns = records.filter(r => r.extraction.video_testimonial?.interested_in_recording === true);
  const withContact = optIns.filter(r => {
    const vt = r.extraction.video_testimonial;
    return vt?.contact_name || vt?.contact_email || vt?.contact_phone;
  });
  const optInRate = Math.round((optIns.length / (records.length || 1)) * 100);

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    const { error } = await supabase
      .from('booking_transcriptions')
      .update({ testimonial_status: status } as any)
      .eq('id', id);
    setUpdatingId(null);
    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success('Status updated');
      onRefetch();
    }
  };

  const exportCSV = () => {
    const rows = optIns.map(r => ({
      Name: r.extraction.video_testimonial?.contact_name || r.extraction.member_name || r.member_name,
      Email: r.extraction.video_testimonial?.contact_email || '',
      Phone: r.extraction.video_testimonial?.contact_phone || r.extraction.phone_number || r.contact_phone || '',
      'Call Date': r.booking_date,
      Status: r.testimonial_status || 'new',
    }));
    const header = Object.keys(rows[0] || {}).join(',');
    const csv = [header, ...rows.map(r => Object.values(r).map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'testimonial-candidates.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{optIns.length}</p>
              <p className="text-xs text-muted-foreground">Total Opt-Ins</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{withContact.length}</p>
              <p className="text-xs text-muted-foreground">Contact Info Collected</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Video className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{optInRate}%</p>
              <p className="text-xs text-muted-foreground">Opt-In Rate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Candidates Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Video className="w-4 h-4 text-primary" />
            Testimonial Candidates
          </CardTitle>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {optIns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No testimonial opt-ins yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2 text-muted-foreground font-medium">Name</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Email</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Phone</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Call Date</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {optIns.map(r => {
                  const vt = r.extraction.video_testimonial;
                  const name = vt?.contact_name || r.extraction.member_name || r.member_name;
                  const email = vt?.contact_email || '';
                  const phone = vt?.contact_phone || r.extraction.phone_number || r.contact_phone || '';
                  const status = r.testimonial_status || 'new';
                  return (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="p-2 text-foreground font-medium">{name}</td>
                      <td className="p-2 text-muted-foreground">{email || '—'}</td>
                      <td className="p-2 text-muted-foreground">{phone || '—'}</td>
                      <td className="p-2 text-muted-foreground">{r.booking_date}</td>
                      <td className="p-2">
                        <Select
                          value={status}
                          onValueChange={(v) => updateStatus(r.id, v)}
                          disabled={updatingId === r.id}
                        >
                          <SelectTrigger className="h-7 w-[120px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map(s => (
                              <SelectItem key={s} value={s}>
                                <Badge variant="secondary" className={`text-[10px] ${STATUS_COLORS[s] || ''}`}>{s}</Badge>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
