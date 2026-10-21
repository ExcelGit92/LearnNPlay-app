import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { stripe } from "./stripe.server";
import type { SubscriptionPlan } from "./subscriptions";

/** Create Stripe checkout session for subscription */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        planSlug: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;

    // Get user's org
    const { data: member } = await supabase
      .from("organization_members")
      .select("org_id")
      .eq("user_id", userId)
      .single();

    if (!member) {
      throw new Error("User not in an organization");
    }

    // Get plan details
    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("slug", data.planSlug)
      .eq("is_active", true)
      .single();

    if (!plan) {
      throw new Error("Plan not found");
    }

    // Get or create Stripe customer
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("payment_provider_customer_id")
      .eq("org_id", member.org_id)
      .single();

    let customerId = existingSub?.payment_provider_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { org_id: member.org_id },
      });
      customerId = customer.id;
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: plan.name,
              description: `${plan.interval}ly subscription`,
            },
            unit_amount: plan.price_usd * 100, // Convert to cents
            recurring: {
              interval: plan.interval,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.VITE_APP_URL || "http://localhost:8080"}/pricing?success=true`,
      cancel_url: `${process.env.VITE_APP_URL || "http://localhost:8080"}/pricing?canceled=true`,
      metadata: {
        org_id: member.org_id,
        plan_id: plan.id,
      },
    });

    return { url: session.url };
  });

/** Cancel subscription */
export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;

    // Get user's org
    const { data: member } = await supabase
      .from("organization_members")
      .select("org_id")
      .eq("user_id", userId)
      .single();

    if (!member) {
      throw new Error("User not in an organization");
    }

    // Get subscription
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("org_id", member.org_id)
      .single();

    if (!subscription || !subscription.payment_provider_subscription_id) {
      throw new Error("No active subscription found");
    }

    // Cancel in Stripe
    await stripe.subscriptions.cancel(subscription.payment_provider_subscription_id);

    // Update in database
    await supabase.from("subscriptions").update({ status: "canceled" }).eq("id", subscription.id);

    return { success: true };
  });
