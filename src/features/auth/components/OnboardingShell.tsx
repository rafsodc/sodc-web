import { Box, Step, StepLabel, Stepper, Typography } from "@mui/material";
import { colors } from "../../../config/colors";
import {
  ONBOARDING_STEPS,
  getOnboardingStepIndex,
  type OnboardingStepKey,
} from "../constants/onboardingSteps";

export interface OnboardingShellProps {
  activeStep: OnboardingStepKey;
  children: React.ReactNode;
}

export default function OnboardingShell({ activeStep, children }: OnboardingShellProps) {
  const stepIndex = getOnboardingStepIndex(activeStep);

  return (
    <Box sx={{ maxWidth: "640px", mx: "auto", width: "100%" }}>
      <Typography variant="overline" color="text.secondary" sx={{ display: "block", mb: 1 }}>
        Joining SODC
      </Typography>
      <Stepper activeStep={stepIndex} alternativeLabel sx={{ mb: 4 }}>
        {ONBOARDING_STEPS.map((step) => (
          <Step key={step.key} completed={getOnboardingStepIndex(step.key) < stepIndex}>
            <StepLabel>{step.label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      <Box sx={{ color: colors.titlePrimary }}>{children}</Box>
    </Box>
  );
}
