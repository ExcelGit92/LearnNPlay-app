import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/AppShell";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Edit, Check, X } from "lucide-react";
import type { SubscriptionPlan } from "@/lib/subscriptions";

export const Route = createFileRoute("/admin/plans")({
  component: AdminPlansPage,
});

function AdminPlansPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [newPlan, setNewPlan] = useState(false);

  // This would be replaced with actual data fetching
  // For now, showing placeholder structure

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">Subscription Plans</h1>
            <p className="mt-2 text-muted-foreground">Manage subscription plans for LearnNPlay</p>
          </div>
          <button
            onClick={() => setNewPlan(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground"
          >
            <Plus className="size-4" /> Add Plan
          </button>
        </div>

        <div className="grid gap-4">
          {plans.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No plans found. Add your first plan.</p>
            </Card>
          ) : (
            plans.map((plan) => (
              <Card key={plan.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-display text-xl font-bold">{plan.name}</h3>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">
                        {plan.interval}
                      </span>
                      {!plan.is_active && (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-2xl font-bold">${plan.price_usd}</p>
                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-semibold">Max Participants:</span>{" "}
                        {plan.max_participants}
                      </div>
                      <div>
                        <span className="font-semibold">Max Quizzes:</span>{" "}
                        {plan.max_quizzes === -1 ? "Unlimited" : plan.max_quizzes}
                      </div>
                      <div>
                        <span className="font-semibold">AI Limit:</span>{" "}
                        {plan.ai_limit === -1 ? "Unlimited" : plan.ai_limit}
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="mb-2 text-sm font-semibold">Features:</p>
                      <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                        {plan.features.map((feature, i) => (
                          <li key={i}>{feature}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-lg p-2 hover:bg-secondary">
                      <Edit className="size-4" />
                    </button>
                    <button className="rounded-lg p-2 hover:bg-destructive/10 text-destructive">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {newPlan && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/50">
            <Card className="max-w-lg p-6">
              <h2 className="mb-4 font-display text-xl font-bold">Add New Plan</h2>
              <p className="text-sm text-muted-foreground">
                Plan management will be implemented with server functions.
              </p>
              <button
                onClick={() => setNewPlan(false)}
                className="mt-4 rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground"
              >
                Close
              </button>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
