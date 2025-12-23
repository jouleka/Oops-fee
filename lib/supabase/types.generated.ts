export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      friend_claims: {
        Row: {
          id: string
          promise_id: string
          friend_email: string | null
          friend_phone: string | null
          friend_name: string
          stripe_account_id: string | null
          stripe_account_status: string | null
          claim_status: string
          claim_token: string
          claim_expires_at: string | null
          amount_cents: number | null
          transfer_id: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          promise_id: string
          friend_email?: string | null
          friend_phone?: string | null
          friend_name: string
          stripe_account_id?: string | null
          stripe_account_status?: string | null
          claim_status?: string
          claim_token: string
          claim_expires_at?: string | null
          amount_cents?: number | null
          transfer_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          promise_id?: string
          friend_email?: string | null
          friend_phone?: string | null
          friend_name?: string
          stripe_account_id?: string | null
          stripe_account_status?: string | null
          claim_status?: string
          claim_token?: string
          claim_expires_at?: string | null
          amount_cents?: number | null
          transfer_id?: string | null
          created_at?: string | null
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
          created_at: string | null
          default_payment_method_id: string | null
          display_name: string | null
          expo_push_token: string | null
          failed_payment_count: number | null
          id: string
          payment_blocked: boolean | null
          payment_method_brand: string | null
          payment_method_last4: string | null
          payment_method_type: string | null
          stripe_customer_id: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          default_payment_method_id?: string | null
          display_name?: string | null
          expo_push_token?: string | null
          failed_payment_count?: number | null
          id: string
          payment_blocked?: boolean | null
          payment_method_brand?: string | null
          payment_method_last4?: string | null
          payment_method_type?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          default_payment_method_id?: string | null
          display_name?: string | null
          expo_push_token?: string | null
          failed_payment_count?: number | null
          id?: string
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
      generate_claim_token: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      update_last_active: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
