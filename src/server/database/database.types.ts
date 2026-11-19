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
      app_owner: {
        Row: {
          owner_id: string
          singleton: boolean
        }
        ComputedFields: never
        Insert: {
          owner_id: string
          singleton?: boolean
        }
        Update: {
          owner_id?: string
          singleton?: boolean
        }
        Relationships: []
      }
      chat_replies: {
        Row: {
          answer: string
          created_at: string
          id: string
          metadata: NonNullable<Json>
          owner_id: string
          status: string
          turn_id: string
        }
        ComputedFields: never
        Insert: {
          answer?: string
          created_at?: string
          id: string
          metadata?: NonNullable<Json>
          owner_id?: string
          status?: string
          turn_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          metadata?: NonNullable<Json>
          owner_id?: string
          status?: string
          turn_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_replies_turn_id_owner_id_fkey"
            columns: ["turn_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "chat_turns"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      chat_turns: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          question: string
          search_mode: string
          session_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id: string
          owner_id?: string
          question: string
          search_mode: string
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          question?: string
          search_mode?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_turns_session_id_owner_id_fkey"
            columns: ["session_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      knowledge_attempts: {
        Row: {
          is_manual: boolean
          owner_id: string
          project_id: string
          started_at: string
          ticket: string
        }
        ComputedFields: never
        Insert: {
          is_manual: boolean
          owner_id?: string
          project_id: string
          started_at?: string
          ticket: string
        }
        Update: {
          is_manual?: boolean
          owner_id?: string
          project_id?: string
          started_at?: string
          ticket?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_attempts_project_id_owner_id_fkey"
            columns: ["project_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      knowledge_changes: {
        Row: {
          accepted: string | null
          base_revision: number
          created_at: string
          decided_at: string | null
          event_id: string
          id: string
          node_id: string
          owner_id: string
          previous: string
          proposal: string
          quote: string
          reason: string
          state: string
          weight: number
        }
        ComputedFields: never
        Insert: {
          accepted?: string | null
          base_revision: number
          created_at?: string
          decided_at?: string | null
          event_id: string
          id?: string
          node_id: string
          owner_id?: string
          previous: string
          proposal: string
          quote: string
          reason: string
          state: string
          weight: number
        }
        Update: {
          accepted?: string | null
          base_revision?: number
          created_at?: string
          decided_at?: string | null
          event_id?: string
          id?: string
          node_id?: string
          owner_id?: string
          previous?: string
          proposal?: string
          quote?: string
          reason?: string
          state?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_changes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "knowledge_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_changes_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "knowledge_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_edits: {
        Row: {
          created_at: string
          id: string
          new_node: string | null
          node_id: string
          owner_id: string
          previous: NonNullable<Json>
          separated: string | null
          updated: NonNullable<Json>
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          new_node?: string | null
          node_id: string
          owner_id?: string
          previous: NonNullable<Json>
          separated?: string | null
          updated: NonNullable<Json>
        }
        Update: {
          created_at?: string
          id?: string
          new_node?: string | null
          node_id?: string
          owner_id?: string
          previous?: NonNullable<Json>
          separated?: string | null
          updated?: NonNullable<Json>
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_edits_new_node_fkey"
            columns: ["new_node"]
            isOneToOne: false
            referencedRelation: "knowledge_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_edits_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "knowledge_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_edits_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "app_owner"
            referencedColumns: ["owner_id"]
          },
          {
            foreignKeyName: "knowledge_edits_separated_fkey"
            columns: ["separated"]
            isOneToOne: true
            referencedRelation: "knowledge_changes"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_events: {
        Row: {
          attempts: number
          body: string
          created_at: string
          id: string
          kind: string
          leased_at: string | null
          origin: NonNullable<Json>
          owner_id: string
          project_id: string
          session_id: string | null
          source_id: string
          state: string
          ticket: string | null
          title: string
        }
        ComputedFields: never
        Insert: {
          attempts?: number
          body: string
          created_at?: string
          id?: string
          kind: string
          leased_at?: string | null
          origin: NonNullable<Json>
          owner_id?: string
          project_id: string
          session_id?: string | null
          source_id: string
          state?: string
          ticket?: string | null
          title: string
        }
        Update: {
          attempts?: number
          body?: string
          created_at?: string
          id?: string
          kind?: string
          leased_at?: string | null
          origin?: NonNullable<Json>
          owner_id?: string
          project_id?: string
          session_id?: string | null
          source_id?: string
          state?: string
          ticket?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_events_project_id_owner_id_fkey"
            columns: ["project_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      knowledge_nodes: {
        Row: {
          body: string
          id: string
          owner_id: string
          project_id: string
          revision: number
          title: string
          topic: string
        }
        ComputedFields: never
        Insert: {
          body: string
          id?: string
          owner_id?: string
          project_id: string
          revision?: number
          title: string
          topic: string
        }
        Update: {
          body?: string
          id?: string
          owner_id?: string
          project_id?: string
          revision?: number
          title?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_nodes_project_id_owner_id_fkey"
            columns: ["project_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      project_materials: {
        Row: {
          attempted_at: string | null
          body: string
          candidate: boolean
          cited: boolean
          created_at: string
          id: string
          identity_key: string
          kind: string
          lease: string | null
          manual: boolean
          note: string
          origin: string
          owner_id: string
          project_id: string
          state: string
          title: string
        }
        ComputedFields: never
        Insert: {
          attempted_at?: string | null
          body?: string
          candidate?: boolean
          cited?: boolean
          created_at?: string
          id?: string
          identity_key: string
          kind: string
          lease?: string | null
          manual?: boolean
          note?: string
          origin: string
          owner_id?: string
          project_id: string
          state: string
          title: string
        }
        Update: {
          attempted_at?: string | null
          body?: string
          candidate?: boolean
          cited?: boolean
          created_at?: string
          id?: string
          identity_key?: string
          kind?: string
          lease?: string | null
          manual?: boolean
          note?: string
          origin?: string
          owner_id?: string
          project_id?: string
          state?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_materials_project_id_owner_id_fkey"
            columns: ["project_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          purpose: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id: string
          name: string
          owner_id?: string
          purpose?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          purpose?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "app_owner"
            referencedColumns: ["owner_id"]
          },
        ]
      }
      reading_digests: {
        Row: {
          created_at: string
          digest: NonNullable<Json>
          fingerprint: string
          id: string
          owner_id: string
          session_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          digest: NonNullable<Json>
          fingerprint: string
          id?: string
          owner_id?: string
          session_id: string
        }
        Update: {
          created_at?: string
          digest?: NonNullable<Json>
          fingerprint?: string
          id?: string
          owner_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_digests_session_id_owner_id_fkey"
            columns: ["session_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      reading_transfers: {
        Row: {
          destination: string
          owner_id: string
          turn_id: string
        }
        ComputedFields: never
        Insert: {
          destination: string
          owner_id?: string
          turn_id: string
        }
        Update: {
          destination?: string
          owner_id?: string
          turn_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_transfers_destination_fkey"
            columns: ["destination"]
            isOneToOne: true
            referencedRelation: "chat_turns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_transfers_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "app_owner"
            referencedColumns: ["owner_id"]
          },
          {
            foreignKeyName: "reading_transfers_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: true
            referencedRelation: "chat_turns"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          anchor_node: string | null
          anchor_turn: string | null
          context_level: number
          cross_project: boolean
          id: string
          kind: string
          knowledge_scope: number
          material_id: string | null
          owner_id: string
          parent_id: string | null
          parent_scope: number
          peer_scope: number
          project_id: string
          title: string
        }
        ComputedFields: never
        Insert: {
          anchor_node?: string | null
          anchor_turn?: string | null
          context_level?: number
          cross_project?: boolean
          id?: string
          kind: string
          knowledge_scope?: number
          material_id?: string | null
          owner_id?: string
          parent_id?: string | null
          parent_scope?: number
          peer_scope?: number
          project_id: string
          title?: string
        }
        Update: {
          anchor_node?: string | null
          anchor_turn?: string | null
          context_level?: number
          cross_project?: boolean
          id?: string
          kind?: string
          knowledge_scope?: number
          material_id?: string | null
          owner_id?: string
          parent_id?: string | null
          parent_scope?: number
          peer_scope?: number
          project_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_anchor_node_fkey"
            columns: ["anchor_node"]
            isOneToOne: false
            referencedRelation: "knowledge_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_anchor_turn_fkey"
            columns: ["anchor_turn"]
            isOneToOne: false
            referencedRelation: "chat_turns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_material_id_project_id_fkey"
            columns: ["material_id", "project_id"]
            isOneToOne: false
            referencedRelation: "project_materials"
            referencedColumns: ["id", "project_id"]
          },
          {
            foreignKeyName: "sessions_parent_id_project_id_fkey"
            columns: ["parent_id", "project_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id", "project_id"]
          },
          {
            foreignKeyName: "sessions_project_id_owner_id_fkey"
            columns: ["project_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      anchored_branch: {
        Args: {
          anchor_node: string
          anchor_turn: string
          label: string
          parent: string
          request_id: string
          target: string
        }
        Returns: string
      }
      archive_material_refs: {
        Args: { principal: string; refs: Json; target: string }
        Returns: undefined
      }
      begin_node_turn: {
        Args: {
          attempt: string
          body: string
          node: string
          search: string
          target: string
          turn: string
        }
        Returns: string
      }
      begin_source_turn: {
        Args: {
          attempt: string
          body: string
          material: string
          search: string
          target: string
          turn: string
        }
        Returns: string
      }
      begin_turn: {
        Args: {
          attempt: string
          body: string
          search: string
          target: string
          turn: string
        }
        Returns: string
      }
      chat_history: {
        Args: { target: string }
        Returns: {
          answer: string
          id: string
          metadata: Json
          question: string
          search_mode: string
          status: string
        }[]
      }
      claim_knowledge: {
        Args: { job: string; manual: boolean; target: string }
        Returns: {
          attempts: number
          body: string
          created_at: string
          id: string
          kind: string
          leased_at: string | null
          origin: NonNullable<Json>
          owner_id: string
          project_id: string
          session_id: string | null
          source_id: string
          state: string
          ticket: string | null
          title: string
        }[]
        SetofOptions: {
          from: "*"
          to: "knowledge_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_material: {
        Args: { target: string; ticket: string }
        Returns: {
          id: string
          origin: string
        }[]
      }
      commit_knowledge: {
        Args: { decision: Json; job: string; target: string }
        Returns: string
      }
      context_policy: {
        Args: {
          external: boolean
          knowledge_scope: number
          level: number
          parent_scope: number
          peer_scope: number
          target: string
        }
        Returns: undefined
      }
      context_records: {
        Args: { question: string; target: string }
        Returns: {
          answer: string
          category: string
          id: string
          session_id: string
        }[]
      }
      context_settings: {
        Args: { external: boolean; level: number; target: string }
        Returns: undefined
      }
      create_project: {
        Args: {
          project_name: string
          project_purpose: string
          request_id: string
        }
        Returns: string
      }
      edit_knowledge: {
        Args: {
          category: string
          content: string
          expected: number
          new_title: string
          node: string
          separate: string
          target: string
        }
        Returns: string
      }
      explore_sessions: {
        Args: { target: string }
        Returns: {
          anchor_node: string | null
          anchor_turn: string | null
          context_level: number
          cross_project: boolean
          id: string
          kind: string
          knowledge_scope: number
          material_id: string | null
          owner_id: string
          parent_id: string | null
          parent_scope: number
          peer_scope: number
          project_id: string
          title: string
        }[]
        SetofOptions: {
          from: "*"
          to: "sessions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      finish_material: {
        Args: {
          item: string
          new_body: string
          new_note: string
          new_title: string
          target: string
          ticket: string
        }
        Returns: undefined
      }
      finish_turn: {
        Args: { attempt: string; body: string; details: Json; outcome: string }
        Returns: boolean
      }
      forward_reading: {
        Args: { mini_id: string; selected: string[]; target: string }
        Returns: number
      }
      knowledge_base_state: { Args: { target: string }; Returns: Json }
      knowledge_state: { Args: { target: string }; Returns: Json }
      list_materials: {
        Args: { page_offset: number; target: string }
        Returns: {
          candidate: boolean
          cited: boolean
          id: string
          kind: string
          manual: boolean
          state: string
          title: string
        }[]
      }
      material_url_key: { Args: { link: string }; Returns: string }
      open_exploration: {
        Args: {
          label: string
          material: string
          mini: boolean
          parent: string
          request_id: string
          target: string
        }
        Returns: string
      }
      project_list: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          name: string
          purpose: string
          session_id: string
        }[]
      }
      read_material: {
        Args: { item: string; target: string }
        Returns: {
          attempted_at: string | null
          body: string
          candidate: boolean
          cited: boolean
          created_at: string
          id: string
          identity_key: string
          kind: string
          lease: string | null
          manual: boolean
          note: string
          origin: string
          owner_id: string
          project_id: string
          state: string
          title: string
        }[]
        SetofOptions: {
          from: "*"
          to: "project_materials"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      reading_digest: {
        Args: { signature: string; summary: Json; target: string }
        Returns: Json
      }
      related_records: {
        Args: { question: string; target: string }
        Returns: {
          answer: string
          id: string
          session_id: string
        }[]
      }
      research_search: {
        Args: { category: string; page_offset: number; query_text: string }
        Returns: {
          excerpt: string
          id: string
          kind: string
          project_id: string
          title: string
        }[]
      }
      review_knowledge: {
        Args: {
          choice: string
          edited: string
          expected: number
          item: string
          target: string
        }
        Returns: string
      }
      save_material: {
        Args: {
          pdf_hash: string
          source_body: string
          source_kind: string
          source_note: string
          source_origin: string
          source_state: string
          source_title: string
          target: string
        }
        Returns: string
      }
      search_materials: {
        Args: {
          page_offset: number
          query_text: string
          source_type: string
          target: string
        }
        Returns: {
          candidate: boolean
          cited: boolean
          id: string
          kind: string
          manual: boolean
          origin: string
          state: string
          title: string
        }[]
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
