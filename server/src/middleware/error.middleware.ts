import type { ErrorRequestHandler } from "express";

import { env } from "../config/env.js";

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error(error);

  res.status(500).json({
    message: env.NODE_ENV === "production" ? "Internal server error" : getErrorMessage(error),
  });
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}
