import type { SubscriptionPlan, Subscription } from "./subscriptions";
import { FREE_PLAN_LIMITS } from "./subscriptions";

export async function getOrgSubscription(orgId: string): Promise<Subscription | null> {
  // This would fetch from database
  // For now, return null (free plan)
  return null;
}

export async function getOrgPlan(orgId: string): Promise<SubscriptionPlan | null> {
  const subscription = await getOrgSubscription(orgId);
  return subscription?.plan || null;
}

export function canJoinSession(participantCount: number, plan: SubscriptionPlan | null): boolean {
  if (!plan) {
    return participantCount < FREE_PLAN_LIMITS.max_participants;
  }
  if (plan.max_participants === -1) return true;
  return participantCount < plan.max_participants;
}

export function canCreateQuiz(quizCount: number, plan: SubscriptionPlan | null): boolean {
  if (!plan) {
    return quizCount < FREE_PLAN_LIMITS.max_quizzes;
  }
  if (plan.max_quizzes === -1) return true;
  return quizCount < plan.max_quizzes;
}

export function canUseAI(aiCount: number, plan: SubscriptionPlan | null): boolean {
  if (!plan) {
    return aiCount < FREE_PLAN_LIMITS.ai_limit;
  }
  if (plan.ai_limit === -1) return true;
  return aiCount < plan.ai_limit;
}

export function canUseLanguage(lang: string, plan: SubscriptionPlan | null): boolean {
  if (!plan) {
    return FREE_PLAN_LIMITS.allowed_languages.includes(lang);
  }
  return true; // Paid plans support all languages
}

export function getUpgradePrompt(feature: string): string {
  const messages: Record<string, string> = {
    participants: "Upgrade to Pro Trainer for up to 50 participants per session",
    quizzes: "Upgrade to Pro Trainer for unlimited quizzes",
    ai: "Upgrade to Pro Trainer for 100 AI quiz generations per month",
    language: "Upgrade to Pro Trainer to access all 16 languages",
  };
  return messages[feature] || "Upgrade to unlock this feature";
}
