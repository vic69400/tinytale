/**
 * Service de session de seeds : persistance Prisma + cache Redis, au-dessus
 * de la logique métier pure de provably-fair (génération/hash des seeds).
 */
import type { Prisma, PrismaClient, SeedSession as SeedSessionRow } from "@prisma/client";
import { generateServerSeed, generateClientSeed, hashServerSeed } from "../provably-fair/provablyFair";
import { cacheActiveSeedSessionId, clearCachedActiveSeedSessionId } from "../db/redis";

type Db = Prisma.TransactionClient | PrismaClient;

export interface PublicSeedSessionView {
  id: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  isActive: boolean;
}

export class SessionRotationBlockedError extends Error {
  constructor() {
    super("Impossible de faire tourner le seed pendant qu'une partie est en cours.");
    this.name = "SessionRotationBlockedError";
  }
}

/** Vue publique d'une session : ne contient jamais le serverSeed tant qu'active. */
export function toPublicView(session: SeedSessionRow): PublicSeedSessionView {
  return {
    id: session.id,
    serverSeedHash: session.serverSeedHash,
    clientSeed: session.clientSeed,
    nonce: session.nonce,
    isActive: session.isActive,
  };
}

/** Récupère la session de seed active du joueur, ou null s'il n'en a pas. */
export async function findActiveSession(db: Db, userId: string): Promise<SeedSessionRow | null> {
  return db.seedSession.findFirst({
    where: { userId, isActive: true },
    orderBy: { createdAt: "desc" },
  });
}

/** Récupère la session active, ou en crée une nouvelle si aucune n'existe. */
export async function getOrCreateActiveSession(
  db: Db,
  userId: string,
  clientSeed?: string,
): Promise<SeedSessionRow> {
  const existing = await findActiveSession(db, userId);
  if (existing) return existing;

  const serverSeed = generateServerSeed();
  const created = await db.seedSession.create({
    data: {
      userId,
      serverSeed,
      serverSeedHash: hashServerSeed(serverSeed),
      clientSeed: clientSeed ?? generateClientSeed(),
      nonce: 0,
      isActive: true,
    },
  });
  await cacheActiveSeedSessionId(userId, created.id);
  return created;
}

/**
 * Révèle la session active (s'il y en a une) et en crée immédiatement une
 * nouvelle. Refuse la rotation si une partie est en cours, car le flow HMAC
 * d'une partie doit rester rattaché à une session unique jusqu'à sa fin.
 */
export async function rotateSession(
  db: Db,
  userId: string,
  clientSeed?: string,
): Promise<{ revealed: SeedSessionRow | null; current: SeedSessionRow }> {
  const activeGame = await db.gameHistory.findFirst({ where: { userId, status: "active" } });
  if (activeGame) {
    throw new SessionRotationBlockedError();
  }

  const existing = await findActiveSession(db, userId);
  let revealed: SeedSessionRow | null = null;
  if (existing) {
    revealed = await db.seedSession.update({
      where: { id: existing.id },
      data: { isActive: false, revealedAt: new Date() },
    });
  }

  const serverSeed = generateServerSeed();
  const current = await db.seedSession.create({
    data: {
      userId,
      serverSeed,
      serverSeedHash: hashServerSeed(serverSeed),
      clientSeed: clientSeed ?? generateClientSeed(),
      nonce: 0,
      isActive: true,
    },
  });

  await clearCachedActiveSeedSessionId(userId);
  await cacheActiveSeedSessionId(userId, current.id);

  return { revealed, current };
}
