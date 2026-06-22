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
      chat_threads: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          messages: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          messages?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          messages?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_threads_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          email: string | null
          endereco: string | null
          estado_civil: string | null
          id: string
          is_pj: boolean
          nacionalidade: string | null
          name: string
          phone: string | null
          rg: string | null
          uf: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          estado_civil?: string | null
          id?: string
          is_pj?: boolean
          nacionalidade?: string | null
          name: string
          phone?: string | null
          rg?: string | null
          uf?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          estado_civil?: string | null
          id?: string
          is_pj?: boolean
          nacionalidade?: string | null
          name?: string
          phone?: string | null
          rg?: string | null
          uf?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accepted_terms_at: string | null
          accepted_terms_version: string | null
          autentique_folder_id: string | null
          comarca: string | null
          company_address: string | null
          company_cep: string | null
          company_city: string | null
          company_cnpj: string | null
          company_email: string | null
          company_fantasy_name: string | null
          company_legal_name: string | null
          company_phone: string | null
          company_uf: string | null
          created_at: string
          default_margin_pct: number
          id: string
          logo_path: string | null
          owner_name: string | null
          representative_cpf: string | null
          representative_name: string | null
          representative_qualification: string | null
          updated_at: string
        }
        Insert: {
          accepted_terms_at?: string | null
          accepted_terms_version?: string | null
          autentique_folder_id?: string | null
          comarca?: string | null
          company_address?: string | null
          company_cep?: string | null
          company_city?: string | null
          company_cnpj?: string | null
          company_email?: string | null
          company_fantasy_name?: string | null
          company_legal_name?: string | null
          company_phone?: string | null
          company_uf?: string | null
          created_at?: string
          default_margin_pct?: number
          id: string
          logo_path?: string | null
          owner_name?: string | null
          representative_cpf?: string | null
          representative_name?: string | null
          representative_qualification?: string | null
          updated_at?: string
        }
        Update: {
          accepted_terms_at?: string | null
          accepted_terms_version?: string | null
          autentique_folder_id?: string | null
          comarca?: string | null
          company_address?: string | null
          company_cep?: string | null
          company_city?: string | null
          company_cnpj?: string | null
          company_email?: string | null
          company_fantasy_name?: string | null
          company_legal_name?: string | null
          company_phone?: string | null
          company_uf?: string | null
          created_at?: string
          default_margin_pct?: number
          id?: string
          logo_path?: string | null
          owner_name?: string | null
          representative_cpf?: string | null
          representative_name?: string | null
          representative_qualification?: string | null
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
      signature_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          pdf_hash: string | null
          revoked_at: string | null
          signature_image_path: string | null
          signed_at: string | null
          signed_ip: string | null
          signed_user_agent: string | null
          signer_doc: string | null
          signer_email: string | null
          signer_name: string | null
          signer_role: string
          token: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          pdf_hash?: string | null
          revoked_at?: string | null
          signature_image_path?: string | null
          signed_at?: string | null
          signed_ip?: string | null
          signed_user_agent?: string | null
          signer_doc?: string | null
          signer_email?: string | null
          signer_name?: string | null
          signer_role: string
          token: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          pdf_hash?: string | null
          revoked_at?: string | null
          signature_image_path?: string | null
          signed_at?: string | null
          signed_ip?: string | null
          signed_user_agent?: string | null
          signer_doc?: string | null
          signer_email?: string | null
          signer_name?: string | null
          signer_role?: string
          token?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "signature_tokens_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
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
          last_amount_cents: number | null
          last_payment_at: string | null
          metadata: Json | null
          monthly_contract_quota: number
          plan: string
          plan_change_scheduled_at: string | null
          promo_cycles_remaining: number | null
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
          last_amount_cents?: number | null
          last_payment_at?: string | null
          metadata?: Json | null
          monthly_contract_quota?: number
          plan?: string
          plan_change_scheduled_at?: string | null
          promo_cycles_remaining?: number | null
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
          last_amount_cents?: number | null
          last_payment_at?: string | null
          metadata?: Json | null
          monthly_contract_quota?: number
          plan?: string
          plan_change_scheduled_at?: string | null
          promo_cycles_remaining?: number | null
          provider?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          autentique_document_id: string | null
          autentique_signers: Json | null
          client_doc: string | null
          client_email: string
          client_id: string | null
          client_name: string
          client_paid_amount_cents: number | null
          client_paid_at: string | null
          client_payment_method: string | null
          consolidated: boolean
          consolidated_at: string | null
          content: string
          created_at: string
          entrada_cents: number
          forma_pagamento: string | null
          freight_carrier: string | null
          freight_paid_amount_cents: number | null
          freight_paid_at: string | null
          id: string
          last_error: string | null
          margin_cents: number | null
          pdf_path: string | null
          produtos: Json
          sent_at: string | null
          signed_at: string | null
          signed_pdf_downloaded_at: string | null
          signed_pdf_path: string | null
          status: string
          supplier_doc: string | null
          supplier_name: string | null
          supplier_paid_amount_cents: number | null
          supplier_paid_at: string | null
          tax_estimated_cents: number | null
          tenant_snapshot: Json | null
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
          client_id?: string | null
          client_name: string
          client_paid_amount_cents?: number | null
          client_paid_at?: string | null
          client_payment_method?: string | null
          consolidated?: boolean
          consolidated_at?: string | null
          content: string
          created_at?: string
          entrada_cents?: number
          forma_pagamento?: string | null
          freight_carrier?: string | null
          freight_paid_amount_cents?: number | null
          freight_paid_at?: string | null
          id?: string
          last_error?: string | null
          margin_cents?: number | null
          pdf_path?: string | null
          produtos?: Json
          sent_at?: string | null
          signed_at?: string | null
          signed_pdf_downloaded_at?: string | null
          signed_pdf_path?: string | null
          status?: string
          supplier_doc?: string | null
          supplier_name?: string | null
          supplier_paid_amount_cents?: number | null
          supplier_paid_at?: string | null
          tax_estimated_cents?: number | null
          tenant_snapshot?: Json | null
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
          client_id?: string | null
          client_name?: string
          client_paid_amount_cents?: number | null
          client_paid_at?: string | null
          client_payment_method?: string | null
          consolidated?: boolean
          consolidated_at?: string | null
          content?: string
          created_at?: string
          entrada_cents?: number
          forma_pagamento?: string | null
          freight_carrier?: string | null
          freight_paid_amount_cents?: number | null
          freight_paid_at?: string | null
          id?: string
          last_error?: string | null
          margin_cents?: number | null
          pdf_path?: string | null
          produtos?: Json
          sent_at?: string | null
          signed_at?: string | null
          signed_pdf_downloaded_at?: string | null
          signed_pdf_path?: string | null
          status?: string
          supplier_doc?: string | null
          supplier_name?: string | null
          supplier_paid_amount_cents?: number | null
          supplier_paid_at?: string | null
          tax_estimated_cents?: number | null
          tenant_snapshot?: Json | null
          title?: string
          updated_at?: string
          user_id?: string
          value_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
      current_month_transaction_count: { Args: never; Returns: number }
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
