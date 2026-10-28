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
      hotel_invites: {
        Row: {
          created_at: string
          email: string
          hotel_id: string
          role: Database["public"]["Enums"]["hotel_role"]
        }
        Insert: {
          created_at?: string
          email: string
          hotel_id: string
          role: Database["public"]["Enums"]["hotel_role"]
        }
        Update: {
          created_at?: string
          email?: string
          hotel_id?: string
          role?: Database["public"]["Enums"]["hotel_role"]
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
          hotel_id: string
          role: Database["public"]["Enums"]["hotel_role"]
          user_id: string
        }
        Insert: {
          hotel_id: string
          role: Database["public"]["Enums"]["hotel_role"]
          user_id: string
        }
        Update: {
          hotel_id?: string
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
      suite_claim_invites: { Args: never; Returns: number }
      suite_edit_room: {
        Args: { _edit: Json; _hotel: string; _number: string }
        Returns: Json
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
