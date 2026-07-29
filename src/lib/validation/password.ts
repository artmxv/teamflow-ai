import type { TKey } from "@/lib/i18n";

export type PasswordErrorCode = "minLength" | "uppercase" | "lowercase" | "number" | "special";

const PASSWORD_ERROR_KEYS: Record<PasswordErrorCode, TKey> = {
  minLength: "auth.password.minLength",
  uppercase: "auth.password.uppercase",
  lowercase: "auth.password.lowercase",
  number: "auth.password.number",
  special: "auth.password.special",
};

/** Returns a stable error code, or null when the password meets all rules. */
export function validatePassword(password: string): PasswordErrorCode | null {
  if (password.length < 8) {
    return "minLength";
  }
  if (!/[A-Z]/.test(password)) {
    return "uppercase";
  }
  if (!/[a-z]/.test(password)) {
    return "lowercase";
  }
  if (!/[0-9]/.test(password)) {
    return "number";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "special";
  }
  return null;
}

export function passwordErrorKey(code: PasswordErrorCode): TKey {
  return PASSWORD_ERROR_KEYS[code];
}
