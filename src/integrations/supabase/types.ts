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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor: string | null
          after: Json | null
          at: string
          before: Json | null
          entity: string
          entity_key: string
          hotel_id: string
          id: number
        }
        Insert: {
          action: string
          actor?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          entity: string
          entity_key: string
          hotel_id: string
          id?: number
        }
        Update: {
          action?: string
          actor?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          entity?: string
          entity_key?: string
          hotel_id?: string
          id?: number
        }
        Relationships: []
      }
      company_worlds: {
        Row: {
          id: string
          name: string
          owner_id: string
          state: Json
          updated_at: string
        }
        Insert: {
          id?: string
          name?: string
          owner_id: string
          state?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          owner_id?: string
          state?: Json
          updated_at?: string
        }
        Relationships: []
      }
      hotel_budgets: {
        Row: {
          hotel_id: string
          months: number[]
          updated_at: string
          updated_by: string | null
          year: number
        }
        Insert: {
          hotel_id: string
          months: number[]
          updated_at?: string
          updated_by?: string | null
          year: number
        }
        Update: {
          hotel_id?: string
          months?: number[]
          updated_at?: string
          updated_by?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "hotel_budgets_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_floors: {
        Row: {
          hotel_id: string
          id: string
          name: string
          number: number
        }
        Insert: {
          hotel_id: string
          id?: string
          name?: string
          number: number
        }
        Update: {
          hotel_id?: string
          id?: string
          name?: string
          number?: number
        }
        Relationships: [
          {
            foreignKeyName: "hotel_floors_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_guests: {
        Row: {
          data: Json
          hotel_id: string
          id: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          data: Json
          hotel_id: string
          id: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          data?: Json
          hotel_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "hotel_guests_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_incidents: {
        Row: {
          data: Json
          hotel_id: string
          id: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          data: Json
          hotel_id: string
          id: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          data?: Json
          hotel_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "hotel_incidents_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          full_name: string
          hotel_id: string
          modules: string[] | null
          position: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["hotel_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          full_name?: string
          hotel_id: string
          modules?: string[] | null
          position?: string
          revoked_at?: string | null
          role: Database["public"]["Enums"]["hotel_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string
          hotel_id?: string
          modules?: string[] | null
          position?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["hotel_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_invites_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_members: {
        Row: {
          active: boolean
          email: string
          full_name: string
          hotel_id: string
          modules: string[] | null
          position: string
          role: Database["public"]["Enums"]["hotel_role"]
          user_id: string
        }
        Insert: {
          active?: boolean
          email?: string
          full_name?: string
          hotel_id: string
          modules?: string[] | null
          position?: string
          role: Database["public"]["Enums"]["hotel_role"]
          user_id: string
        }
        Update: {
          active?: boolean
          email?: string
          full_name?: string
          hotel_id?: string
          modules?: string[] | null
          position?: string
          role?: Database["public"]["Enums"]["hotel_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_members_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_reservations: {
        Row: {
          data: Json
          guest_id: string | null
          hotel_id: string
          id: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          data: Json
          guest_id?: string | null
          hotel_id: string
          id: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          data?: Json
          guest_id?: string | null
          hotel_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "hotel_reservations_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_guest_fk"
            columns: ["hotel_id", "guest_id"]
            isOneToOne: false
            referencedRelation: "hotel_guests"
            referencedColumns: ["hotel_id", "id"]
          },
        ]
      }
      hotel_room_operations: {
        Row: {
          data: Json
          hotel_id: string
          id: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          data: Json
          hotel_id: string
          id: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          data?: Json
          hotel_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "hotel_room_operations_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_rooms: {
        Row: {
          archived: boolean
          bath: string | null
          beds: string | null
          capacity: number | null
          extras: string[]
          floor: number
          hotel_id: string
          id: string
          layout: Json | null
          notes: string | null
          number: string
          rate: number
          sqm: number | null
          terrace: boolean | null
          type: string
          updated_at: string
          view: string | null
          window_side: string | null
        }
        Insert: {
          archived?: boolean
          bath?: string | null
          beds?: string | null
          capacity?: number | null
          extras?: string[]
          floor: number
          hotel_id: string
          id?: string
          layout?: Json | null
          notes?: string | null
          number: string
          rate?: number
          sqm?: number | null
          terrace?: boolean | null
          type?: string
          updated_at?: string
          view?: string | null
          window_side?: string | null
        }
        Update: {
          archived?: boolean
          bath?: string | null
          beds?: string | null
          capacity?: number | null
          extras?: string[]
          floor?: number
          hotel_id?: string
          id?: string
          layout?: Json | null
          notes?: string | null
          number?: string
          rate?: number
          sqm?: number | null
          terrace?: boolean | null
          type?: string
          updated_at?: string
          view?: string | null
          window_side?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hotel_rooms_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_tasks: {
        Row: {
          data: Json
          hotel_id: string
          id: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          data: Json
          hotel_id: string
          id: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          data?: Json
          hotel_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "hotel_tasks_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotels: {
        Row: {
          address: string
          archived: boolean
          category: string
          check_in: string | null
          check_out: string | null
          city: string
          departments: string[]
          id: string
          key: string
          name: string
          org_owner: string
          timezone: string | null
          updated_at: string
          zones: string[]
        }
        Insert: {
          address?: string
          archived?: boolean
          category?: string
          check_in?: string | null
          check_out?: string | null
          city?: string
          departments?: string[]
          id?: string
          key: string
          name?: string
          org_owner: string
          timezone?: string | null
          updated_at?: string
          zones?: string[]
        }
        Update: {
          address?: string
          archived?: boolean
          category?: string
          check_in?: string | null
          check_out?: string | null
          city?: string
          departments?: string[]
          id?: string
          key?: string
          name?: string
          org_owner?: string
          timezone?: string | null
          updated_at?: string
          zones?: string[]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_name: string
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          company_name?: string
          created_at?: string
          display_name?: string
          id: string
        }
        Update: {
          company_name?: string
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      suite_api_events: {
        Row: {
          attempts: number
          direction: string
          error_code: string | null
          event_id: string
          event_type: string
          hotel_id: string
          http_status: number | null
          id: string
          integration_id: string | null
          payload_hash: string
          processed_at: string | null
          received_at: string
          reservation_id: string | null
          response: Json | null
          status: string
        }
        Insert: {
          attempts?: number
          direction: string
          error_code?: string | null
          event_id: string
          event_type: string
          hotel_id: string
          http_status?: number | null
          id?: string
          integration_id?: string | null
          payload_hash: string
          processed_at?: string | null
          received_at?: string
          reservation_id?: string | null
          response?: Json | null
          status: string
        }
        Update: {
          attempts?: number
          direction?: string
          error_code?: string | null
          event_id?: string
          event_type?: string
          hotel_id?: string
          http_status?: number | null
          id?: string
          integration_id?: string | null
          payload_hash?: string
          processed_at?: string | null
          received_at?: string
          reservation_id?: string | null
          response?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "suite_api_events_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suite_api_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "suite_api_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      suite_api_integrations: {
        Row: {
          api_key_ciphertext: string
          created_at: string
          created_by: string | null
          credential_version: number
          hotel_id: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          organization_id: string
          permissions: string[]
          property_id: string
          request_limit_per_minute: number
          revoked_at: string | null
          rotated_at: string | null
          signing_secret_ciphertext: string
          status: string
        }
        Insert: {
          api_key_ciphertext: string
          created_at?: string
          created_by?: string | null
          credential_version?: number
          hotel_id: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          organization_id: string
          permissions?: string[]
          property_id: string
          request_limit_per_minute?: number
          revoked_at?: string | null
          rotated_at?: string | null
          signing_secret_ciphertext: string
          status?: string
        }
        Update: {
          api_key_ciphertext?: string
          created_at?: string
          created_by?: string | null
          credential_version?: number
          hotel_id?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string
          permissions?: string[]
          property_id?: string
          request_limit_per_minute?: number
          revoked_at?: string | null
          rotated_at?: string | null
          signing_secret_ciphertext?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "suite_api_integrations_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      suite_api_mappings: {
        Row: {
          external_code: string
          hotel_id: string
          integration_id: string
          room_number: string
        }
        Insert: {
          external_code: string
          hotel_id: string
          integration_id: string
          room_number: string
        }
        Update: {
          external_code?: string
          hotel_id?: string
          integration_id?: string
          room_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "suite_api_mappings_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suite_api_mappings_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "suite_api_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      suite_api_rate_buckets: {
        Row: {
          integration_id: string
          request_count: number
          window_start: string
        }
        Insert: {
          integration_id: string
          request_count?: number
          window_start: string
        }
        Update: {
          integration_id?: string
          request_count?: number
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "suite_api_rate_buckets_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "suite_api_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          role: string
          user_id: string
        }
        Insert: {
          role?: string
          user_id: string
        }
        Update: {
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_hotel_role: {
        Args: {
          _hotel: string
          _roles: Database["public"]["Enums"]["hotel_role"][]
          _uid: string
        }
        Returns: boolean
      }
      is_hotel_member: {
        Args: { _hotel: string; _uid: string }
        Returns: boolean
      }
      suite_accept_invite: { Args: { _token: string }; Returns: Json }
      suite_api_claim_event: {
        Args: {
          _event_id: string
          _event_type: string
          _integration: string
          _payload_hash: string
        }
        Returns: Json
      }
      suite_api_consume_rate_limit: {
        Args: { _integration: string; _limit: number }
        Returns: boolean
      }
      suite_api_finish_event: {
        Args: {
          _error_code: string
          _event_id: string
          _http_status: number
          _integration: string
          _reservation_id: string
          _response: Json
          _status: string
        }
        Returns: undefined
      }
      suite_apply_api_reservation: {
        Args: {
          _expected_version: number
          _guest: Json
          _integration: string
          _reservation: Json
        }
        Returns: Json
      }
      suite_apply_operations: {
        Args: { _changes: Json; _hotel: string }
        Returns: undefined
      }
      suite_can_access: {
        Args: { _hotel: string; _module: string }
        Returns: boolean
      }
      suite_claim_invites: { Args: never; Returns: number }
      suite_configure_api_integration: {
        Args: {
          _hotel: string
          _integration: string
          _mappings: Json
          _name: string
          _permissions: string[]
        }
        Returns: undefined
      }
      suite_create_api_integration: {
        Args: {
          _api_key_ciphertext: string
          _created_by: string
          _hotel: string
          _id: string
          _key_hash: string
          _key_prefix: string
          _mappings: Json
          _name: string
          _permissions: string[]
          _secret: string
        }
        Returns: undefined
      }
      suite_edit_room: {
        Args: { _edit: Json; _hotel: string; _number: string }
        Returns: Json
      }
      suite_invite_info: { Args: { _token: string }; Returns: Json }
      suite_load_operations: { Args: { _hotel: string }; Returns: Json }
      suite_revoke_api_integration: {
        Args: { _hotel: string; _integration: string }
        Returns: undefined
      }
      suite_role_modules: {
        Args: { _role: Database["public"]["Enums"]["hotel_role"] }
        Returns: string[]
      }
      suite_rotate_api_integration: {
        Args: {
          _api_key_ciphertext: string
          _hash: string
          _hotel: string
          _integration: string
          _prefix: string
          _secret: string
        }
        Returns: undefined
      }
    }
    Enums: {
      hotel_role:
        | "owner"
        | "director"
        | "reception"
        | "housekeeping"
        | "maintenance"
        | "revenue"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      hotel_role: [
        "owner",
        "director",
        "reception",
        "housekeeping",
        "maintenance",
        "revenue",
      ],
    },
  },
} as const
