export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          avatar_url: string | null;
          account_type: Database["public"]["Enums"]["account_type"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          avatar_url?: string | null;
          account_type?: Database["public"]["Enums"]["account_type"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          avatar_url?: string | null;
          account_type?: Database["public"]["Enums"]["account_type"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          name: string;
          address: string;
          client_name: string;
          start_date: string | null;
          target_date: string | null;
          budget: number;
          spent: number;
          schedule_status: Database["public"]["Enums"]["schedule_status"];
          schedule_note: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string;
          client_name?: string;
          start_date?: string | null;
          target_date?: string | null;
          budget?: number;
          spent?: number;
          schedule_status?: Database["public"]["Enums"]["schedule_status"];
          schedule_note?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string;
          client_name?: string;
          start_date?: string | null;
          target_date?: string | null;
          budget?: number;
          spent?: number;
          schedule_status?: Database["public"]["Enums"]["schedule_status"];
          schedule_note?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_internal: {
        Row: {
          project_id: string;
          internal_budget_notes: string;
          client_phone: string;
          client_email: string;
          updated_at: string;
        };
        Insert: {
          project_id: string;
          internal_budget_notes?: string;
          client_phone?: string;
          client_email?: string;
          updated_at?: string;
        };
        Update: {
          project_id?: string;
          internal_budget_notes?: string;
          client_phone?: string;
          client_email?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_members: {
        Row: {
          project_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["project_role"];
          last_read_at: string | null;
          created_at: string;
        };
        Insert: {
          project_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["project_role"];
          last_read_at?: string | null;
          created_at?: string;
        };
        Update: {
          project_id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["project_role"];
          last_read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      project_crew: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          trade: string;
          phone: string;
          email: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          trade?: string;
          phone?: string;
          email?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          trade?: string;
          phone?: string;
          email?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rooms: {
        Row: {
          id: string;
          project_id: string;
          key: string;
          name: string;
          status: Database["public"]["Enums"]["work_status"];
          progress: number;
          x: number;
          y: number;
          w: number;
          h: number;
          client_note: string;
          sort_order: number;
          is_visible: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          key: string;
          name: string;
          status?: Database["public"]["Enums"]["work_status"];
          progress?: number;
          x?: number;
          y?: number;
          w?: number;
          h?: number;
          client_note?: string;
          sort_order?: number;
          is_visible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          key?: string;
          name?: string;
          status?: Database["public"]["Enums"]["work_status"];
          progress?: number;
          x?: number;
          y?: number;
          w?: number;
          h?: number;
          client_note?: string;
          sort_order?: number;
          is_visible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      stages: {
        Row: {
          id: string;
          project_id: string;
          key: string;
          name: string;
          status: Database["public"]["Enums"]["work_status"];
          progress: number;
          start_date: string;
          end_date: string;
          client_note: string;
          sort_order: number;
          is_visible: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          key: string;
          name: string;
          status?: Database["public"]["Enums"]["work_status"];
          progress?: number;
          start_date: string;
          end_date: string;
          client_note?: string;
          sort_order?: number;
          is_visible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          key?: string;
          name?: string;
          status?: Database["public"]["Enums"]["work_status"];
          progress?: number;
          start_date?: string;
          end_date?: string;
          client_note?: string;
          sort_order?: number;
          is_visible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          project_id: string;
          stage_id: string;
          room_id: string | null;
          name: string;
          done: boolean;
          completed_at: string | null;
          sort_order: number;
          is_visible: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          stage_id: string;
          room_id?: string | null;
          name: string;
          done?: boolean;
          completed_at?: string | null;
          sort_order?: number;
          is_visible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          stage_id?: string;
          room_id?: string | null;
          name?: string;
          done?: boolean;
          completed_at?: string | null;
          sort_order?: number;
          is_visible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      photos: {
        Row: {
          id: string;
          project_id: string;
          stage_id: string | null;
          room_id: string | null;
          storage_path: string;
          alt: string;
          caption: string;
          taken_at: string;
          uploaded_by: string | null;
          status: Database["public"]["Enums"]["photo_status"];
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          stage_id?: string | null;
          room_id?: string | null;
          storage_path: string;
          alt?: string;
          caption?: string;
          taken_at?: string;
          uploaded_by?: string | null;
          status?: Database["public"]["Enums"]["photo_status"];
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          stage_id?: string | null;
          room_id?: string | null;
          storage_path?: string;
          alt?: string;
          caption?: string;
          taken_at?: string;
          uploaded_by?: string | null;
          status?: Database["public"]["Enums"]["photo_status"];
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      renders: {
        Row: {
          id: string;
          project_id: string;
          room_id: string | null;
          storage_path: string;
          alt: string;
          title: string;
          description: string;
          compare_photo_id: string | null;
          sort_order: number;
          is_visible: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          room_id?: string | null;
          storage_path: string;
          alt?: string;
          title?: string;
          description?: string;
          compare_photo_id?: string | null;
          sort_order?: number;
          is_visible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          room_id?: string | null;
          storage_path?: string;
          alt?: string;
          title?: string;
          description?: string;
          compare_photo_id?: string | null;
          sort_order?: number;
          is_visible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          id: string;
          project_id: string;
          stage_id: string | null;
          category: string;
          description: string;
          vendor: string;
          vendor_notes: string;
          amount: number;
          spent_on: string;
          receipt_path: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          stage_id?: string | null;
          category?: string;
          description: string;
          vendor?: string;
          vendor_notes?: string;
          amount: number;
          spent_on?: string;
          receipt_path?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          stage_id?: string | null;
          category?: string;
          description?: string;
          vendor?: string;
          vendor_notes?: string;
          amount?: number;
          spent_on?: string;
          receipt_path?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          project_id: string;
          sender_id: string;
          body: string;
          attachment_path: string | null;
          created_at: string;
          edited_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          sender_id?: string;
          body?: string;
          attachment_path?: string | null;
          created_at?: string;
          edited_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          sender_id?: string;
          body?: string;
          attachment_path?: string | null;
          created_at?: string;
          edited_at?: string | null;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          project_id: string;
          recipient_id: string;
          kind: string;
          title: string;
          body: string;
          link: string | null;
          entity_type: string | null;
          entity_id: string | null;
          created_by: string | null;
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          recipient_id: string;
          kind?: string;
          title: string;
          body?: string;
          link?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          read_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          recipient_id?: string;
          kind?: string;
          title?: string;
          body?: string;
          link?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          read_at?: string | null;
        };
        Relationships: [];
      };
      activity_log: {
        Row: {
          id: number;
          project_id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          summary: string;
          changes: Json;
          created_at: string;
        };
        Insert: {
          id?: number;
          project_id: string;
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          summary: string;
          changes?: Json;
          created_at?: string;
        };
        Update: {
          id?: number;
          project_id?: string;
          actor_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          summary?: string;
          changes?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_knowledge: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          content: string;
          tags: string[];
          is_visible: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          content?: string;
          tags?: string[];
          is_visible?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          content?: string;
          tags?: string[];
          is_visible?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      project_summary: {
        Row: {
          id: string;
          name: string;
          address: string;
          client_name: string;
          start_date: string | null;
          target_date: string | null;
          budget: number;
          spent: number;
          schedule_status: Database["public"]["Enums"]["schedule_status"];
          schedule_note: string;
          overall_progress: number;
          stages_done: number;
          stages_total: number;
          current_stage: string | null;
          manager_name: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      create_project: {
        Args: {
          p_name: string;
          p_address?: string;
          p_client_name?: string;
          p_start_date?: string | null;
          p_target_date?: string | null;
          p_budget?: number;
        };
        Returns: string;
      };
      add_project_member: {
        Args: {
          p_project: string;
          p_email: string;
          p_role: Database["public"]["Enums"]["project_role"];
        };
        Returns: string;
      };
      notify_project_clients: {
        Args: {
          p_project: string;
          p_title: string;
          p_body: string;
          p_link?: string | null;
        };
        Returns: undefined;
      };
      mark_notifications_read: {
        Args: { p_ids?: string[] | null };
        Returns: undefined;
      };
      mark_chat_read: {
        Args: { p_project: string };
        Returns: undefined;
      };
    };
    Enums: {
      project_role: "manager" | "client";
      work_status: "done" | "progress" | "pending" | "blocked";
      schedule_status: "on_schedule" | "at_risk" | "delayed";
      photo_status: "draft" | "published";
      account_type: "manager" | "client";
    };
    CompositeTypes: Record<string, never>;
  };
};
