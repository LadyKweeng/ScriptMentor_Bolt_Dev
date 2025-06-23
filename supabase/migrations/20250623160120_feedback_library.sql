/*
  # Create Feedback Library System

  1. New Table
    - `feedback_library` table for storing saved feedback and writer suggestions
*/

-- Create feedback_library table
CREATE TABLE feedback_library (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  script_id uuid REFERENCES scripts(id) ON DELETE CASCADE,
  title text NOT NULL,
  mentor_ids text[] NOT NULL,
  mentor_names text NOT NULL,
  pages text NOT NULL,
  type text NOT NULL CHECK (type IN ('feedback', 'writer_suggestions')),
  content jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_encrypted boolean DEFAULT true NOT NULL,
  encryption_version text DEFAULT 'v1' NOT NULL
);

-- Enable RLS
ALTER TABLE feedback_library ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can only access their own feedback library items"
  ON feedback_library FOR ALL USING (auth.uid() = user_id);

-- Create indexes for efficient querying
CREATE INDEX idx_feedback_library_user_id ON feedback_library(user_id);
CREATE INDEX idx_feedback_library_script_id ON feedback_library(script_id);
CREATE INDEX idx_feedback_library_type ON feedback_library(type);
CREATE INDEX idx_feedback_library_created_at ON feedback_library(created_at DESC);