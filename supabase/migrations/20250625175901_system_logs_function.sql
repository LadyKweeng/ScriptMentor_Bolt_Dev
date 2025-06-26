-- Migration: Create system logs table and function
-- Created: 2025-06-25
-- Description: Adds system_logs table for monitoring automated processes

-- Create system_logs table for monitoring
CREATE TABLE IF NOT EXISTS system_logs (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  event_type text NOT NULL,
  total_processed integer DEFAULT 0,
  successful integer DEFAULT 0,
  failed integer DEFAULT 0,
  execution_time_ms bigint DEFAULT 0,
  details jsonb,
  timestamp timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_system_logs_event_type ON system_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp);

-- Enable RLS
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage all logs
CREATE POLICY "Service role can manage system logs"
  ON system_logs
  FOR ALL
  TO service_role
  USING (true);

-- Allow authenticated users to read logs (optional - for admin dashboard)
CREATE POLICY "Authenticated users can read system logs"
  ON system_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Function to create system_logs table (for backward compatibility)
CREATE OR REPLACE FUNCTION create_system_logs_table()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Table already exists due to migration, this is a no-op
  -- But the function exists for the Edge Function to call
  RETURN;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_system_logs_table TO service_role;
GRANT EXECUTE ON FUNCTION create_system_logs_table TO authenticated;