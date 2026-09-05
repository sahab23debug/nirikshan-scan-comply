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
      audit_events: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity: string
          entity_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity: string
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity?: string
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      citizen_flags: {
        Row: {
          acknowledged_at: string | null
          citizen_id: string
          created_at: string
          id: string
          note: string | null
          officer_registry_id: string
          report_id: string
          status: string
        }
        Insert: {
          acknowledged_at?: string | null
          citizen_id: string
          created_at?: string
          id?: string
          note?: string | null
          officer_registry_id: string
          report_id: string
          status?: string
        }
        Update: {
          acknowledged_at?: string | null
          citizen_id?: string
          created_at?: string
          id?: string
          note?: string | null
          officer_registry_id?: string
          report_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "citizen_flags_officer_registry_id_fkey"
            columns: ["officer_registry_id"]
            isOneToOne: false
            referencedRelation: "officer_registry"
            referencedColumns: ["officer_id"]
          },
          {
            foreignKeyName: "citizen_flags_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      officer_registry: {
        Row: {
          claimed_by: string | null
          created_at: string
          district: string
          home_lat: number
          home_lng: number
          officer_id: string
          officer_name: string
          state: string
        }
        Insert: {
          claimed_by?: string | null
          created_at?: string
          district: string
          home_lat: number
          home_lng: number
          officer_id: string
          officer_name: string
          state: string
        }
        Update: {
          claimed_by?: string | null
          created_at?: string
          district?: string
          home_lat?: number
          home_lng?: number
          officer_id?: string
          officer_name?: string
          state?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          barcode: string
          brand: string | null
          category: string
          created_at: string
          name: string
        }
        Insert: {
          barcode: string
          brand?: string | null
          category: string
          created_at?: string
          name: string
        }
        Update: {
          barcode?: string
          brand?: string | null
          category?: string
          created_at?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          district: string | null
          email: string | null
          full_name: string | null
          home_lat: number | null
          home_lng: number | null
          id: string
          officer_id: string | null
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          district?: string | null
          email?: string | null
          full_name?: string | null
          home_lat?: number | null
          home_lng?: number | null
          id: string
          officer_id?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          district?: string | null
          email?: string | null
          full_name?: string | null
          home_lat?: number | null
          home_lng?: number | null
          id?: string
          officer_id?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          fields: Json
          id: string
          nutrition: Json | null
          overall_status: string
          scan_id: string
          summary: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          fields?: Json
          id?: string
          nutrition?: Json | null
          overall_status: string
          scan_id: string
          summary?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          fields?: Json
          id?: string
          nutrition?: Json | null
          overall_status?: string
          scan_id?: string
          summary?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      scans: {
        Row: {
          barcode: string | null
          category: string
          created_at: string
          id: string
          images: Json
          lat: number | null
          lng: number | null
          location_label: string | null
          product_name: string | null
          user_id: string
        }
        Insert: {
          barcode?: string | null
          category: string
          created_at?: string
          id?: string
          images?: Json
          lat?: number | null
          lng?: number | null
          location_label?: string | null
          product_name?: string | null
          user_id: string
        }
        Update: {
          barcode?: string | null
          category?: string
          created_at?: string
          id?: string
          images?: Json
          lat?: number | null
          lng?: number | null
          location_label?: string | null
          product_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_officer: { Args: { _uid: string }; Returns: boolean }
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
    Enums: {},
  },
} as const
