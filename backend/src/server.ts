import { createServer } from "http";
import { Server } from "socket.io";
import { buildApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./db/prisma";
import { connectMongo } from "./db/mongo";
import { connectRedis } from "./db/redis";
import { registerSignalingGateway } from "./modules/signaling/signaling.gateway";

const bootstrap = async (): Promise<void> => {
  await Promise.all([connectMongo(), connectRedis()]);

  const app = buildApp();
  const httpServer = createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: env.corsOrigins,
      credentials: true
    },
    path: "/ws"
  });

  registerSignalingGateway(io);

  httpServer.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on port ${env.port}`);
  });

  const stop = async () => {
    await prisma.$disconnect();
    io.close();
    httpServer.close();
    process.exit(0);
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
};

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to bootstrap backend", err);
  process.exit(1);
});
