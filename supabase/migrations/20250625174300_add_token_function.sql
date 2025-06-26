-- Migration: Add token management functions
-- Created: 2025-06-25
-- Description: Adds add_user_tokens function for subscription management

-- Add missing add_user_tokens function for transaction logging
CREATE OR REPLACE FUNCTION add_user_tokens(
  p_user_id uuid,
  p_tokens_to_add integer,
  p_transaction_type text,
  p_stripe_payment_id text DEFAULT NULL,
  p_stripe_subscription_id text DEFAULT NULL,
  p_description text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Add tokens to user balance
  IF p_tokens_to_add > 0 THEN
    UPDATE user_tokens 
    SET balance = balance + p_tokens_to_add,
        updated_at = now()
    WHERE user_id = p_user_id;
  END IF;
  
  -- Log the transaction
  INSERT INTO token_transactions (
    user_id, 
    tokens_added, 
    transaction_type, 
    stripe_payment_id, 
    stripe_subscription_id, 
    description
  ) VALUES (
    p_user_id, 
    p_tokens_to_add, 
    p_transaction_type, 
    p_stripe_payment_id, 
    p_stripe_subscription_id, 
    p_description
  );
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION add_user_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION add_user_tokens TO service_role;