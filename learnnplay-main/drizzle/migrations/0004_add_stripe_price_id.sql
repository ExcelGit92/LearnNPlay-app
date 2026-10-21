-- Add stripe_price_id column to subscription_plans
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;
