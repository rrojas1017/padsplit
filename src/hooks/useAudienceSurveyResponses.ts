import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AudienceSurveyRecord {
  id: string;
  booking_id: string;
  member_name: string;
  contact_phone: string | null;
  booking_date: string;
  testimonial_status: string | null;
  extraction: {
    social_media_platforms?: {
      platforms_used?: string[];
      primary_platform?: string;
      uses_facebook_groups_for_housing?: boolean;
    };
    ad_awareness?: {
      has_seen_padsplit_ads?: boolean;
      noticed_standout_ads?: boolean;
      standout_ad_companies?: string[];
      expected_padsplit_ad_platforms?: string[];
      what_they_liked_about_ads?: string;
      where_seen_padsplit_ads?: string[];
    };
    ad_engagement?: {
      what_makes_them_stop_scrolling?: string[];
      what_makes_them_click_ad?: string[];
      ad_detail_preferences?: string[];
      preferred_content_types?: string[];
    };
    first_impressions?: {
      initial_concerns?: string[];
      interest_drivers?: string[];
      confusing_aspects?: string[];
      first_impression?: string;
      how_heard_about_padsplit?: string;
    };
    influencer_following?: {
      follows_influencers?: boolean;
      influencers_mentioned?: string[];
    };
    video_testimonial?: {
      interested_in_recording?: boolean;
      contact_name?: string;
      contact_email?: string;
      contact_phone?: string;
      response_details?: string;
    };
    agent_observations?: {
      engagement_level?: string;
      questions_covered_estimate?: number;
    };
    member_name?: string;
    phone_number?: string;
    key_quotes?: string[];
  };
}

export interface AggResult {
  label: string;
  count: number;
  pct: number;
}

function aggregateArray(records: AudienceSurveyRecord[], accessor: (r: AudienceSurveyRecord) => string[] | undefined): AggResult[] {
  const counts: Record<string, number> = {};
  records.forEach(r => {
    const arr = accessor(r) || [];
    arr.forEach(item => {
      if (item) counts[item] = (counts[item] || 0) + 1;
    });
  });
  const total = records.length || 1;
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
}

function aggregateSingle(records: AudienceSurveyRecord[], accessor: (r: AudienceSurveyRecord) => string | undefined | null): AggResult[] {
  const counts: Record<string, number> = {};
  records.forEach(r => {
    const val = accessor(r);
    if (val) counts[val] = (counts[val] || 0) + 1;
  });
  const total = records.length || 1;
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
}

function aggregateBoolean(records: AudienceSurveyRecord[], accessor: (r: AudienceSurveyRecord) => boolean | undefined | null): { yes: number; no: number; total: number; pct: number } {
  let yes = 0;
  let no = 0;
  records.forEach(r => {
    const val = accessor(r);
    if (val === true) yes++;
    else if (val === false) no++;
  });
  const total = yes + no || 1;
  return { yes, no, total: yes + no, pct: Math.round((yes / total) * 100) };
}

function crossTab(
  records: AudienceSurveyRecord[],
  accessor1: (r: AudienceSurveyRecord) => string[] | undefined,
  accessor2: (r: AudienceSurveyRecord) => string[] | undefined
): Record<string, Record<string, number>> {
  const matrix: Record<string, Record<string, number>> = {};
  records.forEach(r => {
    const arr1 = accessor1(r) || [];
    const arr2 = accessor2(r) || [];
    arr1.forEach(v1 => {
      if (!v1) return;
      if (!matrix[v1]) matrix[v1] = {};
      arr2.forEach(v2 => {
        if (!v2) return;
        matrix[v1][v2] = (matrix[v1][v2] || 0) + 1;
      });
    });
  });
  return matrix;
}

export function useAudienceSurveyResponses() {
  const query = useQuery({
    queryKey: ['audience-survey-responses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_transcriptions')
        .select('id, booking_id, research_extraction, testimonial_status, bookings!inner(member_name, contact_phone, booking_date)')
        .eq('research_campaign_type', 'audience_survey')
        .not('research_extraction', 'is', null);

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        booking_id: row.booking_id,
        member_name: row.bookings?.member_name || 'Unknown',
        contact_phone: row.bookings?.contact_phone || null,
        booking_date: row.bookings?.booking_date || '',
        testimonial_status: row.testimonial_status,
        extraction: row.research_extraction || {},
      })) as AudienceSurveyRecord[];
    },
  });

  return {
    records: query.data || [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    aggregateArray,
    aggregateSingle,
    aggregateBoolean,
    crossTab,
  };
}
