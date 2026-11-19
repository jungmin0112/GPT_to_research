export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      app_owner: {
        Row: {
          owner_id: string;
          singleton: boolean;
        };
        ComputedFields: never;
        Insert: {
          owner_id: string;
          singleton?: boolean;
        };
        Update: {
          owner_id?: string;
          singleton?: boolean;
        };
        Relationships: [];
      };
      chat_replies: {
        Row: {
          answer: string;
          created_at: string;
          id: string;
          metadata: NonNullable<Json>;
          owner_id: string;
          status: string;
          turn_id: string;
        };
        ComputedFields: never;
        Insert: {
          answer?: string;
          created_at?: string;
          id: string;
          metadata?: NonNullable<Json>;
          owner_id?: string;
          status?: string;
          turn_id: string;
        };
        Update: {
          answer?: string;
          created_at?: string;
          id?: string;
          metadata?: NonNullable<Json>;
          owner_id?: string;
          status?: string;
          turn_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_replies_turn_id_owner_id_fkey";
            columns: ["turn_id", "owner_id"];
            referencedRelation: "chat_turns";
            referencedColumns: ["id", "owner_id"];
          },
        ];
      };
      chat_turns: {
        Row: {
          created_at: string;
          id: string;
          owner_id: string;
          question: string;
          search_mode: string;
          session_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id: string;
          owner_id?: string;
          question: string;
          search_mode: string;
          session_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          owner_id?: string;
          question?: string;
          search_mode?: string;
          session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_turns_session_id_owner_id_fkey";
            columns: ["session_id", "owner_id"];
            referencedRelation: "sessions";
            referencedColumns: ["id", "owner_id"];
          },
        ];
      };
      project_materials: {
        Row: {
          attempted_at: string | null;
          body: string;
          candidate: boolean;
          cited: boolean;
          created_at: string;
          id: string;
          identity_key: string;
          kind: string;
          lease: string | null;
          manual: boolean;
          note: string;
          origin: string;
          owner_id: string;
          project_id: string;
          state: string;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          attempted_at?: string | null;
          body?: string;
          candidate?: boolean;
          cited?: boolean;
          created_at?: string;
          id?: string;
          identity_key: string;
          kind: string;
          lease?: string | null;
          manual?: boolean;
          note?: string;
          origin: string;
          owner_id?: string;
          project_id: string;
          state: string;
          title: string;
        };
        Update: {
          attempted_at?: string | null;
          body?: string;
          candidate?: boolean;
          cited?: boolean;
          created_at?: string;
          id?: string;
          identity_key?: string;
          kind?: string;
          lease?: string | null;
          manual?: boolean;
          note?: string;
          origin?: string;
          owner_id?: string;
          project_id?: string;
          state?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_materials_project_id_owner_id_fkey";
            columns: ["project_id", "owner_id"];
            referencedRelation: "projects";
            referencedColumns: ["id", "owner_id"];
          },
        ];
      };
      projects: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          owner_id: string;
          purpose: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id: string;
          name: string;
          owner_id?: string;
          purpose?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          owner_id?: string;
          purpose?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey";
            columns: ["owner_id"];
            referencedRelation: "app_owner";
            referencedColumns: ["owner_id"];
          },
        ];
      };
      sessions: {
        Row: {
          id: string;
          kind: string;
          owner_id: string;
          project_id: string;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          kind: string;
          owner_id?: string;
          project_id: string;
          title?: string;
        };
        Update: {
          id?: string;
          kind?: string;
          owner_id?: string;
          project_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sessions_project_id_owner_id_fkey";
            columns: ["project_id", "owner_id"];
            referencedRelation: "projects";
            referencedColumns: ["id", "owner_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      archive_material_refs: {
        Args: { principal: string; refs: Json; target: string };
        Returns: undefined;
      };
      begin_source_turn: {
        Args: {
          attempt: string;
          material: string;
          body: string;
          search: string;
          target: string;
          turn: string;
        };
        Returns: string;
      };
      begin_turn: {
        Args: {
          attempt: string;
          body: string;
          search: string;
          target: string;
          turn: string;
        };
        Returns: string;
      };
      chat_history: {
        Args: { target: string };
        Returns: {
          answer: string;
          id: string;
          metadata: Json;
          question: string;
          search_mode: string;
          status: string;
        }[];
      };
      claim_material: {
        Args: { target: string; ticket: string };
        Returns: {
          id: string;
          origin: string;
        }[];
      };
      create_project: {
        Args: {
          project_name: string;
          project_purpose: string;
          request_id: string;
        };
        Returns: string;
      };
      finish_material: {
        Args: {
          item: string;
          new_body: string;
          new_note: string;
          new_title: string;
          target: string;
          ticket: string;
        };
        Returns: undefined;
      };
      finish_turn: {
        Args: { attempt: string; body: string; details: Json; outcome: string };
        Returns: boolean;
      };
      list_materials: {
        Args: { page_offset: number; target: string };
        Returns: {
          candidate: boolean;
          cited: boolean;
          id: string;
          kind: string;
          manual: boolean;
          state: string;
          title: string;
        }[];
      };
      material_url_key: { Args: { link: string }; Returns: string };
      project_list: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          name: string;
          purpose: string;
          session_id: string;
        }[];
      };
      read_material: {
        Args: { item: string; target: string };
        Returns: {
          attempted_at: string | null;
          body: string;
          candidate: boolean;
          cited: boolean;
          created_at: string;
          id: string;
          identity_key: string;
          kind: string;
          lease: string | null;
          manual: boolean;
          note: string;
          origin: string;
          owner_id: string;
          project_id: string;
          state: string;
          title: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "project_materials";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      save_material: {
        Args: {
          pdf_hash: string;
          source_body: string;
          source_kind: string;
          source_note: string;
          source_origin: string;
          source_state: string;
          source_title: string;
          target: string;
        };
        Returns: string;
      };
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

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
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
