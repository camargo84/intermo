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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      contract_events: {
        Row: {
          contract_id: string
          created_at: string
          event_type: string
          id: string
          message: string | null
          payload: Json | null
          signer_email: string | null
          status: string | null
        }
        Insert: {
          contract_id: string
          created_at?: string
          event_type: string
          id?: string
          message?: string | null
          payload?: Json | null
          signer_email?: string | null
          status?: string | null
        }
        Update: {
          contract_id?: string
          created_at?: string
          event_type?: string
          id?: string
          message?: string | null
          payload?: Json | null
          signer_email?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          autentique_document_id: string | null
          autentique_signers: Json | null
          client_doc: string | null
          client_email: string
          client_name: string
          content: string
          created_at: string
          id: string
          last_error: string | null
          sent_at: string | null
          signed_at: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          value_cents: number | null
        }
        Insert: {
          autentique_document_id?: string | null
          autentique_signers?: Json | null
          client_doc?: string | null
          client_email: string
          client_name: string
          content: string
          created_at?: string
          id?: string
          last_error?: string | null
          sent_at?: string | null
          signed_at?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
          value_cents?: number | null
        }
        Update: {
          autentique_document_id?: string | null
          autentique_signers?: Json | null
          client_doc?: string | null
          client_email?: string
          client_name?: string
          content?: string
          created_at?: string
          id?: string
          last_error?: string | null
          sent_at?: string | null
          signed_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          value_cents?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accepted_terms_at: string | null
          accepted_terms_version: string | null
          company_cnpj: string | null
          company_email: string | null
          company_fantasy_name: string | null
          company_legal_name: string | null
          company_phone: string | null
          created_at: string
          default_margin_pct: number
          id: string
          owner_name: string | null
          updated_at: string
        }
        Insert: {
          accepted_terms_at?: string | null
          accepted_terms_version?: string | null
          company_cnpj?: string | null
          company_email?: string | null
          company_fantasy_name?: string | null
          company_legal_name?: string | null
          company_phone?: string | null
          created_at?: string
          default_margin_pct?: number
          id: string
          owner_name?: string | null
          updated_at?: string
        }
        Update: {
          accepted_terms_at?: string | null
          accepted_terms_version?: string | null
          company_cnpj?: string | null
          company_email?: string | null
          company_fantasy_name?: string | null
          company_legal_name?: string | null
          company_phone?: string | null
          created_at?: string
          default_margin_pct?: number
          id?: string
          owner_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount_cents: number
          billing_id: string | null
          cancel_at: string | null
          created_at: string
          current_period_end: string | null
          customer_id: string | null
          id: string
          last_payment_at: string | null
          metadata: Json | null
          monthly_contract_quota: number
          provider: string
          status: Database["public"]["Enums"]["subscription_status"]
          subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          billing_id?: string | null
          cancel_at?: string | null
          created_at?: string
          current_period_end?: string | null
          customer_id?: string | null
          id?: string
          last_payment_at?: string | null
          metadata?: Json | null
          monthly_contract_quota?: number
          provider?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          billing_id?: string | null
          cancel_at?: string | null
          created_at?: string
          current_period_end?: string | null
          customer_id?: string | null
          id?: string
          last_payment_at?: string | null
          metadata?: Json | null
          monthly_contract_quota?: number
          provider?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string | null
          id: string
          payload: Json | null
          provider: string
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type?: string | null
          id?: string
          payload?: Json | null
          provider: string
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string | null
          id?: string
          payload?: Json | null
          provider?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_month_contract_count: { Args: never; Returns: number }
      has_active_subscription: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      subscription_status:
        | "pending"
        | "active"
        | "past_due"
        | "canceled"
        | "refunded"
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
      app_role: ["admin", "user"],
      subscription_status: [
        "pending",
        "active",
        "past_due",
        "canceled",
        "refunded",
      ],
    },
  },
} as const
