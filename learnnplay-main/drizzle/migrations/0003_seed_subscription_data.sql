-- Seed subscription plans
INSERT INTO subscription_plans (name, slug, price_usd, interval, max_participants, max_quizzes, ai_limit, features, is_active, stripe_price_id) VALUES
-- Starter Plan (Free)
('Starter', 'starter', 0, 'month', 10, 5, 10,
 '["10 participants per session", "5 quizzes per month", "10 AI quiz generations", "English only", "Basic analytics"]'::jsonb, true, NULL),

-- Pro Trainer Monthly
('Pro Trainer', 'pro-trainer-monthly', 15, 'month', 50, 50, 100,
 '["50 participants per session", "50 quizzes per month", "100 AI quiz generations", "All 16 languages", "Advanced analytics", "Team templates", "Priority support"]'::jsonb, true, NULL),

-- Pro Trainer Yearly ($9/mo = $108/year)
('Pro Trainer', 'pro-trainer-yearly', 108, 'year', 50, 50, 100,
 '["50 participants per session", "50 quizzes per month", "100 AI quiz generations", "All 16 languages", "Advanced analytics", "Team templates", "Priority support", "Save 40% with yearly billing"]'::jsonb, true, NULL),

-- Enterprise Monthly
('Enterprise', 'enterprise-monthly', 49, 'month', 200, -1, -1,
 '["200 participants per session", "Unlimited quizzes", "Unlimited AI generations", "All 16 languages", "Advanced analytics", "Team templates", "Priority support", "Custom branding", "API access"]'::jsonb, true, NULL),

-- Enterprise Yearly ($40/mo = $480/year)
('Enterprise', 'enterprise-yearly', 480, 'year', 200, -1, -1,
 '["200 participants per session", "Unlimited quizzes", "Unlimited AI generations", "All 16 languages", "Advanced analytics", "Team templates", "Priority support", "Custom branding", "API access", "Save 18% with yearly billing"]'::jsonb, true, NULL)
ON CONFLICT (slug) DO NOTHING;

-- Assign admin role to redmi.v1990@gmail.com
-- This will be executed after the user is created
-- The user ID will need to be looked up dynamically
-- For now, we'll add a comment about the admin assignment
-- Run this after user creation: INSERT INTO user_roles (user_id, role) VALUES (user_id, 'admin');
