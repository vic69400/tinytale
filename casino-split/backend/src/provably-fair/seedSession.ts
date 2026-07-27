/**
 * Gestion de session de seeds par joueur.
 *
 * Une session de seed regroupe un couple (serverSeed, clientSeed) et un
 * compteur `nonce` incrémenté à chaque round joué, quel que soit le nombre
 * de parties enchaînées sous cette même session. Le serverSeed n'est
 * jamais exposé tant que la session est active ; seule sa hash publique
 * (`serverSeedHash`) est communiquée au joueur.
 *
 * Cette classe est la logique métier pure (in-memory). La persistance en
 * base (table `seed_sessions`) et le cache Redis des sessions actives sont
 * gérés par la couche service de l'API (voir src/services/seedSessionService.ts).
 */
import { randomUUID } from "node:crypto";
import { generateServerSeed, generateClientSeed, hashServerSeed } from "./provablyFair";

export interface SeedSession {
  id: string;
  userId: string;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  isActive: boolean;
  revealedAt: Date | null;
  createdAt: Date;
}

/** Vue publique d'une session : ne contient jamais le serverSeed en clair tant qu'active. */
export interface PublicSeedSession {
  id: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  isActive: boolean;
}

/** Crée une nouvelle session de seed pour un joueur. */
export function createSeedSession(userId: string, clientSeed?: string): SeedSession {
  const serverSeed = generateServerSeed();
  return {
    id: randomUUID(),
    userId,
    serverSeed,
    serverSeedHash: hashServerSeed(serverSeed),
    clientSeed: clientSeed ?? generateClientSeed(),
    nonce: 0,
    isActive: true,
    revealedAt: null,
    createdAt: new Date(),
  };
}

/** Incrémente le nonce de la session (appelé à chaque round joué). */
export function incrementNonce(session: SeedSession): SeedSession {
  if (!session.isActive) {
    throw new Error("Impossible d'incrémenter le nonce d'une session révélée.");
  }
  return { ...session, nonce: session.nonce + 1 };
}

/** Change le clientSeed d'une session active (le joueur peut le personnaliser). */
export function setClientSeed(session: SeedSession, clientSeed: string): SeedSession {
  if (!session.isActive) {
    throw new Error("Impossible de modifier le clientSeed d'une session révélée.");
  }
  return { ...session, clientSeed };
}

/** Révèle le serverSeed et clôture la session (rotation). */
export function revealSeedSession(session: SeedSession): SeedSession {
  return { ...session, isActive: false, revealedAt: new Date() };
}

/** Vue publique de la session : jamais le serverSeed en clair tant qu'active. */
export function toPublicView(session: SeedSession): PublicSeedSession {
  return {
    id: session.id,
    serverSeedHash: session.serverSeedHash,
    clientSeed: session.clientSeed,
    nonce: session.nonce,
    isActive: session.isActive,
  };
}

/**
 * Store in-memory de référence, utilisé par la démo CLI et les tests.
 * L'API de production utilise Prisma + Redis (voir services/seedSessionService.ts).
 */
export class InMemorySeedSessionStore {
  private sessions = new Map<string, SeedSession>();

  getActiveForUser(userId: string): SeedSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.isActive) return session;
    }
    return undefined;
  }

  save(session: SeedSession): void {
    this.sessions.set(session.id, session);
  }

  get(id: string): SeedSession | undefined {
    return this.sessions.get(id);
  }
}
