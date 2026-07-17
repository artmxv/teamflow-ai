import { timingSafeEqual } from "node:crypto";

function safeEqual(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

function extractBearerToken(authorizationHeader: string | undefined): string {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return "";
  }

  return authorizationHeader.slice("Bearer ".length).trim();
}

export type CronSecretValidation = "missing_config" | "invalid" | "valid";

export function validateTaskReminderCronSecret(
  configuredSecret: string | undefined,
  authorizationHeader: string | undefined,
): CronSecretValidation {
  if (!configuredSecret) {
    return "missing_config";
  }

  const token = extractBearerToken(authorizationHeader);
  if (!token || !safeEqual(configuredSecret, token)) {
    return "invalid";
  }

  return "valid";
}
