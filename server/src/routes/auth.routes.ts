import { Router } from "express";

import {
  loginController,
  logoutController,
  meController,
  registerController,
  removeAvatarController,
  updateProfileController,
  uploadAvatarController,
} from "../controllers/auth.controller.js";
import {
  googleAuthCallbackController,
  googleAuthStartController,
} from "../controllers/google-auth.controller.js";
import { authRateLimitMiddleware } from "../middleware/auth-rate-limit.middleware.js";
import { requireAuth } from "../middleware/require-auth.middleware.js";

export const authRouter = Router();

authRouter.get("/google", googleAuthStartController);
authRouter.get("/google/callback", googleAuthCallbackController);
authRouter.post("/register", authRateLimitMiddleware, registerController);
authRouter.post("/login", authRateLimitMiddleware, loginController);
authRouter.get("/me", requireAuth, meController);
authRouter.patch("/profile", requireAuth, updateProfileController);
authRouter.post("/avatar", requireAuth, uploadAvatarController);
authRouter.delete("/avatar", requireAuth, removeAvatarController);
authRouter.post("/logout", logoutController);
