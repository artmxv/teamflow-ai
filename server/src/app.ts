import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { env } from "./config/env.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { notFoundMiddleware } from "./middleware/not-found.middleware.js";
import { aiRouter } from "./routes/ai.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { billingRouter } from "./routes/billing.routes.js";
import { billingWebhookRouter } from "./routes/billing-webhook.routes.js";
import { chatRouter } from "./routes/chat.routes.js";
import { dashboardRouter } from "./routes/dashboard.routes.js";
import { healthRouter } from "./routes/health.routes.js";
import { invitationsRouter } from "./routes/invitations.routes.js";
import { notificationsRouter } from "./routes/notifications.routes.js";
import { projectsRouter } from "./routes/projects.routes.js";
import { searchRouter } from "./routes/search.routes.js";
import { taskRemindersRouter } from "./routes/task-reminders.routes.js";
import { tasksRouter } from "./routes/tasks.routes.js";
import { workspaceRouter } from "./routes/workspace.routes.js";
import { workspacesRouter } from "./routes/workspaces.routes.js";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uploadsRoot = path.join(serverRoot, "uploads");

const allowedOrigins = new Set(env.CORS_ORIGINS);

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/$/, "");
}

export const app = express();

if (env.NODE_ENV === "production") {
  // Render terminates TLS at one trusted proxy hop; req.ip then represents the edge-derived client.
  app.set("trust proxy", 1);
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalized = normalizeOrigin(origin);
      if (allowedOrigins.has(normalized)) {
        callback(null, normalized);
        return;
      }

      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Workspace-Id",
      "x-workspace-id",
      "x-current-workspace-id",
    ],
    optionsSuccessStatus: 204,
  }),
);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use("/uploads", express.static(uploadsRoot));
app.use("/api/billing/webhook", billingWebhookRouter);
app.use(express.json());

if (env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/billing", billingRouter);
app.use("/api/workspace", workspaceRouter);
app.use("/api/workspaces", workspacesRouter);
app.use("/api/invitations", invitationsRouter);
app.use("/api/ai", aiRouter);
app.use("/api/chat", chatRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/internal/task-reminders", taskRemindersRouter);
app.use("/api/search", searchRouter);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
