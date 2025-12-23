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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      friend_claims: {
        Row: {
          amount_cents: number | null
          claim_expires_at: string | null
          claim_status: string
          claim_token: string
          created_at: string | null
          friend_email: string | null
          friend_name: string
          friend_phone: string | null
          id: string
          payout_method: string | null
          paypal_batch_id: string | null
          paypal_email: string | null
          paypal_payout_item_id: string | null
          promise_id: string
          stripe_account_id: string | null
          stripe_account_status: string | null
          transfer_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount_cents?: number | null
          claim_expires_at?: string | null
          claim_status?: string
          claim_token: string
          created_at?: string | null
          friend_email?: string | null
          friend_name: string
          friend_phone?: string | null
          id?: string
          payout_method?: string | null
          paypal_batch_id?: string | null
          paypal_email?: string | null
          paypal_payout_item_id?: string | null
          promise_id: string
          stripe_account_id?: string | null
          stripe_account_status?: string | null
          transfer_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_cents?: number | null
          claim_expires_at?: string | null
          claim_status?: string
          claim_token?: string
          created_at?: string | null
          friend_email?: string | null
          friend_name?: string
          friend_phone?: string | null
          id?: string
          payout_method?: string | null
          paypal_batch_id?: string | null
          paypal_email?: string | null
          paypal_payout_item_id?: string | null
          promise_id?: string
          stripe_account_id?: string | null
          stripe_account_status?: string | null
          transfer_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "friend_claims_promise_id_fkey"
            columns: ["promise_id"]
            isOneToOne: false
            referencedRelation: "promises"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          attempt_number: number | null
          created_at: string | null
          currency: string | null
          error_code: string | null
          error_message: string | null
          id: string
          promise_id: string
          status: string
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount: number
          attempt_number?: number | null
          created_at?: string | null
          currency?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          promise_id: string
          status: string
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount?: number
          attempt_number?: number | null
          created_at?: string | null
          currency?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          promise_id?: string
          status?: string
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_promise_id_fkey"
            columns: ["promise_id"]
            isOneToOne: false
            referencedRelation: "promises"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          balance_cents: number | null
          created_at: string | null
          default_payment_method_id: string | null
          display_name: string | null
          expo_push_token: string | null
          failed_payment_count: number | null
          id: string
          last_active_at: string | null
          last_reengagement_at: string | null
          notification_preferences: Json | null
          payment_blocked: boolean | null
          payment_method_brand: string | null
          payment_method_last4: string | null
          payment_method_type: string | null
          stripe_customer_id: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          balance_cents?: number | null
          created_at?: string | null
          default_payment_method_id?: string | null
          display_name?: string | null
          expo_push_token?: string | null
          failed_payment_count?: number | null
          id: string
          last_active_at?: string | null
          last_reengagement_at?: string | null
          notification_preferences?: Json | null
          payment_blocked?: boolean | null
          payment_method_brand?: string | null
          payment_method_last4?: string | null
          payment_method_type?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          balance_cents?: number | null
          created_at?: string | null
          default_payment_method_id?: string | null
          display_name?: string | null
          expo_push_token?: string | null
          failed_payment_count?: number | null
          id?: string
          last_active_at?: string | null
          last_reengagement_at?: string | null
          notification_preferences?: Json | null
          payment_blocked?: boolean | null
          payment_method_brand?: string | null
          payment_method_last4?: string | null
          payment_method_type?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      promises: {
        Row: {
          completed_at: string | null
          created_at: string | null
          deadline_at: string
          expired_at: string | null
          failed_at: string | null
          friend_claim_id: string | null
          has_roast: boolean | null
          id: string
          money_destination: string
          partner_deadline_at: string | null
          partner_state: string | null
          payment_client_secret: string | null
          payment_next_retry_at: string | null
          payment_retry_count: number | null
          payment_status: string | null
          settle_at: string | null
          sponsor_count: number | null
          sponsor_total: number | null
          stake: number
          status: string
          streak_at_completion: number | null
          text: string
          updated_at: string | null
          user_id: string
          verification_proof_ref: string | null
          verification_timestamp: string | null
          verification_type: string
          voice_note_ref: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          deadline_at: string
          expired_at?: string | null
          failed_at?: string | null
          friend_claim_id?: string | null
          has_roast?: boolean | null
          id: string
          money_destination?: string
          partner_deadline_at?: string | null
          partner_state?: string | null
          payment_client_secret?: string | null
          payment_next_retry_at?: string | null
          payment_retry_count?: number | null
          payment_status?: string | null
          settle_at?: string | null
          sponsor_count?: number | null
          sponsor_total?: number | null
          stake?: number
          status?: string
          streak_at_completion?: number | null
          text: string
          updated_at?: string | null
          user_id: string
          verification_proof_ref?: string | null
          verification_timestamp?: string | null
          verification_type?: string
          voice_note_ref?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          deadline_at?: string
          expired_at?: string | null
          failed_at?: string | null
          friend_claim_id?: string | null
          has_roast?: boolean | null
          id?: string
          money_destination?: string
          partner_deadline_at?: string | null
          partner_state?: string | null
          payment_client_secret?: string | null
          payment_next_retry_at?: string | null
          payment_retry_count?: number | null
          payment_status?: string | null
          settle_at?: string | null
          sponsor_count?: number | null
          sponsor_total?: number | null
          stake?: number
          status?: string
          streak_at_completion?: number | null
          text?: string
          updated_at?: string | null
          user_id?: string
          verification_proof_ref?: string | null
          verification_timestamp?: string | null
          verification_type?: string
          voice_note_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promises_friend_claim_id_fkey"
            columns: ["friend_claim_id"]
            isOneToOne: false
            referencedRelation: "friend_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promises_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      roast_messages: {
        Row: {
          created_at: string | null
          from_ip_hash: string | null
          from_name: string
          id: string
          message: string
          promise_id: string
        }
        Insert: {
          created_at?: string | null
          from_ip_hash?: string | null
          from_name: string
          id?: string
          message: string
          promise_id: string
        }
        Update: {
          created_at?: string | null
          from_ip_hash?: string | null
          from_name?: string
          id?: string
          message?: string
          promise_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roast_messages_promise_id_fkey"
            columns: ["promise_id"]
            isOneToOne: false
            referencedRelation: "promises"
            referencedColumns: ["id"]
          },
        ]
      }
      share_links: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          promise_id: string
          revoked: boolean | null
          token_hash: string
          type: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          promise_id: string
          revoked?: boolean | null
          token_hash: string
          type: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          promise_id?: string
          revoked?: boolean | null
          token_hash?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_links_promise_id_fkey"
            columns: ["promise_id"]
            isOneToOne: false
            referencedRelation: "promises"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_pledges: {
        Row: {
          amount: number
          created_at: string | null
          from_ip_hash: string | null
          from_name: string
          id: string
          promise_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          from_ip_hash?: string | null
          from_name: string
          id?: string
          promise_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          from_ip_hash?: string | null
          from_name?: string
          id?: string
          promise_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_pledges_promise_id_fkey"
            columns: ["promise_id"]
            isOneToOne: false
            referencedRelation: "promises"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      credit_wallet: {
        Args: { amount_cents: number; target_user_id: string }
        Returns: undefined
      }
      debit_wallet: {
        Args: { amount_cents: number; target_user_id: string }
        Returns: boolean
      }
      generate_claim_token: { Args: never; Returns: string }
      update_last_active: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
