import { classifyError, type UserFacingError } from "./errorHandling";

export type ProfileErrorContext = "completion" | "update" | "review" | "privacy" | "resignation";

const COPY: Record<ProfileErrorContext, { title: string; message: string }> = {
  completion: { title: "Profile not saved", message: "We couldn’t complete your profile. Check your connection and try again." },
  update: { title: "Profile not saved", message: "We couldn’t save your profile. Check your connection and try again." },
  review: { title: "Review not saved", message: "We couldn’t save your profile review. Check your connection and try again." },
  privacy: { title: "Privacy setting not saved", message: "We couldn’t update your privacy setting. Check your connection and try again." },
  resignation: { title: "Membership not changed", message: "We couldn’t resign your membership. Please try again or contact an administrator." },
};

/** Maps profile service failures without exposing provider or backend messages. */
export function toProfileUserFacingError(error: unknown, context: ProfileErrorContext): UserFacingError {
  const category = classifyError(error);
  if (category === "authentication" || category === "authorization") {
    return {
      category,
      title: "Sign in again",
      message: "Please sign in again before retrying this change.",
      retryable: false,
    };
  }
  const copy = COPY[context];
  return { category, ...copy, retryable: true };
}
