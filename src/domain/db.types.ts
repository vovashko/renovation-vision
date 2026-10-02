
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "activity_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"changes": NonNullable<Json>,"created_at": string,"entity_id": string | null,"entity_type": string,"id": number,"project_id": string,"summary": string
                  }
                  Insert: {
                    "action": string,"actor_id"?: string | null,"changes"?: NonNullable<Json>,"created_at"?: string,"entity_id"?: string | null,"entity_type": string,"id"?: never,"project_id": string,"summary": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"changes"?: NonNullable<Json>,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string,"id"?: never,"project_id"?: string,"summary"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_knowledge": {
                  Row: {
                    "content": string,"created_at": string,"created_by": string | null,"id": string,"is_visible": boolean,"project_id": string,"tags": (string)[],"title": string,"updated_at": string
                  }
                  Insert: {
                    "content"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_visible"?: boolean,"project_id": string,"tags"?: (string)[],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "content"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_visible"?: boolean,"project_id"?: string,"tags"?: (string)[],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_knowledge_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_knowledge_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "project_summary"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_knowledge_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"contacts": {
                  Row: {
                    "company": string | null,"created_at": string,"created_by": string | null,"email": string | null,"full_name": string,"id": string,"kind": Database["public"]['Enums']["contact_kind"],"notes": string | null,"phone": string | null,"trade": string | null,"updated_at": string,"user_id": string | null,"whatsapp": string | null
                  }
                  Insert: {
                    "company"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"full_name": string,"id"?: string,"kind"?: Database["public"]['Enums']["contact_kind"],"notes"?: string | null,"phone"?: string | null,"trade"?: string | null,"updated_at"?: string,"user_id"?: string | null,"whatsapp"?: string | null
                  }
                  Update: {
                    "company"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"full_name"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["contact_kind"],"notes"?: string | null,"phone"?: string | null,"trade"?: string | null,"updated_at"?: string,"user_id"?: string | null,"whatsapp"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "contacts_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contacts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"expenses": {
                  Row: {
                    "amount": number,"category": string,"created_at": string,"created_by": string | null,"description": string,"id": string,"project_id": string,"receipt_path": string | null,"spent_on": string,"stage_id": string | null,"updated_at": string,"vendor": string,"vendor_notes": string
                  }
                  Insert: {
                    "amount": number,"category"?: string,"created_at"?: string,"created_by"?: string | null,"description": string,"id"?: string,"project_id": string,"receipt_path"?: string | null,"spent_on"?: string,"stage_id"?: string | null,"updated_at"?: string,"vendor"?: string,"vendor_notes"?: string
                  }
                  Update: {
                    "amount"?: number,"category"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string,"id"?: string,"project_id"?: string,"receipt_path"?: string | null,"spent_on"?: string,"stage_id"?: string | null,"updated_at"?: string,"vendor"?: string,"vendor_notes"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "project_summary"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_stage_id_fkey"
      columns: ["stage_id"]
isOneToOne: false
      referencedRelation: "stages"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "attachment_path": string | null,"body": string,"created_at": string,"edited_at": string | null,"id": string,"project_id": string,"sender_id": string
                  }
                  Insert: {
                    "attachment_path"?: string | null,"body"?: string,"created_at"?: string,"edited_at"?: string | null,"id"?: string,"project_id": string,"sender_id"?: string
                  }
                  Update: {
                    "attachment_path"?: string | null,"body"?: string,"created_at"?: string,"edited_at"?: string | null,"id"?: string,"project_id"?: string,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "project_summary"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string,"created_at": string,"created_by": string | null,"entity_id": string | null,"entity_type": string | null,"id": string,"kind": string,"link": string | null,"project_id": string,"read_at": string | null,"recipient_id": string,"title": string
                  }
                  Insert: {
                    "body"?: string,"created_at"?: string,"created_by"?: string | null,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"kind"?: string,"link"?: string | null,"project_id": string,"read_at"?: string | null,"recipient_id": string,"title": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"created_by"?: string | null,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"kind"?: string,"link"?: string | null,"project_id"?: string,"read_at"?: string | null,"recipient_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "project_summary"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"photos": {
                  Row: {
                    "alt": string,"caption": string,"created_at": string,"id": string,"project_id": string,"published_at": string | null,"room_id": string | null,"stage_id": string | null,"status": Database["public"]['Enums']["photo_status"],"storage_path": string,"taken_at": string,"updated_at": string,"uploaded_by": string | null
                  }
                  Insert: {
                    "alt"?: string,"caption"?: string,"created_at"?: string,"id"?: string,"project_id": string,"published_at"?: string | null,"room_id"?: string | null,"stage_id"?: string | null,"status"?: Database["public"]['Enums']["photo_status"],"storage_path": string,"taken_at"?: string,"updated_at"?: string,"uploaded_by"?: string | null
                  }
                  Update: {
                    "alt"?: string,"caption"?: string,"created_at"?: string,"id"?: string,"project_id"?: string,"published_at"?: string | null,"room_id"?: string | null,"stage_id"?: string | null,"status"?: Database["public"]['Enums']["photo_status"],"storage_path"?: string,"taken_at"?: string,"updated_at"?: string,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "photos_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "project_summary"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "photos_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "photos_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "photos_stage_id_fkey"
      columns: ["stage_id"]
isOneToOne: false
      referencedRelation: "stages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "photos_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "account_type": Database["public"]['Enums']["account_type"],"avatar_url": string | null,"created_at": string,"full_name": string,"id": string,"updated_at": string
                  }
                  Insert: {
                    "account_type"?: Database["public"]['Enums']["account_type"],"avatar_url"?: string | null,"created_at"?: string,"full_name"?: string,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "account_type"?: Database["public"]['Enums']["account_type"],"avatar_url"?: string | null,"created_at"?: string,"full_name"?: string,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"project_contacts": {
                  Row: {
                    "contact_id": string,"created_at": string,"id": string,"is_primary": boolean,"project_id": string,"role": Database["public"]['Enums']["project_contact_role"],"sort_order": number,"updated_at": string,"visible_to_client": boolean
                  }
                  Insert: {
                    "contact_id": string,"created_at"?: string,"id"?: string,"is_primary"?: boolean,"project_id": string,"role": Database["public"]['Enums']["project_contact_role"],"sort_order"?: number,"updated_at"?: string,"visible_to_client"?: boolean
                  }
                  Update: {
                    "contact_id"?: string,"created_at"?: string,"id"?: string,"is_primary"?: boolean,"project_id"?: string,"role"?: Database["public"]['Enums']["project_contact_role"],"sort_order"?: number,"updated_at"?: string,"visible_to_client"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_contacts_contact_id_fkey"
      columns: ["contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_contacts_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "project_summary"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_contacts_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"project_internal": {
                  Row: {
                    "internal_budget_notes": string,"project_id": string,"updated_at": string
                  }
                  Insert: {
                    "internal_budget_notes"?: string,"project_id": string,"updated_at"?: string
                  }
                  Update: {
                    "internal_budget_notes"?: string,"project_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_internal_project_id_fkey"
      columns: ["project_id"]
isOneToOne: true
      referencedRelation: "project_summary"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_internal_project_id_fkey"
      columns: ["project_id"]
isOneToOne: true
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"project_members": {
                  Row: {
                    "created_at": string,"last_read_at": string | null,"project_id": string,"role": Database["public"]['Enums']["project_role"],"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"last_read_at"?: string | null,"project_id": string,"role": Database["public"]['Enums']["project_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"last_read_at"?: string | null,"project_id"?: string,"role"?: Database["public"]['Enums']["project_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_members_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "project_summary"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_members_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"projects": {
                  Row: {
                    "address": string | null,"address_line": string,"budget": number,"city": string,"country": string,"created_at": string,"created_by": string | null,"currency": string,"id": string,"name": string,"postal_code": string,"schedule_note": string,"schedule_status": Database["public"]['Enums']["schedule_status"],"spent": number,"start_date": string | null,"status": Database["public"]['Enums']["project_status"],"target_date": string | null,"updated_at": string
                  }
                  Insert: {
                    "address"?: never,"address_line"?: string,"budget"?: number,"city"?: string,"country"?: string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"id"?: string,"name": string,"postal_code"?: string,"schedule_note"?: string,"schedule_status"?: Database["public"]['Enums']["schedule_status"],"spent"?: number,"start_date"?: string | null,"status"?: Database["public"]['Enums']["project_status"],"target_date"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: never,"address_line"?: string,"budget"?: number,"city"?: string,"country"?: string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"id"?: string,"name"?: string,"postal_code"?: string,"schedule_note"?: string,"schedule_status"?: Database["public"]['Enums']["schedule_status"],"spent"?: number,"start_date"?: string | null,"status"?: Database["public"]['Enums']["project_status"],"target_date"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"renders": {
                  Row: {
                    "alt": string,"compare_photo_id": string | null,"created_at": string,"description": string,"id": string,"is_visible": boolean,"project_id": string,"room_id": string | null,"sort_order": number,"storage_path": string,"title": string,"updated_at": string
                  }
                  Insert: {
                    "alt"?: string,"compare_photo_id"?: string | null,"created_at"?: string,"description"?: string,"id"?: string,"is_visible"?: boolean,"project_id": string,"room_id"?: string | null,"sort_order"?: number,"storage_path": string,"title"?: string,"updated_at"?: string
                  }
                  Update: {
                    "alt"?: string,"compare_photo_id"?: string | null,"created_at"?: string,"description"?: string,"id"?: string,"is_visible"?: boolean,"project_id"?: string,"room_id"?: string | null,"sort_order"?: number,"storage_path"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "renders_compare_photo_id_fkey"
      columns: ["compare_photo_id"]
isOneToOne: false
      referencedRelation: "photos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "renders_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "project_summary"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "renders_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "renders_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["id"]
    }
                  ]
                },"rooms": {
                  Row: {
                    "client_note": string,"created_at": string,"h": number,"id": string,"is_visible": boolean,"key": string,"name": string,"progress": number,"project_id": string,"sort_order": number,"status": Database["public"]['Enums']["work_status"],"updated_at": string,"w": number,"x": number,"y": number
                  }
                  Insert: {
                    "client_note"?: string,"created_at"?: string,"h"?: number,"id"?: string,"is_visible"?: boolean,"key": string,"name": string,"progress"?: number,"project_id": string,"sort_order"?: number,"status"?: Database["public"]['Enums']["work_status"],"updated_at"?: string,"w"?: number,"x"?: number,"y"?: number
                  }
                  Update: {
                    "client_note"?: string,"created_at"?: string,"h"?: number,"id"?: string,"is_visible"?: boolean,"key"?: string,"name"?: string,"progress"?: number,"project_id"?: string,"sort_order"?: number,"status"?: Database["public"]['Enums']["work_status"],"updated_at"?: string,"w"?: number,"x"?: number,"y"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "rooms_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "project_summary"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rooms_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"stages": {
                  Row: {
                    "client_note": string,"created_at": string,"end_date": string,"id": string,"is_visible": boolean,"key": string,"name": string,"progress": number,"project_id": string,"sort_order": number,"start_date": string,"status": Database["public"]['Enums']["work_status"],"updated_at": string
                  }
                  Insert: {
                    "client_note"?: string,"created_at"?: string,"end_date": string,"id"?: string,"is_visible"?: boolean,"key": string,"name": string,"progress"?: number,"project_id": string,"sort_order"?: number,"start_date": string,"status"?: Database["public"]['Enums']["work_status"],"updated_at"?: string
                  }
                  Update: {
                    "client_note"?: string,"created_at"?: string,"end_date"?: string,"id"?: string,"is_visible"?: boolean,"key"?: string,"name"?: string,"progress"?: number,"project_id"?: string,"sort_order"?: number,"start_date"?: string,"status"?: Database["public"]['Enums']["work_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stages_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "project_summary"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stages_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"done": boolean,"id": string,"is_visible": boolean,"name": string,"project_id": string,"room_id": string | null,"sort_order": number,"stage_id": string,"updated_at": string
                  }
                  Insert: {
                    "completed_at"?: string | null,"created_at"?: string,"done"?: boolean,"id"?: string,"is_visible"?: boolean,"name": string,"project_id": string,"room_id"?: string | null,"sort_order"?: number,"stage_id": string,"updated_at"?: string
                  }
                  Update: {
                    "completed_at"?: string | null,"created_at"?: string,"done"?: boolean,"id"?: string,"is_visible"?: boolean,"name"?: string,"project_id"?: string,"room_id"?: string | null,"sort_order"?: number,"stage_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "project_summary"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_stage_id_fkey"
      columns: ["stage_id"]
isOneToOne: false
      referencedRelation: "stages"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "project_summary": {
                  Row: {
                    "address": string | null,"address_line": string | null,"budget": number | null,"city": string | null,"client_display_name": string | null,"country": string | null,"created_at": string | null,"currency": string | null,"current_stage": string | null,"id": string | null,"manager_name": string | null,"name": string | null,"overall_progress": number | null,"postal_code": string | null,"schedule_note": string | null,"schedule_status": Database["public"]['Enums']["schedule_status"] | null,"spent": number | null,"stages_done": number | null,"stages_total": number | null,"start_date": string | null,"status": Database["public"]['Enums']["project_status"] | null,"target_date": string | null,"updated_at": string | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "add_project_member":
{ Args: { "p_email": string,"p_project": string,"p_role": Database["public"]['Enums']["project_role"] }; Returns: string
                           },
"create_project":
{ Args: { "p_address_line"?: string,"p_budget"?: number,"p_city"?: string,"p_client_name"?: string,"p_country"?: string,"p_currency"?: string,"p_name": string,"p_postal_code"?: string,"p_start_date"?: string,"p_status"?: Database["public"]['Enums']["project_status"],"p_target_date"?: string }; Returns: string
                           },
"is_project_client":
{ Args: { "p_project": string }; Returns: boolean
                           },
"is_project_manager":
{ Args: { "p_project": string }; Returns: boolean
                           },
"is_project_member":
{ Args: { "p_project": string }; Returns: boolean
                           },
"mark_chat_read":
{ Args: { "p_project": string }; Returns: undefined
                           },
"mark_notifications_read":
{ Args: { "p_ids"?: (string)[] }; Returns: undefined
                           },
"notify_project_clients":
{ Args: { "p_body": string,"p_link"?: string,"p_project": string,"p_title": string }; Returns: undefined
                           },
"project_visible_contacts":
{ Args: { "p_project": string }; Returns: {
              "email": string,"full_name": string,"is_primary": boolean,"phone": string,"role": Database["public"]['Enums']["project_contact_role"]
            }[]
                           },
"set_account_type":
{ Args: { "p_type": Database["public"]['Enums']["account_type"],"p_user": string }; Returns: undefined
                           },
"shares_project_with":
{ Args: { "p_user": string }; Returns: boolean
                           },
"staff_mfa_required":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           }
          }
          Enums: {
            "account_type": "manager"|"client"|"admin","contact_kind": "client"|"crew"|"supplier"|"architect"|"other","photo_status": "draft"|"published","project_contact_role": "client"|"poc"|"crew"|"supplier"|"architect","project_role": "manager"|"client","project_status": "planning"|"active"|"on_hold"|"completed"|"archived","schedule_status": "on_schedule"|"at_risk"|"delayed","work_status": "done"|"progress"|"pending"|"blocked"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "account_type": ["manager", "client", "admin"],"contact_kind": ["client", "crew", "supplier", "architect", "other"],"photo_status": ["draft", "published"],"project_contact_role": ["client", "poc", "crew", "supplier", "architect"],"project_role": ["manager", "client"],"project_status": ["planning", "active", "on_hold", "completed", "archived"],"schedule_status": ["on_schedule", "at_risk", "delayed"],"work_status": ["done", "progress", "pending", "blocked"]
          }
        }
} as const

