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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_chat_history: {
        Row: {
          class_session_id: string | null
          created_at: string
          id: string
          message: string
          note_id: string | null
          related_subject: string | null
          related_topic: string | null
          role: string
          scope: string
          test_paper_id: string | null
          user_id: string
        }
        Insert: {
          class_session_id?: string | null
          created_at?: string
          id?: string
          message: string
          note_id?: string | null
          related_subject?: string | null
          related_topic?: string | null
          role: string
          scope?: string
          test_paper_id?: string | null
          user_id: string
        }
        Update: {
          class_session_id?: string | null
          created_at?: string
          id?: string
          message?: string
          note_id?: string | null
          related_subject?: string | null
          related_topic?: string | null
          role?: string
          scope?: string
          test_paper_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_history_class_session_id_fkey"
            columns: ["class_session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_history_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_history_test_paper_id_fkey"
            columns: ["test_paper_id"]
            isOneToOne: false
            referencedRelation: "test_papers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generated_content: {
        Row: {
          content_type: string
          created_at: string
          generated_content: Json
          id: string
          source_note_id: string | null
          user_id: string
        }
        Insert: {
          content_type: string
          created_at?: string
          generated_content: Json
          id?: string
          source_note_id?: string | null
          user_id: string
        }
        Update: {
          content_type?: string
          created_at?: string
          generated_content?: Json
          id?: string
          source_note_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_generated_content_source_note_id_fkey"
            columns: ["source_note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          created_at: string
          id: string
          name: string
          sequence_order: number
          subject_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sequence_order?: number
          subject_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sequence_order?: number
          subject_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      class_sessions: {
        Row: {
          chapter_id: string | null
          continuity_context: string | null
          created_at: string
          id: string
          lecturer_id: string | null
          previous_session_id: string | null
          session_date: string
          subject_id: string
          summary: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          chapter_id?: string | null
          continuity_context?: string | null
          created_at?: string
          id?: string
          lecturer_id?: string | null
          previous_session_id?: string | null
          session_date?: string
          subject_id: string
          summary?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          chapter_id?: string | null
          continuity_context?: string | null
          created_at?: string
          id?: string
          lecturer_id?: string | null
          previous_session_id?: string | null
          session_date?: string
          subject_id?: string
          summary?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_lecturer_id_fkey"
            columns: ["lecturer_id"]
            isOneToOne: false
            referencedRelation: "lecturers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_previous_session_id_fkey"
            columns: ["previous_session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      concepts: {
        Row: {
          chapter_id: string
          created_at: string
          difficulty: number | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          difficulty?: number | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          difficulty?: number | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "concepts_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          user_id?: string
        }
        Relationships: []
      }
      learning_memory: {
        Row: {
          confidence_score: number | null
          created_at: string
          id: string
          last_seen: string
          memory_type: string
          notes: string | null
          subject_id: string | null
          topic: string
          user_id: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          last_seen?: string
          memory_type: string
          notes?: string | null
          subject_id?: string | null
          topic: string
          user_id: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          last_seen?: string
          memory_type?: string
          notes?: string | null
          subject_id?: string | null
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      lecturers: {
        Row: {
          created_at: string
          id: string
          name: string
          subject_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          subject_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          subject_id?: string
          user_id?: string
        }
        Relationships: []
      }
      memories: {
        Row: {
          concept_id: string | null
          confidence_score: number | null
          content: string
          created_at: string
          embedding: string | null
          expires_at: string | null
          frequency_count: number | null
          id: string
          memory_type: string
          metadata: Json | null
          source: string | null
          subject_slug: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          concept_id?: string | null
          confidence_score?: number | null
          content: string
          created_at?: string
          embedding?: string | null
          expires_at?: string | null
          frequency_count?: number | null
          id?: string
          memory_type: string
          metadata?: Json | null
          source?: string | null
          subject_slug?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          concept_id?: string | null
          confidence_score?: number | null
          content?: string
          created_at?: string
          embedding?: string | null
          expires_at?: string | null
          frequency_count?: number | null
          id?: string
          memory_type?: string
          metadata?: Json | null
          source?: string | null
          subject_slug?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memories_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      note_chunks: {
        Row: {
          chunk_index: number
          chunk_text: string
          class_session_id: string | null
          created_at: string
          embedding: string | null
          id: string
          lecturer_id: string | null
          note_id: string
          page_number: number | null
          subject_id: string | null
          topic: string | null
          user_id: string
        }
        Insert: {
          chunk_index: number
          chunk_text: string
          class_session_id?: string | null
          created_at?: string
          embedding?: string | null
          id?: string
          lecturer_id?: string | null
          note_id: string
          page_number?: number | null
          subject_id?: string | null
          topic?: string | null
          user_id: string
        }
        Update: {
          chunk_index?: number
          chunk_text?: string
          class_session_id?: string | null
          created_at?: string
          embedding?: string | null
          id?: string
          lecturer_id?: string | null
          note_id?: string
          page_number?: number | null
          subject_id?: string | null
          topic?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_chunks_class_session_id_fkey"
            columns: ["class_session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_chunks_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          ai_summary: string | null
          class_session_id: string | null
          created_at: string
          detected_topics: Json | null
          error_message: string | null
          extracted_text: string | null
          file_name: string
          id: string
          mime_type: string | null
          pdf_url: string
          status: string
          storage_path: string
          user_id: string
        }
        Insert: {
          ai_summary?: string | null
          class_session_id?: string | null
          created_at?: string
          detected_topics?: Json | null
          error_message?: string | null
          extracted_text?: string | null
          file_name: string
          id?: string
          mime_type?: string | null
          pdf_url: string
          status?: string
          storage_path: string
          user_id: string
        }
        Update: {
          ai_summary?: string | null
          class_session_id?: string | null
          created_at?: string
          detected_topics?: Json | null
          error_message?: string | null
          extracted_text?: string | null
          file_name?: string
          id?: string
          mime_type?: string | null
          pdf_url?: string
          status?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_class_session_id_fkey"
            columns: ["class_session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_logs: {
        Row: {
          cache_hit: boolean | null
          completion_tokens: number | null
          context_token_budget: number | null
          context_tokens_used: number | null
          created_at: string
          error: string | null
          gateway_latency_ms: number | null
          id: string
          intent: string | null
          intent_confidence: number | null
          llm_ttft_ms: number | null
          planner_decision: Json | null
          planner_latency_ms: number | null
          prompt_tokens: number | null
          reasoning_model: string | null
          retrieval_latency_ms: number | null
          tools_called: Json | null
          total_cost_usd: number | null
          total_latency_ms: number | null
          trace_id: string
          user_id: string
        }
        Insert: {
          cache_hit?: boolean | null
          completion_tokens?: number | null
          context_token_budget?: number | null
          context_tokens_used?: number | null
          created_at?: string
          error?: string | null
          gateway_latency_ms?: number | null
          id?: string
          intent?: string | null
          intent_confidence?: number | null
          llm_ttft_ms?: number | null
          planner_decision?: Json | null
          planner_latency_ms?: number | null
          prompt_tokens?: number | null
          reasoning_model?: string | null
          retrieval_latency_ms?: number | null
          tools_called?: Json | null
          total_cost_usd?: number | null
          total_latency_ms?: number | null
          trace_id: string
          user_id: string
        }
        Update: {
          cache_hit?: boolean | null
          completion_tokens?: number | null
          context_token_budget?: number | null
          context_tokens_used?: number | null
          created_at?: string
          error?: string | null
          gateway_latency_ms?: number | null
          id?: string
          intent?: string | null
          intent_confidence?: number | null
          llm_ttft_ms?: number | null
          planner_decision?: Json | null
          planner_latency_ms?: number | null
          prompt_tokens?: number | null
          reasoning_model?: string | null
          retrieval_latency_ms?: number | null
          tools_called?: Json | null
          total_cost_usd?: number | null
          total_latency_ms?: number | null
          trace_id?: string
          user_id?: string
        }
        Relationships: []
      }
      question_attempts: {
        Row: {
          chapter_id: string
          correct_answer: string
          created_at: string
          date: string
          exam_type: string | null
          explanation: string | null
          formula_used: string | null
          id: string
          is_correct: boolean
          mistake_type: string | null
          mode: string
          options: Json
          question: string
          student_answer: string
          subject_id: string
          time_spent: number | null
          topic_id: string
          user_id: string
        }
        Insert: {
          chapter_id: string
          correct_answer: string
          created_at?: string
          date: string
          exam_type?: string | null
          explanation?: string | null
          formula_used?: string | null
          id?: string
          is_correct?: boolean
          mistake_type?: string | null
          mode: string
          options?: Json
          question: string
          student_answer: string
          subject_id: string
          time_spent?: number | null
          topic_id: string
          user_id: string
        }
        Update: {
          chapter_id?: string
          correct_answer?: string
          created_at?: string
          date?: string
          exam_type?: string | null
          explanation?: string | null
          formula_used?: string | null
          id?: string
          is_correct?: boolean
          mistake_type?: string | null
          mode?: string
          options?: Json
          question?: string
          student_answer?: string
          subject_id?: string
          time_spent?: number | null
          topic_id?: string
          user_id?: string
        }
        Relationships: []
      }
      revision_tracker: {
        Row: {
          confidence_level: number | null
          created_at: string
          id: string
          last_revised: string | null
          revision_count: number | null
          subject_id: string | null
          topic: string
          user_id: string
        }
        Insert: {
          confidence_level?: number | null
          created_at?: string
          id?: string
          last_revised?: string | null
          revision_count?: number | null
          subject_id?: string | null
          topic: string
          user_id: string
        }
        Update: {
          confidence_level?: number | null
          created_at?: string
          id?: string
          last_revised?: string | null
          revision_count?: number | null
          subject_id?: string | null
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      semantic_cache: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          intent: string | null
          memory_version: number | null
          query_embedding: string | null
          query_text: string
          response_text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          intent?: string | null
          memory_version?: number | null
          query_embedding?: string | null
          query_text: string
          response_text: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          intent?: string | null
          memory_version?: number | null
          query_embedding?: string | null
          query_text?: string
          response_text?: string
          user_id?: string
        }
        Relationships: []
      }
      study_documents: {
        Row: {
          chapter_id: string | null
          chapter_name: string | null
          content: string
          created_at: string
          id: string
          mode: string
          subject_id: string | null
          subject_name: string | null
          topic_id: string | null
          topic_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chapter_id?: string | null
          chapter_name?: string | null
          content: string
          created_at?: string
          id?: string
          mode: string
          subject_id?: string | null
          subject_name?: string | null
          topic_id?: string | null
          topic_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chapter_id?: string | null
          chapter_name?: string | null
          content?: string
          created_at?: string
          id?: string
          mode?: string
          subject_id?: string | null
          subject_name?: string | null
          topic_id?: string | null
          topic_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_logs: {
        Row: {
          chapter_id: string
          created_at: string
          date: string
          id: string
          lecturer_id: string
          notes: string | null
          subject_id: string
          topic_ids: Json
          understanding: number
          user_id: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          date: string
          id?: string
          lecturer_id: string
          notes?: string | null
          subject_id: string
          topic_ids?: Json
          understanding?: number
          user_id: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          date?: string
          id?: string
          lecturer_id?: string
          notes?: string | null
          subject_id?: string
          topic_ids?: Json
          understanding?: number
          user_id?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          user_id?: string
        }
        Relationships: []
      }
      test_papers: {
        Row: {
          ai_analysis: string | null
          created_at: string
          exam_date: string | null
          extracted_text: string | null
          id: string
          pdf_url: string | null
          status: string
          storage_path: string | null
          subject_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          ai_analysis?: string | null
          created_at?: string
          exam_date?: string | null
          extracted_text?: string | null
          id?: string
          pdf_url?: string | null
          status?: string
          storage_path?: string | null
          subject_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          ai_analysis?: string | null
          created_at?: string
          exam_date?: string | null
          extracted_text?: string | null
          id?: string
          pdf_url?: string | null
          status?: string
          storage_path?: string | null
          subject_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      test_questions: {
        Row: {
          created_at: string
          difficulty: string | null
          id: string
          marks: number | null
          question_text: string
          repeated_frequency: number | null
          test_paper_id: string
          topic: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          difficulty?: string | null
          id?: string
          marks?: number | null
          question_text: string
          repeated_frequency?: number | null
          test_paper_id: string
          topic?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          difficulty?: string | null
          id?: string
          marks?: number | null
          question_text?: string
          repeated_frequency?: number | null
          test_paper_id?: string
          topic?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_questions_test_paper_id_fkey"
            columns: ["test_paper_id"]
            isOneToOne: false
            referencedRelation: "test_papers"
            referencedColumns: ["id"]
          },
        ]
      }
      test_results: {
        Row: {
          attempt_ids: Json
          chapter_id: string
          correct_answers: number
          created_at: string
          date: string
          exam_type: string
          id: string
          score: number
          subject_id: string
          time_allowed: number
          time_taken: number
          total_questions: number
          user_id: string
        }
        Insert: {
          attempt_ids?: Json
          chapter_id: string
          correct_answers: number
          created_at?: string
          date: string
          exam_type: string
          id?: string
          score: number
          subject_id: string
          time_allowed: number
          time_taken: number
          total_questions: number
          user_id: string
        }
        Update: {
          attempt_ids?: Json
          chapter_id?: string
          correct_answers?: number
          created_at?: string
          date?: string
          exam_type?: string
          id?: string
          score?: number
          subject_id?: string
          time_allowed?: number
          time_taken?: number
          total_questions?: number
          user_id?: string
        }
        Relationships: []
      }
      track_progress: {
        Row: {
          chapter_id: string
          covered_topic_ids: Json
          id: string
          last_updated: string
          lecturer_id: string
          user_id: string
        }
        Insert: {
          chapter_id: string
          covered_topic_ids?: Json
          id?: string
          last_updated?: string
          lecturer_id: string
          user_id: string
        }
        Update: {
          chapter_id?: string
          covered_topic_ids?: Json
          id?: string
          last_updated?: string
          lecturer_id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          detail_level: string | null
          exam_priority: string | null
          explanation_style: string | null
          id: string
          preferred_language: string | null
          quiz_style: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detail_level?: string | null
          exam_priority?: string | null
          explanation_style?: string | null
          id?: string
          preferred_language?: string | null
          quiz_style?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          detail_level?: string | null
          exam_priority?: string | null
          explanation_style?: string | null
          id?: string
          preferred_language?: string | null
          quiz_style?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_cache: { Args: never; Returns: number }
      cleanup_expired_memories: { Args: never; Returns: number }
      get_mesh_key: { Args: never; Returns: string }
      match_memories: {
        Args: {
          filter_memory_type?: string
          filter_subject?: string
          match_count?: number
          match_user_id: string
          query_embedding: string
        }
        Returns: {
          confidence_score: number
          content: string
          created_at: string
          id: string
          memory_type: string
          metadata: Json
          similarity: number
          subject_slug: string
        }[]
      }
      match_note_chunks: {
        Args: {
          filter_note_id?: string
          filter_subject?: string
          match_count?: number
          match_user_id: string
          query_embedding: string
        }
        Returns: {
          chunk_text: string
          id: string
          note_id: string
          page_number: number
          similarity: number
          topic: string
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
