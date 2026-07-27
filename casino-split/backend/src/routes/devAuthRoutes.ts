/**
 * Route d'authentification de développement UNIQUEMENT.
 *
 * Émule ce qu'un vrai système d'auth (SSO/OAuth de l'opérateur casino)
 * ferait : associer un joueur à un token JWT. Ici on se contente de
 * upsert un utilisateur par username et de lui émettre un token de dev.
 * Désactivée automatiquement hors développement (voir app.ts).
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { issueDevToken } from "../auth/authPlugin";

const loginSchema = z.object({ username: z.string().min(1).max(64) });

const DEFAULT_STARTING_BALANCE = 10_000;

export function registerDevAuthRoutes(fastify: FastifyInstance): void {
  fastify.post("/api/dev/login", async (request, reply) => {
    const { username } = loginSchema.parse(request.body);
    const user = await prisma.user.upsert({
      where: { username },
      update: {},
      create: { username, balance: DEFAULT_STARTING_BALANCE },
    });
    return reply.send({ userId: user.id, username: user.username, balance: user.balance, token: issueDevToken(user.id) });
  });
}
