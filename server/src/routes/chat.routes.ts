import { Router } from "express";

import {
  createChatMessageController,
  deleteChatMessageController,
  getChatMessagesController,
} from "../controllers/chat.controller.js";
import { requireAuth } from "../middleware/require-auth.middleware.js";

export const chatRouter = Router();

chatRouter.use(requireAuth);
chatRouter.get("/messages", getChatMessagesController);
chatRouter.post("/messages", createChatMessageController);
chatRouter.delete("/messages/:id", deleteChatMessageController);
