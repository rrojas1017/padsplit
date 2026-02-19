export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      access_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          resource: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          resource?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          resource?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          is_resolved: boolean | null
          message: string
          metadata: Json | null
          notification_type: string
          resolved_at: string | null
          service: string
          severity: string
          title: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          is_resolved?: boolean | null
          message: string
          metadata?: Json | null
          notification_type: string
          resolved_at?: string | null
          service: string
          severity?: string
          title: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          is_resolved?: boolean | null
          message?: string
          metadata?: Json | null
          notification_type?: string
          resolved_at?: string | null
          service?: string
          severity?: string
          title?: string
        }
        Relationships: []
      }
      agent_goals: {
        Row: {
          agent_id: string
          created_at: string
          daily_target: number
          id: string
          notes: string | null
          set_by: string | null
          updated_at: string
          week_end: string | null
          week_start: string | null
          weekly_target: number
        }
        Insert: {
          agent_id: string
          created_at?: string
          daily_target?: number
          id?: string
          notes?: string | null
          set_by?: string | null
          updated_at?: string
          week_end?: string | null
          week_start?: string | null
          weekly_target?: number
        }
        Update: {
          agent_id?: string
          created_at?: string
          daily_target?: number
          id?: string
          notes?: string | null
          set_by?: string | null
          updated_at?: string
          week_end?: string | null
          week_start?: string | null
          weekly_target?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_goals_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_sessions: {
        Row: {
          agent_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          last_activity: string
          login_time: string
          logout_time: string | null
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_activity?: string
          login_time?: string
          logout_time?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_activity?: string
          login_time?: string
          logout_time?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_sessions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          id: string
          name: string
          site_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          id?: string
          name: string
          site_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string
          site_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_costs: {
        Row: {
          agent_id: string | null
          audio_duration_seconds: number | null
          booking_id: string | null
          character_count: number | null
          created_at: string | null
          edge_function: string
          estimated_cost_usd: number
          id: string
          input_tokens: number | null
          is_internal: boolean
          metadata: Json | null
          output_tokens: number | null
          service_provider: string
          service_type: string
          site_id: string | null
          triggered_by_user_id: string | null
        }
        Insert: {
          agent_id?: string | null
          audio_duration_seconds?: number | null
          booking_id?: string | null
          character_count?: number | null
          created_at?: string | null
          edge_function: string
          estimated_cost_usd?: number
          id?: string
          input_tokens?: number | null
          is_internal?: boolean
          metadata?: Json | null
          output_tokens?: number | null
          service_provider: string
          service_type: string
          site_id?: string | null
          triggered_by_user_id?: string | null
        }
        Update: {
          agent_id?: string | null
          audio_duration_seconds?: number | null
          booking_id?: string | null
          character_count?: number | null
          created_at?: string | null
          edge_function?: string
          estimated_cost_usd?: number
          id?: string
          input_tokens?: number | null
          is_internal?: boolean
          metadata?: Json | null
          output_tokens?: number | null
          service_provider?: string
          service_type?: string
          site_id?: string | null
          triggered_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_costs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_costs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_costs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_invoices: {
        Row: {
          client_id: string
          cost_breakdown: Json | null
          created_at: string | null
          created_by: string | null
          due_date: string | null
          id: string
          invoice_number: string | null
          markup_usd: number
          notes: string | null
          payment_terms: string | null
          period_end: string
          period_start: string
          raw_cost_usd: number
          status: string
          total_usd: number
        }
        Insert: {
          client_id: string
          cost_breakdown?: Json | null
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          markup_usd?: number
          notes?: string | null
          payment_terms?: string | null
          period_end: string
          period_start: string
          raw_cost_usd?: number
          status?: string
          total_usd?: number
        }
        Update: {
          client_id?: string
          cost_breakdown?: Json | null
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          markup_usd?: number
          notes?: string | null
          payment_terms?: string | null
          period_end?: string
          period_start?: string
          raw_cost_usd?: number
          status?: string
          total_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_edit_logs: {
        Row: {
          agent_id: string | null
          booking_id: string
          created_at: string
          edit_reason: string
          field_changed: string
          id: string
          new_value: string | null
          old_value: string | null
          user_id: string
          user_name: string
        }
        Insert: {
          agent_id?: string | null
          booking_id: string
          created_at?: string
          edit_reason: string
          field_changed: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id: string
          user_name: string
        }
        Update: {
          agent_id?: string | null
          booking_id?: string
          created_at?: string
          edit_reason?: string
          field_changed?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_edit_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_edit_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_transcriptions: {
        Row: {
          agent_feedback: Json | null
          booking_id: string
          call_key_points: Json | null
          call_summary: string | null
          call_transcription: string | null
          coaching_audio_generated_at: string | null
          coaching_audio_listened_at: string | null
          coaching_audio_regenerated_at: string | null
          coaching_audio_url: string | null
          coaching_quiz_passed_at: string | null
          created_at: string | null
          id: string
          llm_provider: string | null
          qa_coaching_audio_generated_at: string | null
          qa_coaching_audio_listened_at: string | null
          qa_coaching_audio_url: string | null
          qa_coaching_quiz_passed_at: string | null
          qa_scores: Json | null
          stt_confidence_score: number | null
          stt_latency_ms: number | null
          stt_provider: string | null
          stt_word_count: number | null
          updated_at: string | null
        }
        Insert: {
          agent_feedback?: Json | null
          booking_id: string
          call_key_points?: Json | null
          call_summary?: string | null
          call_transcription?: string | null
          coaching_audio_generated_at?: string | null
          coaching_audio_listened_at?: string | null
          coaching_audio_regenerated_at?: string | null
          coaching_audio_url?: string | null
          coaching_quiz_passed_at?: string | null
          created_at?: string | null
          id?: string
          llm_provider?: string | null
          qa_coaching_audio_generated_at?: string | null
          qa_coaching_audio_listened_at?: string | null
          qa_coaching_audio_url?: string | null
          qa_coaching_quiz_passed_at?: string | null
          qa_scores?: Json | null
          stt_confidence_score?: number | null
          stt_latency_ms?: number | null
          stt_provider?: string | null
          stt_word_count?: number | null
          updated_at?: string | null
        }
        Update: {
          agent_feedback?: Json | null
          booking_id?: string
          call_key_points?: Json | null
          call_summary?: string | null
          call_transcription?: string | null
          coaching_audio_generated_at?: string | null
          coaching_audio_listened_at?: string | null
          coaching_audio_regenerated_at?: string | null
          coaching_audio_url?: string | null
          coaching_quiz_passed_at?: string | null
          created_at?: string | null
          id?: string
          llm_provider?: string | null
          qa_coaching_audio_generated_at?: string | null
          qa_coaching_audio_listened_at?: string | null
          qa_coaching_audio_url?: string | null
          qa_coaching_quiz_passed_at?: string | null
          qa_scores?: Json | null
          stt_confidence_score?: number | null
          stt_latency_ms?: number | null
          stt_provider?: string | null
          stt_word_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_transcriptions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          admin_profile_link: string | null
          agent_feedback: Json | null
          agent_id: string
          booking_date: string
          booking_type: string
          call_duration_seconds: number | null
          call_key_points: Json | null
          call_summary: string | null
          call_transcription: string | null
          call_type_id: string | null
          coaching_audio_generated_at: string | null
          coaching_audio_regenerated_at: string | null
          coaching_audio_url: string | null
          communication_method: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          detected_issues: Json | null
          email_verification_status: string | null
          email_verified: boolean | null
          email_verified_at: string | null
          has_valid_conversation: boolean | null
          hubspot_link: string | null
          id: string
          import_batch_id: string | null
          is_rebooking: boolean
          kixie_link: string | null
          market_backfill_checked: boolean | null
          market_city: string | null
          market_state: string | null
          member_name: string
          move_in_date: string
          move_in_day_reach_out: boolean | null
          notes: string | null
          original_booking_id: string | null
          record_type: string
          research_call_id: string | null
          status: string
          transcribed_at: string | null
          transcription_error_message: string | null
          transcription_status: string | null
          updated_at: string
        }
        Insert: {
          admin_profile_link?: string | null
          agent_feedback?: Json | null
          agent_id: string
          booking_date: string
          booking_type: string
          call_duration_seconds?: number | null
          call_key_points?: Json | null
          call_summary?: string | null
          call_transcription?: string | null
          call_type_id?: string | null
          coaching_audio_generated_at?: string | null
          coaching_audio_regenerated_at?: string | null
          coaching_audio_url?: string | null
          communication_method?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          detected_issues?: Json | null
          email_verification_status?: string | null
          email_verified?: boolean | null
          email_verified_at?: string | null
          has_valid_conversation?: boolean | null
          hubspot_link?: string | null
          id?: string
          import_batch_id?: string | null
          is_rebooking?: boolean
          kixie_link?: string | null
          market_backfill_checked?: boolean | null
          market_city?: string | null
          market_state?: string | null
          member_name: string
          move_in_date: string
          move_in_day_reach_out?: boolean | null
          notes?: string | null
          original_booking_id?: string | null
          record_type?: string
          research_call_id?: string | null
          status?: string
          transcribed_at?: string | null
          transcription_error_message?: string | null
          transcription_status?: string | null
          updated_at?: string
        }
        Update: {
          admin_profile_link?: string | null
          agent_feedback?: Json | null
          agent_id?: string
          booking_date?: string
          booking_type?: string
          call_duration_seconds?: number | null
          call_key_points?: Json | null
          call_summary?: string | null
          call_transcription?: string | null
          call_type_id?: string | null
          coaching_audio_generated_at?: string | null
          coaching_audio_regenerated_at?: string | null
          coaching_audio_url?: string | null
          communication_method?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          detected_issues?: Json | null
          email_verification_status?: string | null
          email_verified?: boolean | null
          email_verified_at?: string | null
          has_valid_conversation?: boolean | null
          hubspot_link?: string | null
          id?: string
          import_batch_id?: string | null
          is_rebooking?: boolean
          kixie_link?: string | null
          market_backfill_checked?: boolean | null
          market_city?: string | null
          market_state?: string | null
          member_name?: string
          move_in_date?: string
          move_in_day_reach_out?: boolean | null
          notes?: string | null
          original_booking_id?: string | null
          record_type?: string
          research_call_id?: string | null
          status?: string
          transcribed_at?: string | null
          transcription_error_message?: string | null
          transcription_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_call_type_id_fkey"
            columns: ["call_type_id"]
            isOneToOne: false
            referencedRelation: "call_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_original_booking_id_fkey"
            columns: ["original_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_research_call_id_fkey"
            columns: ["research_call_id"]
            isOneToOne: false
            referencedRelation: "research_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_messages: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          message: string
          priority: number | null
          site_id: string | null
          target_role: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          message: string
          priority?: number | null
          site_id?: string | null
          target_role?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          message?: string
          priority?: number | null
          site_id?: string | null
          target_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_messages_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_processing_jobs: {
        Row: {
          chunk_count: number | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          current_booking_id: string | null
          error_log: Json[] | null
          failed_count: number
          id: string
          include_tts: boolean
          job_name: string
          last_activity_at: string | null
          pacing_seconds: number
          paused_at: string | null
          processed_count: number
          site_filter: string | null
          skipped_count: number
          started_at: string | null
          status: string
          total_records: number
        }
        Insert: {
          chunk_count?: number | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_booking_id?: string | null
          error_log?: Json[] | null
          failed_count?: number
          id?: string
          include_tts?: boolean
          job_name: string
          last_activity_at?: string | null
          pacing_seconds?: number
          paused_at?: string | null
          processed_count?: number
          site_filter?: string | null
          skipped_count?: number
          started_at?: string | null
          status?: string
          total_records?: number
        }
        Update: {
          chunk_count?: number | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_booking_id?: string | null
          error_log?: Json[] | null
          failed_count?: number
          id?: string
          include_tts?: boolean
          job_name?: string
          last_activity_at?: string | null
          pacing_seconds?: number
          paused_at?: string | null
          processed_count?: number
          site_filter?: string | null
          skipped_count?: number
          started_at?: string | null
          status?: string
          total_records?: number
        }
        Relationships: []
      }
      call_transcriptions: {
        Row: {
          agent_feedback: Json | null
          call_id: string
          call_key_points: Json | null
          call_summary: string | null
          call_transcription: string | null
          coaching_audio_generated_at: string | null
          coaching_audio_listened_at: string | null
          coaching_audio_url: string | null
          created_at: string
          id: string
          qa_coaching_audio_generated_at: string | null
          qa_coaching_audio_listened_at: string | null
          qa_coaching_audio_url: string | null
          qa_scores: Json | null
          stt_provider: string | null
          updated_at: string
        }
        Insert: {
          agent_feedback?: Json | null
          call_id: string
          call_key_points?: Json | null
          call_summary?: string | null
          call_transcription?: string | null
          coaching_audio_generated_at?: string | null
          coaching_audio_listened_at?: string | null
          coaching_audio_url?: string | null
          created_at?: string
          id?: string
          qa_coaching_audio_generated_at?: string | null
          qa_coaching_audio_listened_at?: string | null
          qa_coaching_audio_url?: string | null
          qa_scores?: Json | null
          stt_provider?: string | null
          updated_at?: string
        }
        Update: {
          agent_feedback?: Json | null
          call_id?: string
          call_key_points?: Json | null
          call_summary?: string | null
          call_transcription?: string | null
          coaching_audio_generated_at?: string | null
          coaching_audio_listened_at?: string | null
          coaching_audio_url?: string | null
          created_at?: string
          id?: string
          qa_coaching_audio_generated_at?: string | null
          qa_coaching_audio_listened_at?: string | null
          qa_coaching_audio_url?: string | null
          qa_scores?: Json | null
          stt_provider?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_transcriptions_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: true
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      call_type_rules: {
        Row: {
          ai_instruction: string | null
          call_type_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          rule_description: string | null
          rule_name: string
          rule_type: string
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          ai_instruction?: string | null
          call_type_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          rule_description?: string | null
          rule_name: string
          rule_type: string
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          ai_instruction?: string | null
          call_type_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          rule_description?: string | null
          rule_name?: string
          rule_type?: string
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "call_type_rules_call_type_id_fkey"
            columns: ["call_type_id"]
            isOneToOne: false
            referencedRelation: "call_types"
            referencedColumns: ["id"]
          },
        ]
      }
      call_types: {
        Row: {
          analysis_focus: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          scoring_criteria: Json | null
          updated_at: string | null
        }
        Insert: {
          analysis_focus?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          scoring_criteria?: Json | null
          updated_at?: string | null
        }
        Update: {
          analysis_focus?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          scoring_criteria?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      calls: {
        Row: {
          agent_id: string | null
          booking_id: string | null
          call_date: string
          call_status: string
          call_type: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          disposition: string | null
          duration_seconds: number | null
          from_number: string | null
          hubspot_link: string | null
          id: string
          kixie_agent_email: string | null
          kixie_agent_name: string | null
          kixie_call_id: string | null
          outcome_category: string | null
          raw_webhook_data: Json | null
          recording_url: string | null
          source: string
          to_number: string | null
          transcribed_at: string | null
          transcription_error_message: string | null
          transcription_status: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          booking_id?: string | null
          call_date?: string
          call_status?: string
          call_type?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          disposition?: string | null
          duration_seconds?: number | null
          from_number?: string | null
          hubspot_link?: string | null
          id?: string
          kixie_agent_email?: string | null
          kixie_agent_name?: string | null
          kixie_call_id?: string | null
          outcome_category?: string | null
          raw_webhook_data?: Json | null
          recording_url?: string | null
          source?: string
          to_number?: string | null
          transcribed_at?: string | null
          transcription_error_message?: string | null
          transcription_status?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          booking_id?: string | null
          call_date?: string
          call_status?: string
          call_type?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          disposition?: string | null
          duration_seconds?: number | null
          from_number?: string | null
          hubspot_link?: string | null
          id?: string
          kixie_agent_email?: string | null
          kixie_agent_name?: string | null
          kixie_call_id?: string | null
          outcome_category?: string | null
          raw_webhook_data?: Json | null
          recording_url?: string | null
          source?: string
          to_number?: string | null
          transcribed_at?: string | null
          transcription_error_message?: string | null
          transcription_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          billing_period: string
          contact_email: string | null
          created_at: string | null
          created_by: string | null
          enabled_services: Json | null
          id: string
          is_active: boolean | null
          markup_percentage: number
          name: string
          payment_terms_days: number
          updated_at: string | null
        }
        Insert: {
          billing_period?: string
          contact_email?: string | null
          created_at?: string | null
          created_by?: string | null
          enabled_services?: Json | null
          id?: string
          is_active?: boolean | null
          markup_percentage?: number
          name: string
          payment_terms_days?: number
          updated_at?: string | null
        }
        Update: {
          billing_period?: string
          contact_email?: string | null
          created_at?: string | null
          created_by?: string | null
          enabled_services?: Json | null
          id?: string
          is_active?: boolean | null
          markup_percentage?: number
          name?: string
          payment_terms_days?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      coaching_quiz_results: {
        Row: {
          answers: Json
          attempts: number
          booking_id: string
          completed_at: string | null
          created_at: string
          id: string
          passed: boolean
          questions: Json
          quiz_type: string
          score: number
          user_id: string
        }
        Insert: {
          answers?: Json
          attempts?: number
          booking_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          passed?: boolean
          questions?: Json
          quiz_type: string
          score?: number
          user_id: string
        }
        Update: {
          answers?: Json
          attempts?: number
          booking_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          passed?: boolean
          questions?: Json
          quiz_type?: string
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_quiz_results_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_quiz_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_knowledge: {
        Row: {
          call_type_ids: string[] | null
          category: string
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          priority: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          call_type_ids?: string[] | null
          category: string
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          call_type_ids?: string[] | null
          category?: string
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      contact_communications: {
        Row: {
          booking_id: string
          communication_type: string
          created_at: string
          id: string
          message_preview: string | null
          recipient_email: string | null
          recipient_phone: string | null
          sent_at: string
          status: string
          user_id: string
          user_name: string
        }
        Insert: {
          booking_id: string
          communication_type: string
          created_at?: string
          id?: string
          message_preview?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          sent_at?: string
          status?: string
          user_id: string
          user_name: string
        }
        Update: {
          booking_id?: string
          communication_type?: string
          created_at?: string
          id?: string
          message_preview?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          sent_at?: string
          status?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_communications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_communications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      display_token_views: {
        Row: {
          browser: string | null
          device_type: string | null
          id: string
          ip_address: string | null
          language: string | null
          operating_system: string | null
          referrer: string | null
          screen_height: number | null
          screen_width: number | null
          timezone: string | null
          token_id: string
          user_agent: string | null
          viewed_at: string
        }
        Insert: {
          browser?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          language?: string | null
          operating_system?: string | null
          referrer?: string | null
          screen_height?: number | null
          screen_width?: number | null
          timezone?: string | null
          token_id: string
          user_agent?: string | null
          viewed_at?: string
        }
        Update: {
          browser?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          language?: string | null
          operating_system?: string | null
          referrer?: string | null
          screen_height?: number | null
          screen_width?: number | null
          timezone?: string | null
          token_id?: string
          user_agent?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "display_token_views_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "display_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      display_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          name: string
          site_filter: string | null
          token: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          name: string
          site_filter?: string | null
          token: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          name?: string
          site_filter?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "display_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "display_tokens_site_filter_fkey"
            columns: ["site_filter"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      failed_downstream_calls: {
        Row: {
          attempt_count: number | null
          booking_id: string | null
          created_at: string | null
          error_message: string | null
          function_name: string
          id: string
          resolved_at: string | null
          status_code: number | null
        }
        Insert: {
          attempt_count?: number | null
          booking_id?: string | null
          created_at?: string | null
          error_message?: string | null
          function_name: string
          id?: string
          resolved_at?: string | null
          status_code?: number | null
        }
        Update: {
          attempt_count?: number | null
          booking_id?: string | null
          created_at?: string | null
          error_message?: string | null
          function_name?: string
          id?: string
          resolved_at?: string | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "failed_downstream_calls_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          is_optional: boolean
          quantity: number
          service_category: string
          sort_order: number
          subtotal: number
          unit_rate: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          is_optional?: boolean
          quantity?: number
          service_category: string
          sort_order?: number
          subtotal?: number
          unit_rate?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          is_optional?: boolean
          quantity?: number
          service_category?: string
          sort_order?: number
          subtotal?: number
          unit_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_allowlists: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          ip_address: string
          is_active: boolean
          site_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          ip_address: string
          is_active?: boolean
          site_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          ip_address?: string
          is_active?: boolean
          site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ip_allowlists_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ip_allowlists_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      lifestyle_backfill_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          remaining: number
          start_date: string | null
          started_at: string
          status: string
          total_failed: number
          total_processed: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          remaining?: number
          start_date?: string | null
          started_at?: string
          status?: string
          total_failed?: number
          total_processed?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          remaining?: number
          start_date?: string | null
          started_at?: string
          status?: string
          total_failed?: number
          total_processed?: number
        }
        Relationships: []
      }
      llm_prompt_enhancements: {
        Row: {
          content: string
          created_at: string | null
          enhancement_type: string
          id: string
          is_active: boolean | null
          priority: number | null
          provider_name: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          enhancement_type: string
          id?: string
          is_active?: boolean | null
          priority?: number | null
          provider_name: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          enhancement_type?: string
          id?: string
          is_active?: boolean | null
          priority?: number | null
          provider_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      llm_provider_settings: {
        Row: {
          api_config: Json | null
          created_at: string
          id: string
          is_active: boolean
          provider_name: string
          updated_at: string
          weight: number
        }
        Insert: {
          api_config?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          provider_name: string
          updated_at?: string
          weight?: number
        }
        Update: {
          api_config?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          provider_name?: string
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      llm_quality_comparisons: {
        Row: {
          booking_id: string | null
          call_duration_seconds: number | null
          comparison_notes: string | null
          created_at: string
          deepseek_analysis: Json | null
          deepseek_enhancements_used: string | null
          deepseek_estimated_cost: number | null
          deepseek_input_tokens: number | null
          deepseek_latency_ms: number | null
          deepseek_model: string | null
          deepseek_output_tokens: number | null
          deepseek_prompt_enhanced: boolean | null
          gemini_analysis: Json | null
          gemini_estimated_cost: number | null
          gemini_input_tokens: number | null
          gemini_latency_ms: number | null
          gemini_model: string | null
          gemini_output_tokens: number | null
          id: string
          transcription_text: string
        }
        Insert: {
          booking_id?: string | null
          call_duration_seconds?: number | null
          comparison_notes?: string | null
          created_at?: string
          deepseek_analysis?: Json | null
          deepseek_enhancements_used?: string | null
          deepseek_estimated_cost?: number | null
          deepseek_input_tokens?: number | null
          deepseek_latency_ms?: number | null
          deepseek_model?: string | null
          deepseek_output_tokens?: number | null
          deepseek_prompt_enhanced?: boolean | null
          gemini_analysis?: Json | null
          gemini_estimated_cost?: number | null
          gemini_input_tokens?: number | null
          gemini_latency_ms?: number | null
          gemini_model?: string | null
          gemini_output_tokens?: number | null
          id?: string
          transcription_text: string
        }
        Update: {
          booking_id?: string | null
          call_duration_seconds?: number | null
          comparison_notes?: string | null
          created_at?: string
          deepseek_analysis?: Json | null
          deepseek_enhancements_used?: string | null
          deepseek_estimated_cost?: number | null
          deepseek_input_tokens?: number | null
          deepseek_latency_ms?: number | null
          deepseek_model?: string | null
          deepseek_output_tokens?: number | null
          deepseek_prompt_enhanced?: boolean | null
          gemini_analysis?: Json | null
          gemini_estimated_cost?: number | null
          gemini_input_tokens?: number | null
          gemini_latency_ms?: number | null
          gemini_model?: string | null
          gemini_output_tokens?: number | null
          id?: string
          transcription_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "llm_quality_comparisons_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      market_intelligence_cache: {
        Row: {
          cache_key: string
          city_data: Json
          filters: Json | null
          generated_at: string
          id: string
          state_data: Json
        }
        Insert: {
          cache_key: string
          city_data?: Json
          filters?: Json | null
          generated_at?: string
          id?: string
          state_data?: Json
        }
        Update: {
          cache_key?: string
          city_data?: Json
          filters?: Json | null
          generated_at?: string
          id?: string
          state_data?: Json
        }
        Relationships: []
      }
      member_insights: {
        Row: {
          ai_recommendations: Json | null
          analysis_period: string
          avg_call_duration_seconds: number | null
          created_at: string
          created_by: string | null
          customer_journeys: Json | null
          date_range_end: string
          date_range_start: string
          emerging_issues: Json | null
          error_message: string | null
          id: string
          market_breakdown: Json | null
          member_journey_insights: Json | null
          move_in_barriers: Json | null
          objection_patterns: Json | null
          pain_points: Json | null
          payment_insights: Json | null
          previous_insight_id: string | null
          price_sensitivity: Json | null
          property_preferences: Json | null
          raw_analysis: string | null
          sentiment_distribution: Json | null
          source_booking_ids: Json | null
          status: string | null
          total_calls_analyzed: number
          transportation_insights: Json | null
          trend_comparison: Json | null
        }
        Insert: {
          ai_recommendations?: Json | null
          analysis_period: string
          avg_call_duration_seconds?: number | null
          created_at?: string
          created_by?: string | null
          customer_journeys?: Json | null
          date_range_end: string
          date_range_start: string
          emerging_issues?: Json | null
          error_message?: string | null
          id?: string
          market_breakdown?: Json | null
          member_journey_insights?: Json | null
          move_in_barriers?: Json | null
          objection_patterns?: Json | null
          pain_points?: Json | null
          payment_insights?: Json | null
          previous_insight_id?: string | null
          price_sensitivity?: Json | null
          property_preferences?: Json | null
          raw_analysis?: string | null
          sentiment_distribution?: Json | null
          source_booking_ids?: Json | null
          status?: string | null
          total_calls_analyzed?: number
          transportation_insights?: Json | null
          trend_comparison?: Json | null
        }
        Update: {
          ai_recommendations?: Json | null
          analysis_period?: string
          avg_call_duration_seconds?: number | null
          created_at?: string
          created_by?: string | null
          customer_journeys?: Json | null
          date_range_end?: string
          date_range_start?: string
          emerging_issues?: Json | null
          error_message?: string | null
          id?: string
          market_breakdown?: Json | null
          member_journey_insights?: Json | null
          move_in_barriers?: Json | null
          objection_patterns?: Json | null
          pain_points?: Json | null
          payment_insights?: Json | null
          previous_insight_id?: string | null
          price_sensitivity?: Json | null
          property_preferences?: Json | null
          raw_analysis?: string | null
          sentiment_distribution?: Json | null
          source_booking_ids?: Json | null
          status?: string | null
          total_calls_analyzed?: number
          transportation_insights?: Json | null
          trend_comparison?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "member_insights_previous_insight_id_fkey"
            columns: ["previous_insight_id"]
            isOneToOne: false
            referencedRelation: "member_insights"
            referencedColumns: ["id"]
          },
        ]
      }
      non_booking_insights: {
        Row: {
          agent_breakdown: Json | null
          analysis_period: string
          avg_call_duration_seconds: number | null
          created_at: string
          created_by: string | null
          date_range_end: string
          date_range_start: string
          error_message: string | null
          id: string
          market_breakdown: Json | null
          missed_opportunities: Json | null
          objection_patterns: Json | null
          raw_analysis: string | null
          recovery_recommendations: Json | null
          rejection_reasons: Json | null
          sentiment_distribution: Json | null
          status: string | null
          total_calls_analyzed: number
          trend_comparison: Json | null
        }
        Insert: {
          agent_breakdown?: Json | null
          analysis_period: string
          avg_call_duration_seconds?: number | null
          created_at?: string
          created_by?: string | null
          date_range_end: string
          date_range_start: string
          error_message?: string | null
          id?: string
          market_breakdown?: Json | null
          missed_opportunities?: Json | null
          objection_patterns?: Json | null
          raw_analysis?: string | null
          recovery_recommendations?: Json | null
          rejection_reasons?: Json | null
          sentiment_distribution?: Json | null
          status?: string | null
          total_calls_analyzed?: number
          trend_comparison?: Json | null
        }
        Update: {
          agent_breakdown?: Json | null
          analysis_period?: string
          avg_call_duration_seconds?: number | null
          created_at?: string
          created_by?: string | null
          date_range_end?: string
          date_range_start?: string
          error_message?: string | null
          id?: string
          market_breakdown?: Json | null
          missed_opportunities?: Json | null
          objection_patterns?: Json | null
          raw_analysis?: string | null
          recovery_recommendations?: Json | null
          rejection_reasons?: Json | null
          sentiment_distribution?: Json | null
          status?: string | null
          total_calls_analyzed?: number
          trend_comparison?: Json | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          can_send_communications: boolean
          can_send_email: boolean
          can_send_sms: boolean
          can_send_voice: boolean
          created_at: string
          email: string | null
          id: string
          name: string | null
          site_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          can_send_communications?: boolean
          can_send_email?: boolean
          can_send_sms?: boolean
          can_send_voice?: boolean
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          site_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          can_send_communications?: boolean
          can_send_email?: boolean
          can_send_sms?: boolean
          can_send_voice?: boolean
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          site_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          current_uses: number
          description: string | null
          discount_amount: number
          discount_type: string
          id: string
          is_active: boolean
          max_uses: number | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          current_uses?: number
          description?: string | null
          discount_amount?: number
          discount_type?: string
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          current_uses?: number
          description?: string | null
          discount_amount?: number
          discount_type?: string
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      qa_coaching_settings: {
        Row: {
          always_emphasize: string[] | null
          coaching_tone: string
          created_at: string | null
          created_by: string | null
          custom_expressions: string[] | null
          id: string
          is_active: boolean | null
          max_audio_length_seconds: number
          never_mention: string[] | null
          updated_at: string | null
          voice_id: string
        }
        Insert: {
          always_emphasize?: string[] | null
          coaching_tone?: string
          created_at?: string | null
          created_by?: string | null
          custom_expressions?: string[] | null
          id?: string
          is_active?: boolean | null
          max_audio_length_seconds?: number
          never_mention?: string[] | null
          updated_at?: string | null
          voice_id?: string
        }
        Update: {
          always_emphasize?: string[] | null
          coaching_tone?: string
          created_at?: string | null
          created_by?: string | null
          custom_expressions?: string[] | null
          id?: string
          is_active?: boolean | null
          max_audio_length_seconds?: number
          never_mention?: string[] | null
          updated_at?: string | null
          voice_id?: string
        }
        Relationships: []
      }
      qa_settings: {
        Row: {
          categories: Json
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          categories: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Update: {
          categories?: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      research_calls: {
        Row: {
          ai_analysis: Json | null
          call_date: string
          call_duration_seconds: number | null
          call_outcome: string
          call_summary: string | null
          call_transcription: string | null
          caller_name: string
          caller_phone: string | null
          caller_status: string | null
          caller_type: string
          campaign_id: string
          created_at: string
          id: string
          kixie_link: string | null
          original_booking_id: string | null
          researcher_id: string
          researcher_notes: string | null
          responses: Json | null
          transcription_status: string | null
          transfer_notes: string | null
          transferred_to_agent_id: string | null
        }
        Insert: {
          ai_analysis?: Json | null
          call_date?: string
          call_duration_seconds?: number | null
          call_outcome: string
          call_summary?: string | null
          call_transcription?: string | null
          caller_name: string
          caller_phone?: string | null
          caller_status?: string | null
          caller_type: string
          campaign_id: string
          created_at?: string
          id?: string
          kixie_link?: string | null
          original_booking_id?: string | null
          researcher_id: string
          researcher_notes?: string | null
          responses?: Json | null
          transcription_status?: string | null
          transfer_notes?: string | null
          transferred_to_agent_id?: string | null
        }
        Update: {
          ai_analysis?: Json | null
          call_date?: string
          call_duration_seconds?: number | null
          call_outcome?: string
          call_summary?: string | null
          call_transcription?: string | null
          caller_name?: string
          caller_phone?: string | null
          caller_status?: string | null
          caller_type?: string
          campaign_id?: string
          created_at?: string
          id?: string
          kixie_link?: string | null
          original_booking_id?: string | null
          researcher_id?: string
          researcher_notes?: string | null
          responses?: Json | null
          transcription_status?: string | null
          transfer_notes?: string | null
          transferred_to_agent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_calls_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "research_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_calls_original_booking_id_fkey"
            columns: ["original_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_calls_researcher_id_fkey"
            columns: ["researcher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_calls_transferred_to_agent_id_fkey"
            columns: ["transferred_to_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      research_campaigns: {
        Row: {
          assigned_researchers: string[]
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          name: string
          script_id: string
          start_date: string | null
          status: string
          target_count: number
          updated_at: string
        }
        Insert: {
          assigned_researchers?: string[]
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          name: string
          script_id: string
          start_date?: string | null
          status?: string
          target_count?: number
          updated_at?: string
        }
        Update: {
          assigned_researchers?: string[]
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          name?: string
          script_id?: string
          start_date?: string | null
          status?: string
          target_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_campaigns_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "research_scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      research_insights: {
        Row: {
          caller_type: string
          campaign_id: string
          created_at: string
          data: Json
          generated_at: string
          id: string
          insight_type: string
        }
        Insert: {
          caller_type: string
          campaign_id: string
          created_at?: string
          data?: Json
          generated_at?: string
          id?: string
          insight_type: string
        }
        Update: {
          caller_type?: string
          campaign_id?: string
          created_at?: string
          data?: Json
          generated_at?: string
          id?: string
          insight_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_insights_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "research_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      research_scripts: {
        Row: {
          campaign_type: string
          closing_script: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          intro_script: string | null
          is_active: boolean
          name: string
          questions: Json
          rebuttal_script: string | null
          target_audience: string
          updated_at: string
        }
        Insert: {
          campaign_type: string
          closing_script?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          intro_script?: string | null
          is_active?: boolean
          name: string
          questions?: Json
          rebuttal_script?: string | null
          target_audience: string
          updated_at?: string
        }
        Update: {
          campaign_type?: string
          closing_script?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          intro_script?: string | null
          is_active?: boolean
          name?: string
          questions?: Json
          rebuttal_script?: string | null
          target_audience?: string
          updated_at?: string
        }
        Relationships: []
      }
      script_access_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          label: string | null
          last_accessed_at: string | null
          script_id: string
          token: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          last_accessed_at?: string | null
          script_id: string
          token?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          last_accessed_at?: string | null
          script_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "script_access_tokens_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "research_scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      script_templates: {
        Row: {
          call_type_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string
          script_content: string
          sections: Json | null
          updated_at: string | null
        }
        Insert: {
          call_type_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          script_content: string
          sections?: Json | null
          updated_at?: string | null
        }
        Update: {
          call_type_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          script_content?: string
          sections?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "script_templates_call_type_id_fkey"
            columns: ["call_type_id"]
            isOneToOne: false
            referencedRelation: "call_types"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          created_at: string
          id: string
          name: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
      sow_pricing_config: {
        Row: {
          base_rate: number
          created_at: string
          description: string
          id: string
          is_active: boolean
          is_optional: boolean
          service_category: string
          unit: string
          updated_at: string
          volume_tier_1_rate: number | null
          volume_tier_1_threshold: number | null
        }
        Insert: {
          base_rate: number
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          is_optional?: boolean
          service_category: string
          unit?: string
          updated_at?: string
          volume_tier_1_rate?: number | null
          volume_tier_1_threshold?: number | null
        }
        Update: {
          base_rate?: number
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          is_optional?: boolean
          service_category?: string
          unit?: string
          updated_at?: string
          volume_tier_1_rate?: number | null
          volume_tier_1_threshold?: number | null
        }
        Relationships: []
      }
      stt_provider_settings: {
        Row: {
          api_config: Json | null
          created_at: string | null
          enable_ai_polish: boolean | null
          id: string
          is_active: boolean | null
          provider_name: string
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          api_config?: Json | null
          created_at?: string | null
          enable_ai_polish?: boolean | null
          id?: string
          is_active?: boolean | null
          provider_name: string
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          api_config?: Json | null
          created_at?: string | null
          enable_ai_polish?: boolean | null
          id?: string
          is_active?: boolean | null
          provider_name?: string
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: []
      }
      stt_quality_comparisons: {
        Row: {
          audio_file_size_mb: number | null
          booking_id: string | null
          call_duration_seconds: number | null
          comparison_notes: string | null
          created_at: string | null
          deepgram_char_count: number | null
          deepgram_confidence: number | null
          deepgram_latency_ms: number | null
          deepgram_transcription: string | null
          deepgram_word_count: number | null
          elevenlabs_char_count: number | null
          elevenlabs_confidence: number | null
          elevenlabs_latency_ms: number | null
          elevenlabs_transcription: string | null
          elevenlabs_word_count: number | null
          id: string
          kixie_link: string
        }
        Insert: {
          audio_file_size_mb?: number | null
          booking_id?: string | null
          call_duration_seconds?: number | null
          comparison_notes?: string | null
          created_at?: string | null
          deepgram_char_count?: number | null
          deepgram_confidence?: number | null
          deepgram_latency_ms?: number | null
          deepgram_transcription?: string | null
          deepgram_word_count?: number | null
          elevenlabs_char_count?: number | null
          elevenlabs_confidence?: number | null
          elevenlabs_latency_ms?: number | null
          elevenlabs_transcription?: string | null
          elevenlabs_word_count?: number | null
          id?: string
          kixie_link: string
        }
        Update: {
          audio_file_size_mb?: number | null
          booking_id?: string | null
          call_duration_seconds?: number | null
          comparison_notes?: string | null
          created_at?: string | null
          deepgram_char_count?: number | null
          deepgram_confidence?: number | null
          deepgram_latency_ms?: number | null
          deepgram_transcription?: string | null
          deepgram_word_count?: number | null
          elevenlabs_char_count?: number | null
          elevenlabs_confidence?: number | null
          elevenlabs_latency_ms?: number | null
          elevenlabs_transcription?: string | null
          elevenlabs_word_count?: number | null
          id?: string
          kixie_link?: string
        }
        Relationships: [
          {
            foreignKeyName: "stt_quality_comparisons_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      transcription_auto_rules: {
        Row: {
          agent_id: string | null
          auto_coaching: boolean
          auto_transcribe: boolean
          call_type_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          priority: number
          rule_type: string
          site_id: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          auto_coaching?: boolean
          auto_transcribe?: boolean
          call_type_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          priority?: number
          rule_type: string
          site_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          auto_coaching?: boolean
          auto_transcribe?: boolean
          call_type_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          priority?: number
          rule_type?: string
          site_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcription_auto_rules_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcription_auto_rules_call_type_id_fkey"
            columns: ["call_type_id"]
            isOneToOne: false
            referencedRelation: "call_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcription_auto_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcription_auto_rules_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          id: string
          preference_key: string
          preference_value: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          preference_key: string
          preference_value: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          preference_key?: string
          preference_value?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      voice_coaching_settings: {
        Row: {
          always_emphasize: string[] | null
          coaching_tone: string
          created_at: string
          created_by: string | null
          custom_expressions: string[] | null
          id: string
          is_active: boolean
          never_mention: string[] | null
          updated_at: string
          voice_id: string
        }
        Insert: {
          always_emphasize?: string[] | null
          coaching_tone?: string
          created_at?: string
          created_by?: string | null
          custom_expressions?: string[] | null
          id?: string
          is_active?: boolean
          never_mention?: string[] | null
          updated_at?: string
          voice_id?: string
        }
        Update: {
          always_emphasize?: string[] | null
          coaching_tone?: string
          created_at?: string
          created_by?: string | null
          custom_expressions?: string[] | null
          id?: string
          is_active?: boolean
          never_mention?: string[] | null
          updated_at?: string
          voice_id?: string
        }
        Relationships: []
      }
      webhook_settings: {
        Row: {
          auto_transcribe: boolean
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          min_duration_seconds: number | null
          provider: string
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          auto_transcribe?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          min_duration_seconds?: number | null
          provider: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          auto_transcribe?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          min_duration_seconds?: number | null
          provider?: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_settings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_booking: { Args: { booking_agent_id: string }; Returns: boolean }
      generate_invoice_number: { Args: never; Returns: string }
      get_agent_user_ids_for_site: {
        Args: { _site_id: string }
        Returns: string[]
      }
      get_import_batch_counts: {
        Args: never
        Returns: {
          import_batch_id: string
          imported_at: string
          record_count: number
        }[]
      }
      get_my_role: { Args: never; Returns: string }
      get_my_site_id: { Args: never; Returns: string }
      get_non_booking_stats: {
        Args: { start_date?: string }
        Returns: {
          avg_duration_seconds: number
          high_readiness_calls: number
          total_calls: number
          transcribed_calls: number
        }[]
      }
      get_non_booking_trends: {
        Args: { group_by_week?: boolean; start_date: string }
        Returns: {
          high_readiness: number
          non_bookings: number
          period_date: string
          transcribed: number
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_site_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_agent: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "supervisor" | "agent" | "researcher"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "admin", "supervisor", "agent", "researcher"],
    },
  },
} as const
