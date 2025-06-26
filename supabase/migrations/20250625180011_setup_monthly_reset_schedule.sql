-- Migration: Set up monthly token reset scheduling
-- Created: 2025-06-25
-- Description: Configures automated scheduling for monthly token resets

-- Enable pg_cron extension for scheduling (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function to trigger the monthly reset Edge Function
CREATE OR REPLACE FUNCTION trigger_monthly_reset()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  function_url text;
  response_status integer;
BEGIN
  -- Construct the Edge Function URL
  function_url := current_setting('app.base_url', true) || '/functions/v1/monthly-token-reset';
  
  -- Log the scheduled execution start
  INSERT INTO system_logs (event_type, details, timestamp)
  VALUES ('monthly_reset_scheduled', '{"trigger": "pg_cron"}'::jsonb, now());

  -- Make HTTP request to trigger the Edge Function
  SELECT status_code INTO response_status
  FROM http((
    'POST',
    function_url,
    ARRAY[http_header('authorization', 'Bearer ' || current_setting('app.service_role_key', true)),
          http_header('x-scheduled', 'true'),
          http_header('content-type', 'application/json')],
    '{"source": "pg_cron"}'
  ));

  -- Log the result
  INSERT INTO system_logs (event_type, details, timestamp)
  VALUES ('monthly_reset_trigger_response', 
          json_build_object('status_code', response_status)::jsonb, 
          now());

  -- Raise notice for debugging
  RAISE NOTICE 'Monthly reset triggered with status: %', response_status;

EXCEPTION WHEN OTHERS THEN
  -- Log any errors
  INSERT INTO system_logs (event_type, details, timestamp)
  VALUES ('monthly_reset_trigger_error', 
          json_build_object('error', SQLERRM)::jsonb, 
          now());
  
  RAISE NOTICE 'Monthly reset trigger failed: %', SQLERRM;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION trigger_monthly_reset TO postgres;

-- Schedule the monthly reset to run on the 1st of every month at 2 AM UTC
-- Note: You may need to adjust this based on your Supabase setup
SELECT cron.schedule('monthly-token-reset', '0 2 1 * *', 'SELECT trigger_monthly_reset();');

-- Alternative: Schedule to run daily at 2 AM (will only process eligible users)
-- This provides more frequent checks and is safer for production
SELECT cron.schedule('daily-token-check', '0 2 * * *', 'SELECT trigger_monthly_reset();');

-- Function to manually trigger reset (for testing/admin use)
CREATE OR REPLACE FUNCTION manual_monthly_reset()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_message text;
BEGIN
  -- Only allow superuser or specific roles to manually trigger
  IF NOT (current_user = 'postgres' OR has_database_privilege(current_user, current_database(), 'CREATE')) THEN
    RETURN 'Permission denied: Only administrators can manually trigger resets';
  END IF;

  -- Call the trigger function
  PERFORM trigger_monthly_reset();
  
  result_message := 'Monthly reset manually triggered at ' || now()::text;
  
  -- Log the manual trigger
  INSERT INTO system_logs (event_type, details, timestamp)
  VALUES ('monthly_reset_manual_trigger', 
          json_build_object('triggered_by', current_user, 'message', result_message)::jsonb, 
          now());
  
  RETURN result_message;
END;
$$;

-- Grant permissions for manual trigger
GRANT EXECUTE ON FUNCTION manual_monthly_reset TO postgres;
GRANT EXECUTE ON FUNCTION manual_monthly_reset TO authenticated;