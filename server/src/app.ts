import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { notFoundMiddleware } from "./middleware/not-found.middleware.js";
import { healthRouter } from "./routes/health.routes.js";
import { projectsRouter } from "./routes/projects.routes.js";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());

if (env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

app.use("/api/health", healthRouter);
app.use("/api/projects", projectsRouter);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
