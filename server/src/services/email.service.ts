import { env } from "../config/env.js";

export type EmailDeliveryMode = "smtp" | "dev" | "logged";

export type SendWorkspaceInviteEmailInput = {
  to: string;
  workspaceName: string;
  role: string;
  acceptUrl: string;
  expiresAt: Date;
};

export type SendWorkspaceInviteEmailResult = {
  deliveryMode: EmailDeliveryMode;
};

function isEmailProviderConfigured(): boolean {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  return Boolean(host && from);
}

export async function sendWorkspaceInviteEmail(
  input: SendWorkspaceInviteEmailInput,
): Promise<SendWorkspaceInviteEmailResult> {
  if (!isEmailProviderConfigured()) {
    console.info(
      "[email] Workspace invite (dev fallback — no SMTP configured)",
      JSON.stringify(
        {
          to: input.to,
          workspaceName: input.workspaceName,
          role: input.role,
          acceptUrl: input.acceptUrl,
          expiresAt: input.expiresAt.toISOString(),
          frontendOrigin: env.CORS_ORIGIN,
        },
        null,
        2,
      ),
    );
    return { deliveryMode: env.NODE_ENV === "production" ? "logged" : "dev" };
  }

  // Real SMTP integration is out of scope for this PR.
  console.info(
    "[email] Workspace invite (SMTP configured but sending not implemented)",
    JSON.stringify({ to: input.to, acceptUrl: input.acceptUrl }, null, 2),
  );
  return { deliveryMode: "logged" };
}
