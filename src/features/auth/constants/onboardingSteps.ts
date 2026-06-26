export type OnboardingStepKey = "register" | "verify" | "profile" | "approval";

export const ONBOARDING_STEPS: ReadonlyArray<{ key: OnboardingStepKey; label: string }> = [
  { key: "register", label: "Create account" },
  { key: "verify", label: "Verify email" },
  { key: "profile", label: "Complete profile" },
  { key: "approval", label: "Await approval" },
];

export function getOnboardingStepIndex(step: OnboardingStepKey): number {
  return ONBOARDING_STEPS.findIndex((entry) => entry.key === step);
}
