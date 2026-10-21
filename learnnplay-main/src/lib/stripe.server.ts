import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

export async function createCheckoutSession(params: {
  planId: string;
  orgId: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  // This would fetch the plan from database and create a Stripe checkout session
  // For now, returning a placeholder
  return {
    url: "https://checkout.stripe.com/test-placeholder",
  };
}
