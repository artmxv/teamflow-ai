import { createServer } from "node:http";

import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { closeChatRealtime, initChatRealtime } from "./realtime/chat-realtime.js";

/**
 * HTTP + Socket.IO on the same port.
 * Realtime and online presence are correct for a single backend instance
 * (WEB_CONCURRENCY=1). Multi-instance needs the Socket.IO Redis adapter and a
 * shared presence store (e.g. Redis); the in-memory presence registry is not
 * multi-instance safe.
 */
const httpServer = createServer(app);
initChatRealtime(httpServer);

httpServer.listen(env.PORT, () => {
  console.log(`TeamFlow API listening on port ${env.PORT} (${env.NODE_ENV})`);
});

let shuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`Received ${signal}, shutting down gracefully…`);

  try {
    await closeChatRealtime();
  } catch (error) {
    console.error("Error while closing Socket.IO:", error);
  }

  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });

  try {
    await prisma.$disconnect();
  } catch (error) {
    console.error("Error while disconnecting Prisma:", error);
  }

  process.exit(0);
}

process.on("SIGTERM", () => {
  void gracefulShutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void gracefulShutdown("SIGINT");
});
