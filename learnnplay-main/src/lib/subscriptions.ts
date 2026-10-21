export type UserRole = "admin" | "user";

export type SubscriptionStatus = "active" | "past_due" | "canceled" | "trialing";

export type BillingInterval = "month" | "year";

export type SubscriptionPlan = {
  id: string;
  name: string;
  slug: string;
  price_usd: number;
  interval: BillingInterval;
  max_participants: number;
  max_quizzes: number;
  ai_limit: number;
  features: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Subscription = {
  id: string;
  org_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  payment_provider_customer_id: string | null;
  payment_provider_subscription_id: string | null;
  created_at: string;
  updated_at: string;
  plan?: SubscriptionPlan;
};

export type UserRoleRow = {
  id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
};

export const PLAN_SLUGS = {
  STARTER: "starter",
  PRO_MONTHLY: "pro-trainer-monthly",
  PRO_YEARLY: "pro-trainer-yearly",
  ENTERPRISE_MONTHLY: "enterprise-monthly",
  ENTERPRISE_YEARLY: "enterprise-yearly",
} as const;

export const FREE_PLAN_LIMITS = {
  max_participants: 10,
  max_quizzes: 5,
  ai_limit: 10,
  allowed_languages: ["en"],
};
