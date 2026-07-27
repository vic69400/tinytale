/**
 * Routes REST du jeu Split. Les routes protégées (start/round/cashout/
 * session/:userId/session-rotate) exigent un Bearer JWT (voir authPlugin) ;
 * verify/:sessionId est publique, à but de vérification indépendante.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z, ZodError } from "zod";
import { prisma } from "../db/prisma";
import { findActiveSession, toPublicView, rotateSession, SessionRotationBlockedError } from "../services/seedSessionService";
import {
  startGame,
  playRound,
  cashOut,
  verifySession,
  InsufficientBalanceError,
  GameAlreadyInProgressError,
  GameNotActiveError,
  NoRoundPlayedError,
} from "../services/splitGameService";

const startBodySchema = z.object({
  userId: z.string().uuid(),
  betAmount: z.number().int().positive(),
  clientSeed: z.string().min(1).max(128).optional(),
});

const roundBodySchema = z.object({
  userId: z.string().uuid(),
  gameId: z.string().uuid(),
  direction: z.enum(["left", "right"]),
});

const cashoutBodySchema = z.object({
  userId: z.string().uuid(),
  gameId: z.string().uuid(),
});

const rotateBodySchema = z.object({
  userId: z.string().uuid(),
  clientSeed: z.string().min(1).max(128).optional(),
});

const userIdParamsSchema = z.object({ userId: z.string().uuid() });
const sessionIdParamsSchema = z.object({ sessionId: z.string().uuid() });

/** Vérifie que le userId de la requête correspond bien à l'utilisateur authentifié. */
function requireSelf(request: FastifyRequest, reply: FastifyReply, userId: string): boolean {
  if (request.userId !== userId) {
    reply.code(403).send({ error: "userId ne correspond pas à l'utilisateur authentifié." });
    return false;
  }
  return true;
}

function handleError(reply: FastifyReply, err: unknown): FastifyReply {
  if (err instanceof ZodError) {
    return reply.code(400).send({ error: "Requête invalide.", details: err.issues });
  }
  if (err instanceof RangeError) {
    return reply.code(400).send({ error: err.message });
  }
  if (err instanceof InsufficientBalanceError || err instanceof NoRoundPlayedError) {
    return reply.code(400).send({ error: err.message });
  }
  if (
    err instanceof GameAlreadyInProgressError ||
    err instanceof GameNotActiveError ||
    err instanceof SessionRotationBlockedError
  ) {
    return reply.code(409).send({ error: err.message });
  }
  reply.log.error(err);
  return reply.code(500).send({ error: "Erreur interne du serveur." });
}

/** Routes protégées : nécessitent le plugin d'auth dans le même scope Fastify. */
export function registerProtectedSplitRoutes(fastify: FastifyInstance): void {
  fastify.post(
    "/api/split/start",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      try {
        const body = startBodySchema.parse(request.body);
        if (!requireSelf(request, reply, body.userId)) return reply;
        const result = await startGame(body.userId, body.betAmount, body.clientSeed);
        return reply.code(201).send(result);
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  fastify.post(
    "/api/split/round",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      try {
        const body = roundBodySchema.parse(request.body);
        if (!requireSelf(request, reply, body.userId)) return reply;
        const result = await playRound(body.userId, body.gameId, body.direction);
        return reply.send(result);
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  fastify.post("/api/split/cashout", async (request, reply) => {
    try {
      const body = cashoutBodySchema.parse(request.body);
      if (!requireSelf(request, reply, body.userId)) return reply;
      const result = await cashOut(body.userId, body.gameId);
      return reply.send(result);
    } catch (err) {
      return handleError(reply, err);
    }
  });

  fastify.get("/api/split/session/:userId", async (request, reply) => {
    try {
      const { userId } = userIdParamsSchema.parse(request.params);
      if (!requireSelf(request, reply, userId)) return reply;
      const session = await findActiveSession(prisma, userId);
      if (!session) {
        return reply.code(404).send({ error: "Aucune session active pour cet utilisateur." });
      }
      return reply.send(toPublicView(session));
    } catch (err) {
      return handleError(reply, err);
    }
  });

  fastify.post("/api/split/session/rotate", async (request, reply) => {
    try {
      const body = rotateBodySchema.parse(request.body);
      if (!requireSelf(request, reply, body.userId)) return reply;
      const { revealed, current } = await rotateSession(prisma, body.userId, body.clientSeed);
      return reply.send({
        revealed: revealed
          ? {
              id: revealed.id,
              serverSeed: revealed.serverSeed,
              serverSeedHash: revealed.serverSeedHash,
              clientSeed: revealed.clientSeed,
              revealedAt: revealed.revealedAt,
            }
          : null,
        current: toPublicView(current),
      });
    } catch (err) {
      return handleError(reply, err);
    }
  });
}

/** Routes publiques : aucune authentification requise. */
export function registerPublicSplitRoutes(fastify: FastifyInstance): void {
  fastify.get("/api/split/verify/:sessionId", async (request, reply) => {
    try {
      const { sessionId } = sessionIdParamsSchema.parse(request.params);
      const result = await verifySession(sessionId);
      if (!result) {
        return reply.code(404).send({ error: "Session introuvable." });
      }
      if (result.status === "active") {
        return reply
          .code(409)
          .send({ error: "Cette session est encore active : le serverSeed n'est pas encore révélé." });
      }
      return reply.send(result);
    } catch (err) {
      return handleError(reply, err);
    }
  });
}
