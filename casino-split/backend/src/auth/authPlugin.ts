/**
 * Stub d'authentification JWT pour le développement local.
 *
 * En production, remplacer la vérification par le système d'auth réel de
 * l'opérateur casino (SSO, session cookie, OAuth...) : il suffit de
 * continuer à peupler `request.userId` avant que les routes ne s'exécutent
 * pour que le reste de l'API fonctionne sans changement.
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-secret-change-me";

export interface AuthTokenPayload {
  sub: string; // userId
}

/** Génère un token de dev pour un userId donné (voir scripts/issue-dev-token.ts). */
export function issueDevToken(userId: string): string {
  return jwt.sign({ sub: userId } satisfies AuthTokenPayload, JWT_SECRET, { expiresIn: "12h" });
}

async function verifyAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    await reply.code(401).send({ error: "Authentification requise (en-tête Authorization: Bearer <token> manquant)." });
    return;
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
    request.userId = payload.sub;
  } catch {
    await reply.code(401).send({ error: "Token invalide ou expiré." });
  }
}

/** Plugin Fastify : à enregistrer uniquement dans le scope des routes protégées. */
export const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("userId", undefined);
  fastify.addHook("preHandler", verifyAuth);
};
