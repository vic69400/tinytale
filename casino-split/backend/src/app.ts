/** Construction de l'instance Fastify : plugins, CORS, rate limiting, routes. */
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { redis } from "./db/redis";
import { authPlugin } from "./auth/authPlugin";
import { registerProtectedSplitRoutes, registerPublicSplitRoutes } from "./routes/splitRoutes";

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  });

  // global:false => le rate limiting ne s'applique qu'aux routes qui déclarent
  // explicitement une config.rateLimit (voir routes/splitRoutes.ts : /start, /round).
  app.register(rateLimit, {
    global: false,
    redis,
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.register(async (publicScope) => {
    registerPublicSplitRoutes(publicScope);
  });

  app.register(async (protectedScope) => {
    await protectedScope.register(authPlugin);
    registerProtectedSplitRoutes(protectedScope);
  });

  return app;
}
