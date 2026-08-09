import { Router } from "express";

import {
  addChatMessageReactionController,
  createConversationMessageController,
  createChannelConversationController,
  createDirectConversationController,
  deleteConversationMessageController,
  downloadChatAttachmentController,
  getChatConversationsController,
  getChatUnreadCountController,
  getConversationMessagesController,
  getPinnedChatMessagesController,
  markConversationReadController,
  pinChatMessageController,
  pinConversationController,
  removeChatMessageReactionController,
  renameConversationController,
  unpinChatMessageController,
} from "../controllers/chat.controller.js";
import { requireAuth } from "../middleware/require-auth.middleware.js";

export const chatRouter = Router();

chatRouter.use(requireAuth);

chatRouter.get("/conversations", getChatConversationsController);
chatRouter.get("/unread-count", getChatUnreadCountController);
chatRouter.post("/conversations/direct", createDirectConversationController);
chatRouter.post("/conversations/channel", createChannelConversationController);
chatRouter.patch("/conversations/:conversationId/pin", pinConversationController);
chatRouter.patch("/conversations/:conversationId", renameConversationController);
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
chatRouter.get(
  "/conversations/:conversationId/pinned-messages",
  getPinnedChatMessagesController,
);
chatRouter.get(
  "/conversations/:conversationId/attachments/:attachmentId/file",
  downloadChatAttachmentController,
);
chatRouter.delete(
  "/conversations/:conversationId/messages/:messageId",
  deleteConversationMessageController,
);
chatRouter.put(
  "/conversations/:conversationId/messages/:messageId/reactions",
  addChatMessageReactionController,
);
chatRouter.delete(
  "/conversations/:conversationId/messages/:messageId/reactions",
  removeChatMessageReactionController,
);
chatRouter.put(
  "/conversations/:conversationId/messages/:messageId/pin",
  pinChatMessageController,
);
chatRouter.delete(
  "/conversations/:conversationId/messages/:messageId/pin",
  unpinChatMessageController,
);
