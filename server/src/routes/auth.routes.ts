import { Router } from "express";

import {
  loginController,
  logoutController,
  meController,
  registerController,
  updateProfileController,
  uploadAvatarController,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/require-auth.middleware.js";

export const authRouter = Router();

authRouter.post("/register", registerController);
authRouter.post("/login", loginController);
authRouter.get("/me", requireAuth, meController);
authRouter.patch("/profile", requireAuth, updateProfileController);
authRouter.post("/avatar", requireAuth, uploadAvatarController);
authRouter.post("/logout", logoutController);
