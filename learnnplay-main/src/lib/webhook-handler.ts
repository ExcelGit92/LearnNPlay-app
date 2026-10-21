import { headers } from "hono";
import { stripe } from "./stripe.server";
import type { Subscription } from "./subscriptions";

export async function handleStripeWebhook(
  body: string,
  signature: string,
  supabase: any,
): Promise<{ status: number; message: string }> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return { status: 500, message: "Webhook secret not configured" };
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return { status: 400, message: "Invalid signature" };
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as any;
      const orgId = session.metadata?.org_id;
      const planId = session.metadata?.plan_id;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      if (!orgId || !planId) {
        return { status: 400, message: "Missing metadata" };
      }

      // Create or update subscription
      const { error } = await supabase.from("subscriptions").upsert(
        {
          org_id,
          plan_id,
          status: "active",
          payment_provider_customer_id: customerId,
          payment_provider_subscription_id: subscriptionId,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { onConflict: "org_id" },
      );

      if (error) {
        console.error("Failed to create subscription:", error);
        return { status: 500, message: "Failed to create subscription" };
      }

      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as any;
      const subscriptionId = invoice.subscription as string;

      // Update subscription period
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("payment_provider_subscription_id", subscriptionId)
        .single();

      if (subscription) {
        await supabase
          .from("subscriptions")
          .update({
            status: "active",
            current_period_start: new Date(invoice.period_start * 1000).toISOString(),
            current_period_end: new Date(invoice.period_end * 1000).toISOString(),
          })
          .eq("id", subscription.id);
      }

      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as any;
      const subscriptionId = subscription.id as string;

      // Mark subscription as canceled
      await supabase
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("payment_provider_subscription_id", subscriptionId);

      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return { status: 200, message: "Webhook processed" };
}
