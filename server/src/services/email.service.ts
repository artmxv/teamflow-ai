import { Resend } from "resend";

import { appUrl, env } from "../config/env.js";

export type EmailDeliveryMode = "resend" | "console" | "dev";

export type SendWorkspaceInviteEmailInput = {
  to: string;
  workspaceName: string;
  role: string;
  acceptUrl: string;
  expiresAt: Date;
  inviterName?: string | null;
  inviterEmail?: string | null;
};

export type SendWorkspaceInviteEmailResult = {
  mode: EmailDeliveryMode;
  sent: boolean;
  warning?: string;
  /** @deprecated Use `mode` — kept for backward compatibility */
  deliveryMode: EmailDeliveryMode;
};

function resolveEmailProvider(): "resend" | "console" {
  return env.EMAIL_PROVIDER;
}

function assertResendConfigured(): void {
  if (!env.RESEND_API_KEY) {
    throw new Error("EMAIL_PROVIDER=resend but RESEND_API_KEY is missing.");
  }
  if (!env.EMAIL_FROM) {
    throw new Error("EMAIL_PROVIDER=resend but EMAIL_FROM is missing.");
  }
}

function consoleDeliveryMode(): "console" | "dev" {
  const nodeEnv = process.env.NODE_ENV?.trim() || "development";
  return nodeEnv === "production" ? "console" : "dev";
}

function isProductionRuntime(): boolean {
  return (process.env.NODE_ENV?.trim() || env.NODE_ENV) === "production";
}

function formatRole(role: string): string {
  const normalized = role.trim().toUpperCase();
  if (normalized === "ADMIN") return "Admin";
  if (normalized === "MEMBER") return "Member";
  if (normalized === "OWNER") return "Owner";
  return role;
}

function formatExpiresAt(date: Date): string {
  return date.toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

function formatInviter(input: SendWorkspaceInviteEmailInput): string | null {
  const name = input.inviterName?.trim();
  const email = input.inviterEmail?.trim();
  if (name && email) return `${name} (${email})`;
  if (name) return name;
  if (email) return email;
  return null;
}

function buildInviteEmailContent(input: SendWorkspaceInviteEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const roleLabel = formatRole(input.role);
  const expiresLabel = formatExpiresAt(input.expiresAt);
  const inviterLabel = formatInviter(input);
  const subject = "You've been invited to TeamFlow AI";

  const inviterHtml = inviterLabel
    ? `<p style="margin:0 0 12px;color:#334155;">Invited by <strong>${escapeHtml(inviterLabel)}</strong></p>`
    : "";
  const inviterText = inviterLabel ? `Invited by: ${inviterLabel}\n` : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;color:#0f172a;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#6366f1;">TeamFlow AI</p>
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">You're invited to a workspace</h1>
    <p style="margin:0 0 12px;color:#334155;">You have been invited to join <strong>${escapeHtml(input.workspaceName)}</strong> on TeamFlow AI.</p>
    ${inviterHtml}
    <p style="margin:0 0 8px;color:#334155;">Role: <strong>${escapeHtml(roleLabel)}</strong></p>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px;">This invitation expires on ${escapeHtml(expiresLabel)} (UTC).</p>
    <p style="margin:0 0 24px;">
      <a href="${escapeHtml(input.acceptUrl)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;">Accept invitation</a>
    </p>
    <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">If the button does not work, copy and paste this link into your browser:<br />
      <a href="${escapeHtml(input.acceptUrl)}" style="color:#4f46e5;word-break:break-all;">${escapeHtml(input.acceptUrl)}</a>
    </p>
  </div>
</body>
</html>`;

  const text = `TeamFlow AI

You have been invited to join "${input.workspaceName}" on TeamFlow AI.

${inviterText}Role: ${roleLabel}
Expires: ${expiresLabel} (UTC)

Accept your invitation:
${input.acceptUrl}
`;

  return { subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function logConsoleInvite(
  input: SendWorkspaceInviteEmailInput,
  mode: "console" | "dev",
  warning?: string,
): void {
  if (warning) {
    console.warn(`[email] ${warning}`);
  }

  if (isProductionRuntime()) {
    console.info("[email] Workspace invite not sent", {
      provider: "console",
      mode,
      reason: "EMAIL_PROVIDER_CONSOLE",
    });
    return;
  }

  console.info(
    `[email] Workspace invite (${mode} fallback)`,
    JSON.stringify(
      {
        to: input.to,
        workspaceName: input.workspaceName,
        role: input.role,
        acceptUrl: input.acceptUrl,
        expiresAt: input.expiresAt.toISOString(),
        inviterName: input.inviterName ?? null,
        inviterEmail: input.inviterEmail ?? null,
        appUrl,
      },
      null,
      2,
    ),
  );
}

function toResult(
  mode: EmailDeliveryMode,
  sent: boolean,
  warning?: string,
): SendWorkspaceInviteEmailResult {
  return {
    mode,
    sent,
    warning,
    deliveryMode: mode,
  };
}

async function sendViaResend(
  input: SendWorkspaceInviteEmailInput,
): Promise<SendWorkspaceInviteEmailResult> {
  assertResendConfigured();

  const resend = new Resend(env.RESEND_API_KEY!);
  const from = env.EMAIL_FROM!;
  const { subject, html, text } = buildInviteEmailContent(input);

  try {
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      subject,
      html,
      text,
    });

    if (error) {
      const warning = "Failed to send invitation email";
      console.error(
        "[email] Resend send failed",
        isProductionRuntime()
          ? { provider: "resend", reason: "PROVIDER_REJECTED" }
          : { to: input.to, message: error.message, name: error.name },
      );
      return toResult("resend", false, warning);
    }

    return toResult("resend", true);
  } catch (error) {
    const warning = "Failed to send invitation email";
    console.error(
      "[email] Resend send error",
      isProductionRuntime()
        ? { provider: "resend", reason: "PROVIDER_ERROR" }
        : {
            to: input.to,
            message: error instanceof Error ? error.message : "Unknown error",
          },
    );
    return toResult("resend", false, warning);
  }
}

export async function sendWorkspaceInviteEmail(
  input: SendWorkspaceInviteEmailInput,
): Promise<SendWorkspaceInviteEmailResult> {
  const provider = resolveEmailProvider();

  if (provider === "resend") {
    return sendViaResend(input);
  }

  const mode = consoleDeliveryMode();
  logConsoleInvite(input, mode);
  return toResult(mode, false);
}
