import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import {
  AuthError,
  getUserById,
  loginUser,
  registerUser,
} from "../services/auth.service.js";
import { getUserCurrentWorkspace } from "../services/workspace-context.service.js";

const registerPasswordSchema = z
  .string()
  .min(8, "password must be at least 8 characters")
  .refine((value) => /[A-Z]/.test(value), {
    message: "password must contain at least one uppercase letter",
  })
  .refine((value) => /[a-z]/.test(value), {
    message: "password must contain at least one lowercase letter",
  })
  .refine((value) => /[0-9]/.test(value), {
    message: "password must contain at least one number",
  })
  .refine((value) => /[^A-Za-z0-9]/.test(value), {
    message: "password must contain at least one special character",
  });

const registerSchema = z.object({
  name: z.string().trim().min(2, "name must be at least 2 characters"),
  email: z.string().trim().email("email must be valid"),
  password: registerPasswordSchema,
});

const loginSchema = z.object({
  email: z.string().trim().email("email must be valid"),
  password: z.string().min(1, "password is required"),
});

function handleAuthError(error: unknown, res: Response, next: NextFunction) {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }
  next(error);
}

export async function registerController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = registerSchema.safeParse(req.body);

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      res.status(400).json({
        message: firstIssue?.message ?? "Invalid registration payload",
        issues: result.error.issues,
      });
      return;
    }

    const { user, token } = await registerUser(result.data);
    res.status(201).json({ data: { user, token } });
  } catch (error) {
    handleAuthError(error, res, next);
  }
}

export async function loginController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = loginSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        message: "Invalid login payload",
        issues: result.error.issues,
      });
      return;
    }

    const { user, token } = await loginUser(result.data);
    res.json({ data: { user, token } });
  } catch (error) {
    handleAuthError(error, res, next);
  }
}

export async function meController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const [user, workspace] = await Promise.all([
      getUserById(req.userId),
      getUserCurrentWorkspace(req.userId),
    ]);
    res.json({ data: { user, workspace } });
  } catch (error) {
    handleAuthError(error, res, next);
  }
}

export async function logoutController(_req: Request, res: Response) {
  res.json({ data: { success: true } });
}
