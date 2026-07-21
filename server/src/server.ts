import { createServer } from "node:http";

import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { closeChatRealtime, initChatRealtime } from "./realtime/chat-realtime.js";

/**
 * HTTP + Socket.IO on the same port.
 * Realtime is correct for a single backend instance; multi-instance needs a shared adapter (e.g. Redis).
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
