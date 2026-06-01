export const PASSWORD_HELPER_TEXT =
  "Use 8+ characters with uppercase, lowercase, number and special character.";

export function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter.";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter.";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number.";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must contain at least one special character.";
  }
  return null;
}
