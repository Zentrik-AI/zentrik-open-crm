import type { Workspace } from "../types";

const ONBOARDING_KEY = "zentrik-open-crm.onboarding.v1";

export type OnboardingMode = "demo" | "workspace" | "import" | "existing";

export type OnboardingState = {
  completed: boolean;
  mode: OnboardingMode;
  completedAt?: string;
};

export const pendingOnboarding: OnboardingState = {
  completed: false,
  mode: "workspace",
};

export function loadOnboardingState(hasExistingWorkspace: boolean): OnboardingState {
  if (typeof window === "undefined") return pendingOnboarding;

  const stored = window.localStorage.getItem(ONBOARDING_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as OnboardingState;
    } catch {
      // Continue with the safest recoverable state below.
    }
  }

  return hasExistingWorkspace
    ? { completed: true, mode: "existing" }
    : pendingOnboarding;
}

export function saveOnboardingState(mode: OnboardingMode): OnboardingState {
  const next: OnboardingState = {
    completed: true,
    mode,
    completedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(ONBOARDING_KEY, JSON.stringify(next));
  } catch {
    // The active session still receives the state when storage is unavailable.
  }
  return next;
}

export function onboardingProgress(workspace: Workspace) {
  return {
    hasAccount: workspace.accounts.length > 0,
    hasSource: workspace.notes.length > 0,
    hasAction: workspace.tasks.length > 0,
  };
}
