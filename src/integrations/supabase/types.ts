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
      agent_goals: {
        Row: {
          agent_id: string
          created_at: string
          daily_target: number
          id: string
          updated_at: string
          weekly_target: number
        }
        Insert: {
          agent_id: string
          created_at?: string
          daily_target?: number
          id?: string
          updated_at?: string
          weekly_target?: number
        }
        Update: {
          agent_id?: string
          created_at?: string
          daily_target?: number
          id?: string
          updated_at?: string
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
          created_at: string
          created_by: string | null
          hubspot_link: string | null
          id: string
          kixie_link: string | null
          market_city: string | null
          market_state: string | null
          member_name: string
          move_in_date: string
          move_in_day_reach_out: boolean | null
          notes: string | null
          status: string
          transcribed_at: string | null
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
          created_at?: string
          created_by?: string | null
          hubspot_link?: string | null
          id?: string
          kixie_link?: string | null
          market_city?: string | null
          market_state?: string | null
          member_name: string
          move_in_date: string
          move_in_day_reach_out?: boolean | null
          notes?: string | null
          status?: string
          transcribed_at?: string | null
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
          created_at?: string
          created_by?: string | null
          hubspot_link?: string | null
          id?: string
          kixie_link?: string | null
          market_city?: string | null
          market_state?: string | null
          member_name?: string
          move_in_date?: string
          move_in_day_reach_out?: boolean | null
          notes?: string | null
          status?: string
          transcribed_at?: string | null
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
          created_at: string
          created_by: string | null
          date_range_end: string
          date_range_start: string
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
          total_calls_analyzed: number
          transportation_insights: Json | null
        }
        Insert: {
          ai_recommendations?: Json | null
          analysis_period: string
          created_at?: string
          created_by?: string | null
          date_range_end: string
          date_range_start: string
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
          total_calls_analyzed?: number
          transportation_insights?: Json | null
        }
        Update: {
          ai_recommendations?: Json | null
          analysis_period?: string
          created_at?: string
          created_by?: string | null
          date_range_end?: string
          date_range_start?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_agent_user_ids_for_site: {
        Args: { _site_id: string }
        Returns: string[]
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
