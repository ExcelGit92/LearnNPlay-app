import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/AppShell";
import { Check } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { createCheckoutSession } from "@/lib/stripe.functions";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
});

function PricingPage() {
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const checkout = useServerFn(createCheckoutSession);

  const plans = [
    {
      name: "Starter",
      slug: "starter",
      price: 0,
      monthlyPrice: 0,
      yearlyPrice: 0,
      interval: "month" as const,
      features: [
        "10 participants per session",
        "5 quizzes per month",
        "10 AI quiz generations",
        "English only",
        "Basic analytics",
      ],
      popular: false,
    },
    {
      name: "Pro Trainer",
      slug: billingInterval === "month" ? "pro-trainer-monthly" : "pro-trainer-yearly",
      price: billingInterval === "month" ? 15 : 9,
      monthlyPrice: 15,
      yearlyPrice: 9,
      interval: billingInterval,
      features: [
        "50 participants per session",
        "50 quizzes per month",
        "100 AI quiz generations",
        "All 16 languages",
        "Advanced analytics",
        "Team templates",
        "Priority support",
      ],
      popular: true,
    },
    {
      name: "Enterprise",
      slug: billingInterval === "month" ? "enterprise-monthly" : "enterprise-yearly",
      price: billingInterval === "month" ? 49 : 40,
      monthlyPrice: 49,
      yearlyPrice: 40,
      interval: billingInterval,
      features: [
        "200 participants per session",
        "Unlimited quizzes",
        "Unlimited AI generations",
        "All 16 languages",
        "Advanced analytics",
        "Team templates",
        "Priority support",
        "Custom branding",
        "API access",
      ],
      popular: false,
    },
  ];

  const handleSubscribe = async (slug: string) => {
    if (slug === "starter") {
      window.location.href = "/dashboard";
      return;
    }
    try {
      const result = await checkout({ data: { planSlug: slug } });
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      console.error("Checkout failed:", error);
      alert("Failed to start checkout. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h1 className="font-display text-4xl font-bold">Simple, Transparent Pricing</h1>
          <p className="mt-4 text-xl text-muted-foreground">
            Choose the plan that fits your training needs
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              onClick={() => setBillingInterval("month")}
              className={`px-4 py-2 rounded-lg font-semibold ${
                billingInterval === "month" ? "bg-primary text-primary-foreground" : "bg-secondary"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval("year")}
              className={`px-4 py-2 rounded-lg font-semibold ${
                billingInterval === "year" ? "bg-primary text-primary-foreground" : "bg-secondary"
              }`}
            >
              Yearly
              <span className="ml-2 rounded-full bg-green-500 px-2 py-0.5 text-xs text-white">
                Save up to 40%
              </span>
            </button>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.slug}
              className={`relative p-8 ${plan.popular ? "border-2 border-primary" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-sm font-bold text-primary-foreground">
                  Most Popular
                </div>
              )}
              <h3 className="font-display text-2xl font-bold">{plan.name}</h3>
              <div className="mt-4">
                <span className="text-4xl font-bold">${plan.price}</span>
                <span className="text-muted-foreground">/{billingInterval}</span>
              </div>
              <ul className="mt-8 space-y-4">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="size-5 shrink-0 text-primary" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSubscribe(plan.slug)}
                className={`mt-8 w-full rounded-xl py-3 font-semibold ${
                  plan.popular ? "bg-primary text-primary-foreground" : "border-2 border-border"
                }`}
              >
                {plan.price === 0 ? "Get Started" : "Subscribe Now"}
              </button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
