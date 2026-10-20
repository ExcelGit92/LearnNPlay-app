export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      glossary_entries: {
        Row: {
          created_at: string;
          id: string;
          org_id: string;
          term: string;
          translations: Json;
        };
        Insert: {
          created_at?: string;
          id?: string;
          org_id: string;
          term: string;
          translations?: Json;
        };
        Update: {
          created_at?: string;
          id?: string;
          org_id?: string;
          term?: string;
          translations?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "glossary_entries_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      live_sessions: {
        Row: {
          allow_language_change: boolean;
          competition_mode: string;
          created_at: string;
          display_mode: string;
          ended_at: string | null;
          gamification: Json;
          host_id: string;
          id: string;
          idx: number;
          languages: Json;
          org_id: string;
          pin: string;
          public_questions: Json;
          question_started_at: string | null;
          quiz_id: string | null;
          revealed_correct: number | null;
          status: string;
          team_settings: Json;
          teams: Json;
          teams_locked: boolean;
          title: string;
        };
        Insert: {
          allow_language_change?: boolean;
          competition_mode?: string;
          created_at?: string;
          display_mode?: string;
          ended_at?: string | null;
          gamification?: Json;
          host_id?: string;
          id?: string;
          idx?: number;
          languages: Json;
          org_id: string;
          pin: string;
          public_questions?: Json;
          question_started_at?: string | null;
          quiz_id?: string | null;
          revealed_correct?: number | null;
          status?: string;
          team_settings?: Json;
          teams?: Json;
          teams_locked?: boolean;
          title: string;
        };
        Update: {
          allow_language_change?: boolean;
          competition_mode?: string;
          created_at?: string;
          display_mode?: string;
          ended_at?: string | null;
          gamification?: Json;
          host_id?: string;
          id?: string;
          idx?: number;
          languages?: Json;
          org_id?: string;
          pin?: string;
          public_questions?: Json;
          question_started_at?: string | null;
          quiz_id?: string | null;
          revealed_correct?: number | null;
          status?: string;
          team_settings?: Json;
          teams?: Json;
          teams_locked?: boolean;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "live_sessions_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "live_sessions_quiz_id_fkey";
            columns: ["quiz_id"];
            isOneToOne: false;
            referencedRelation: "quizzes";
            referencedColumns: ["id"];
          },
        ];
      };
      org_members: {
        Row: {
          created_at: string;
          org_id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          org_id: string;
          role?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          org_id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      participant_tokens: {
        Row: {
          participant_id: string;
          token: string;
        };
        Insert: {
          participant_id: string;
          token: string;
        };
        Update: {
          participant_id?: string;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "participant_tokens_participant_id_fkey";
            columns: ["participant_id"];
            isOneToOne: true;
            referencedRelation: "participants";
            referencedColumns: ["id"];
          },
        ];
      };
      participants: {
        Row: {
          answered_count: number;
          avatar: string;
          best_streak: number;
          correct_count: number;
          id: string;
          joined_at: string;
          lang: string | null;
          name: string;
          score: number;
          session_id: string;
          streak: number;
          team: string | null;
          total_ms: number;
        };
        Insert: {
          answered_count?: number;
          avatar?: string;
          best_streak?: number;
          correct_count?: number;
          id?: string;
          joined_at?: string;
          lang?: string | null;
          name: string;
          score?: number;
          session_id: string;
          streak?: number;
          team?: string | null;
          total_ms?: number;
        };
        Update: {
          answered_count?: number;
          avatar?: string;
          best_streak?: number;
          correct_count?: number;
          id?: string;
          joined_at?: string;
          lang?: string | null;
          name?: string;
          score?: number;
          session_id?: string;
          streak?: number;
          team?: string | null;
          total_ms?: number;
        };
        Relationships: [
          {
            foreignKeyName: "participants_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "live_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
          org_id: string | null;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id: string;
          org_id?: string | null;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
          org_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      quizzes: {
        Row: {
          created_at: string;
          extracted_text: string | null;
          file_path: string | null;
          id: string;
          languages: Json;
          org_id: string;
          owner_id: string;
          questions: Json;
          settings: Json;
          source: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          extracted_text?: string | null;
          file_path?: string | null;
          id?: string;
          languages?: Json;
          org_id: string;
          owner_id?: string;
          questions?: Json;
          settings?: Json;
          source?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          extracted_text?: string | null;
          file_path?: string | null;
          id?: string;
          languages?: Json;
          org_id?: string;
          owner_id?: string;
          questions?: Json;
          settings?: Json;
          source?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quizzes_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      responses: {
        Row: {
          answered_at: string;
          bonus: number;
          choice: number;
          id: string;
          is_correct: boolean;
          ms: number | null;
          participant_id: string;
          points: number;
          question_index: number;
          session_id: string;
        };
        Insert: {
          answered_at?: string;
          bonus?: number;
          choice: number;
          id?: string;
          is_correct: boolean;
          ms?: number | null;
          participant_id: string;
          points?: number;
          question_index: number;
          session_id: string;
        };
        Update: {
          answered_at?: string;
          bonus?: number;
          choice?: number;
          id?: string;
          is_correct?: boolean;
          ms?: number | null;
          participant_id?: string;
          points?: number;
          question_index?: number;
          session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "responses_participant_id_fkey";
            columns: ["participant_id"];
            isOneToOne: false;
            referencedRelation: "participants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "responses_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "live_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      team_templates: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          org_id: string;
          settings: Json;
          teams: Json;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          org_id: string;
          settings?: Json;
          teams?: Json;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          org_id?: string;
          settings?: Json;
          teams?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_templates_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      ensure_my_org: { Args: never; Returns: string };
      is_org_member: { Args: { _org: string }; Returns: boolean };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
