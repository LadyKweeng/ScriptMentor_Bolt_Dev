-- Migration: Add token purchase tracking columns
-- Description: Enhance stripe_orders table to track token purchases

-- Add columns to stripe_orders table for token purchase tracking
ALTER TABLE stripe_orders 
ADD COLUMN IF NOT EXISTS tokens_purchased INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS price_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS package_name TEXT DEFAULT NULL;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_stripe_orders_tokens_purchased ON stripe_orders(tokens_purchased) WHERE tokens_purchased IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stripe_orders_price_id ON stripe_orders(price_id) WHERE price_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stripe_orders_customer_tokens ON stripe_orders(customer_id, tokens_purchased) WHERE tokens_purchased IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN stripe_orders.tokens_purchased IS 'Number of tokens purchased in this order (NULL for subscription orders)';
COMMENT ON COLUMN stripe_orders.price_id IS 'Stripe price ID for the purchased item';
COMMENT ON COLUMN stripe_orders.package_name IS 'Human-readable name of the token package purchased';

-- Function to get user purchase history
CREATE OR REPLACE FUNCTION get_user_purchase_history(p_user_id uuid)
RETURNS TABLE(
  order_date timestamptz,
  tokens_purchased integer,
  amount_paid integer,
  package_name text,
  order_id text
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    so.created_at as order_date,
    so.tokens_purchased,
    so.amount_total as amount_paid,
    so.package_name,
    so.checkout_session_id as order_id
  FROM stripe_orders so
  JOIN stripe_customers sc ON so.customer_id = sc.customer_id
  WHERE sc.user_id = p_user_id 
    AND so.tokens_purchased IS NOT NULL
    AND so.status = 'completed'
  ORDER BY so.created_at DESC;
$$;

-- Function to get user total token purchases
CREATE OR REPLACE FUNCTION get_user_token_purchase_stats(p_user_id uuid)
RETURNS TABLE(
  total_tokens_purchased bigint,
  total_amount_spent bigint,
  purchase_count bigint,
  last_purchase_date timestamptz,
  average_purchase_amount numeric
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    COALESCE(SUM(so.tokens_purchased), 0) as total_tokens_purchased,
    COALESCE(SUM(so.amount_total), 0) as total_amount_spent,
    COUNT(*) as purchase_count,
    MAX(so.created_at) as last_purchase_date,
    COALESCE(AVG(so.amount_total), 0) as average_purchase_amount
  FROM stripe_orders so
  JOIN stripe_customers sc ON so.customer_id = sc.customer_id
  WHERE sc.user_id = p_user_id 
    AND so.tokens_purchased IS NOT NULL
    AND so.status = 'completed';
$$;

-- Create view for easy token purchase reporting
CREATE OR REPLACE VIEW token_purchase_summary AS
SELECT 
  sc.user_id,
  COUNT(*) as total_purchases,
  SUM(so.tokens_purchased) as total_tokens_purchased,
  SUM(so.amount_total) as total_spent,
  AVG(so.amount_total) as average_purchase_amount,
  MIN(so.created_at) as first_purchase,
  MAX(so.created_at) as last_purchase
FROM stripe_orders so
JOIN stripe_customers sc ON so.customer_id = sc.customer_id
WHERE so.tokens_purchased IS NOT NULL 
  AND so.status = 'completed'
GROUP BY sc.user_id;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_purchase_history TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_token_purchase_stats TO authenticated;
GRANT SELECT ON token_purchase_summary TO authenticated;
