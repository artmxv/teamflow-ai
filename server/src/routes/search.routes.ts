import { Router } from "express";

import { searchWorkspaceController } from "../controllers/search.controller.js";
import { requireAuth } from "../middleware/require-auth.middleware.js";

export const searchRouter = Router();

searchRouter.use(requireAuth);

searchRouter.get("/", searchWorkspaceController);
