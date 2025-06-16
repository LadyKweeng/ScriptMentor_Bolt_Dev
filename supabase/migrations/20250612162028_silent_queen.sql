/*
  # Create Feedback History System

  1. New Tables
    - `feedback_history` table for storing multiple feedback sessions
      - `id` (uuid, primary key)
      - `script_id` (uuid) - References scripts table
      - `mentor_id` (text) - ID of the mentor who provided feedback
      - `mentor_name` (text) - Name of the mentor for display
      - `feedback_type` (text) - Type: 'single', 'chunked', 'blended'
      - `feedback_data` (jsonb) - Complete feedback object
      - `session_name` (text) - User-defined name for this feedback session
      - `is_favorite` (boolean) - Whether user marked as favorite
      - `created_at` (timestamptz)
      - `user_id` (uuid) - References auth.users

  2. Security
    - Enable RLS on feedback_history table
    - Add policies for user-specific access

  3. Indexes
    - Add indexes for efficient querying
*/

-- Create feedback_history table
CREATE TABLE IF NOT EXISTS feedback_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid REFERENCES scripts(id) ON DELETE CASCADE,
  mentor_id text NOT NULL,
  mentor_name text NOT NULL,
  feedback_type text NOT NULL CHECK (feedback_type IN ('single', 'chunked', 'blended')),
  feedback_data jsonb NOT NULL,
  session_name text NOT NULL,
  is_favorite boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users NOT NULL
);

-- Enable RLS
ALTER TABLE feedback_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own feedback history"
  ON feedback_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feedback history"
  ON feedback_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback history"
  ON feedback_history
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feedback history"
  ON feedback_history
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for faster queries
CREATE INDEX feedback_history_user_id_idx ON feedback_history(user_id);
CREATE INDEX feedback_history_script_id_idx ON feedback_history(script_id);
CREATE INDEX feedback_history_mentor_id_idx ON feedback_history(mentor_id);
CREATE INDEX feedback_history_created_at_idx ON feedback_history(created_at DESC);
CREATE INDEX feedback_history_is_favorite_idx ON feedback_history(is_favorite);

-- Add comments
COMMENT ON TABLE feedback_history IS 'Stores multiple feedback sessions for scripts, allowing users to save and reload different mentor feedback';
COMMENT ON COLUMN feedback_history.feedback_type IS 'Type of feedback: single (one scene), chunked (multiple sections), or blended (multiple mentors)';
COMMENT ON COLUMN feedback_history.feedback_data IS 'Complete feedback object including structured/scratchpad content and metadata';
COMMENT ON COLUMN feedback_history.session_name IS 'User-defined name for this feedback session for easy identification';