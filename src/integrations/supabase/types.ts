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
          metadata: Json | null
          output_tokens: number | null
          service_provider: string
          service_type: string
          site_id: string | null
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
          metadata?: Json | null
          output_tokens?: number | null
          service_provider: string
          service_type: string
          site_id?: string | null
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
          metadata?: Json | null
          output_tokens?: number | null
          service_provider?: string
          service_type?: string
          site_id?: string | null
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
          id: string
          markup_usd: number
          notes: string | null
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
          id?: string
          markup_usd?: number
          notes?: string | null
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
          id?: string
          markup_usd?: number
          notes?: string | null
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
          qa_coaching_audio_generated_at: string | null
          qa_coaching_audio_listened_at: string | null
          qa_coaching_audio_url: string | null
          qa_coaching_quiz_passed_at: string | null
          qa_scores: Json | null
          stt_provider: string | null
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
          qa_coaching_audio_generated_at?: string | null
          qa_coaching_audio_listened_at?: string | null
          qa_coaching_audio_url?: string | null
          qa_coaching_quiz_passed_at?: string | null
          qa_scores?: Json | null
          stt_provider?: string | null
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
          qa_coaching_audio_generated_at?: string | null
          qa_coaching_audio_listened_at?: string | null
          qa_coaching_audio_url?: string | null
          qa_coaching_quiz_passed_at?: string | null
          qa_scores?: Json | null
          stt_provider?: string | null
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
          hubspot_link: string | null
          id: string
          import_batch_id: string | null
          is_rebooking: boolean
          kixie_link: string | null
          market_city: string | null
          market_state: string | null
          member_name: string
          move_in_date: string
          move_in_day_reach_out: boolean | null
          notes: string | null
          original_booking_id: string | null
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
          hubspot_link?: string | null
          id?: string
          import_batch_id?: string | null
          is_rebooking?: boolean
          kixie_link?: string | null
          market_city?: string | null
          market_state?: string | null
          member_name: string
          move_in_date: string
          move_in_day_reach_out?: boolean | null
          notes?: string | null
          original_booking_id?: string | null
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
          hubspot_link?: string | null
          id?: string
          import_batch_id?: string | null
          is_rebooking?: boolean
          kixie_link?: string | null
          market_city?: string | null
          market_state?: string | null
          member_name?: string
          move_in_date?: string
          move_in_day_reach_out?: boolean | null
          notes?: string | null
          original_booking_id?: string | null
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
        ]
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
          id: string
          is_active: boolean | null
          markup_percentage: number
          name: string
          updated_at: string | null
        }
        Insert: {
          billing_period?: string
          contact_email?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          markup_percentage?: number
          name: string
          updated_at?: string | null
        }
        Update: {
          billing_period?: string
          contact_email?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          markup_percentage?: number
          name?: string
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
      member_insights: {
        Row: {
          ai_recommendations: Json | null
          analysis_period: string
          avg_call_duration_seconds: number | null
          created_at: string
          created_by: string | null
          date_range_end: string
          date_range_start: string
          error_message: string | null
          id: string
          market_breakdown: Json | null
          member_journey_insights: Json | null
          move_in_barriers: Json | null
          objection_patterns: Json | null
          pain_points: Json | null
          payment_insights: Json | null
          price_sensitivity: Json | null
          property_preferences: Json | null
          raw_analysis: string | null
          sentiment_distribution: Json | null
          status: string | null
          total_calls_analyzed: number
          transportation_insights: Json | null
        }
        Insert: {
          ai_recommendations?: Json | null
          analysis_period: string
          avg_call_duration_seconds?: number | null
          created_at?: string
          created_by?: string | null
          date_range_end: string
          date_range_start: string
          error_message?: string | null
          id?: string
          market_breakdown?: Json | null
          member_journey_insights?: Json | null
          move_in_barriers?: Json | null
          objection_patterns?: Json | null
          pain_points?: Json | null
          payment_insights?: Json | null
          price_sensitivity?: Json | null
          property_preferences?: Json | null
          raw_analysis?: string | null
          sentiment_distribution?: Json | null
          status?: string | null
          total_calls_analyzed?: number
          transportation_insights?: Json | null
        }
        Update: {
          ai_recommendations?: Json | null
          analysis_period?: string
          avg_call_duration_seconds?: number | null
          created_at?: string
          created_by?: string | null
          date_range_end?: string
          date_range_start?: string
          error_message?: string | null
          id?: string
          market_breakdown?: Json | null
          member_journey_insights?: Json | null
          move_in_barriers?: Json | null
          objection_patterns?: Json | null
          pain_points?: Json | null
          payment_insights?: Json | null
          price_sensitivity?: Json | null
          property_preferences?: Json | null
          raw_analysis?: string | null
          sentiment_distribution?: Json | null
          status?: string | null
          total_calls_analyzed?: number
          transportation_insights?: Json | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
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
      app_role: "super_admin" | "admin" | "supervisor" | "agent"
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
      app_role: ["super_admin", "admin", "supervisor", "agent"],
    },
  },
} as const
