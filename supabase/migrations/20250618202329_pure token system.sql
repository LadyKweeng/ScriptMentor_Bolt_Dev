-- Pure Token System - No Conflicts
-- Only creates token tables and essential functions

-- Create user_tokens table
CREATE TABLE user_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  monthly_allowance integer NOT NULL DEFAULT 50,
  tier text NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'creator', 'pro')),
  last_reset_date timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create token_usage table
CREATE TABLE token_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tokens_used integer NOT NULL CHECK (tokens_used > 0),
  action_type text NOT NULL,
  script_id text,
  mentor_id text,
  scene_id text,
  created_at timestamp with time zone DEFAULT now()
);

-- Create token_transactions table  
CREATE TABLE token_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tokens_added integer NOT NULL CHECK (tokens_added > 0),
  transaction_type text NOT NULL,
  stripe_payment_id text,
  stripe_subscription_id text,
  description text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;  
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

-- Simple policies with unique names
CREATE POLICY "user_tokens_own_select" ON user_tokens FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user_tokens_own_update" ON user_tokens FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "user_tokens_service_all" ON user_tokens FOR ALL TO service_role USING (true);

CREATE POLICY "token_usage_own_select" ON token_usage FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "token_usage_own_insert" ON token_usage FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "token_usage_service_all" ON token_usage FOR ALL TO service_role USING (true);

CREATE POLICY "token_transactions_own_select" ON token_transactions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "token_transactions_own_insert" ON token_transactions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "token_transactions_service_all" ON token_transactions FOR ALL TO service_role USING (true);

-- Essential function for token deduction
CREATE OR REPLACE FUNCTION deduct_user_tokens(
  p_user_id uuid,
  p_tokens_to_deduct integer,
  p_action_type text,
  p_script_id text DEFAULT NULL,
  p_mentor_id text DEFAULT NULL,
  p_scene_id text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_balance integer;
BEGIN
  SELECT balance INTO current_balance FROM user_tokens WHERE user_id = p_user_id FOR UPDATE;
  
  IF current_balance IS NULL THEN
    RETURN false;
  END IF;
  
  IF current_balance < p_tokens_to_deduct THEN
    RETURN false;
  END IF;
  
  UPDATE user_tokens SET balance = balance - p_tokens_to_deduct WHERE user_id = p_user_id;
  
  INSERT INTO token_usage (user_id, tokens_used, action_type, script_id, mentor_id, scene_id) 
  VALUES (p_user_id, p_tokens_to_deduct, p_action_type, p_script_id, p_mentor_id, p_scene_id);
  
  RETURN true;
END;
$$;

-- Essential function for token allocation
CREATE OR REPLACE FUNCTION reset_monthly_tokens(
  p_user_id uuid,
  p_tier text,
  p_allowance integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  
AS $$
BEGIN
  INSERT INTO user_tokens (user_id, balance, monthly_allowance, tier) 
  VALUES (p_user_id, p_allowance, p_allowance, p_tier)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    balance = p_allowance,
    monthly_allowance = p_allowance,
    tier = p_tier,
    last_reset_date = now();
END;
$$;

-- Initialize existing users with 50 free tokens
INSERT INTO user_tokens (user_id, balance, monthly_allowance, tier)
SELECT id, 50, 50, 'free'
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;