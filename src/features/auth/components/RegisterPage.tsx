import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../../constants";
import OnboardingShell from "./OnboardingShell";
import Register from "./Register";

export default function RegisterPage() {
  const navigate = useNavigate();

  return (
    <OnboardingShell activeStep="register">
      <Register onSignInClick={() => navigate(ROUTES.ACCOUNT)} />
    </OnboardingShell>
  );
}
