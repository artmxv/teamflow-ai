import { Router } from "express";

import {
  createConversationMessageController,
  createDirectConversationController,
  deleteConversationMessageController,
  getChatConversationsController,
  getChatUnreadCountController,
  getConversationMessagesController,
  markConversationReadController,
  pinConversationController,
} from "../controllers/chat.controller.js";
import { requireAuth } from "../middleware/require-auth.middleware.js";

export const chatRouter = Router();

chatRouter.use(requireAuth);

chatRouter.get("/conversations", getChatConversationsController);
chatRouter.get("/unread-count", getChatUnreadCountController);
chatRouter.post("/conversations/direct", createDirectConversationController);
chatRouter.patch("/conversations/:conversationId/pin", pinConversationController);
chatRouter.post("/conversations/:conversationId/read", markConversationReadController);
chatRouter.patch("/conversations/:conversationId/read", markConversationReadController);
chatRouter.get(
  "/conversations/:conversationId/messages",
  getConversationMessagesController,
);
chatRouter.post(
  "/conversations/:conversationId/messages",
  createConversationMessageController,
);
chatRouter.delete(
  "/conversations/:conversationId/messages/:messageId",
  deleteConversationMessageController,
);
