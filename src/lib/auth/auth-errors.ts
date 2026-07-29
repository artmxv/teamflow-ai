import type { TKey } from "@/lib/i18n";

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.toLowerCase();
  }
  return "";
}

/** Maps login API failures to safe i18n keys. Never returns raw backend text. */
export function authSignInErrorKey(error: unknown): TKey {
  const message = errorMessage(error);

  if (message.includes("invalid email or password") || message.includes("invalid login payload")) {
    return "auth.invalidCredentials";
  }

  return "auth.signInFailed";
}

/** Maps register API failures to safe i18n keys. Never returns raw backend text. */
export function authSignUpErrorKey(error: unknown): TKey {
  const message = errorMessage(error);

  if (message.includes("email already exists")) {
    return "auth.emailExists";
  }

  if (
    message.includes("invalid registration payload") ||
    message.includes("password must") ||
    message.includes("invalid email")
  ) {
    return "auth.validationFailed";
  }

  return "auth.signUpFailed";
}
