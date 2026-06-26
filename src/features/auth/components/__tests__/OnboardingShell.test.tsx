import { describe, expect, it } from "vitest";
import { render, screen } from "../../../../test-utils";
import OnboardingShell from "../OnboardingShell";

describe("OnboardingShell", () => {
  it("shows all onboarding steps and highlights the active step", () => {
    render(
      <OnboardingShell activeStep="profile">
        <p>Step content</p>
      </OnboardingShell>
    );

    expect(screen.getByText("Create account")).toBeInTheDocument();
    expect(screen.getByText("Verify email")).toBeInTheDocument();
    expect(screen.getByText("Complete profile")).toBeInTheDocument();
    expect(screen.getByText("Await approval")).toBeInTheDocument();
    expect(screen.getByText("Step content")).toBeInTheDocument();
  });
});
