/**
 * Service du jeu Split : orchestre le moteur pur (games/split/splitGame.ts,
 * provably-fair/provablyFair.ts) avec la persistance Prisma. Toute mutation
 * de solde ou d'état de partie passe par une transaction Prisma pour éviter
 * les races conditions (double cash-out, double débit, rounds concurrents).
 */
import type { Side } from "../games/split/splitGame";
import { ROUND_MULTIPLIER } from "../games/split/splitGame";
import { computeSafeSide, verifyRound as verifyHmac, hashServerSeed } from "../provably-fair/provablyFair";
import { prisma } from "../db/prisma";
import { getOrCreateActiveSession, findActiveSession, toPublicView } from "./seedSessionService";

export class InsufficientBalanceError extends Error {
  constructor() {
    super("Solde insuffisant pour cette mise.");
    this.name = "InsufficientBalanceError";
  }
}
export class GameAlreadyInProgressError extends Error {
  constructor() {
    super("Une partie est déjà en cours pour cet utilisateur.");
    this.name = "GameAlreadyInProgressError";
  }
}
export class GameNotActiveError extends Error {
  constructor() {
    super("Partie introuvable ou déjà terminée.");
    this.name = "GameNotActiveError";
  }
}
export class NoRoundPlayedError extends Error {
  constructor() {
    super("Impossible de cash-out avant d'avoir joué au moins un round.");
    this.name = "NoRoundPlayedError";
  }
}

/** Démarre une nouvelle partie : vérifie/débite le solde, ouvre une game_history 'active'. */
export async function startGame(userId: string, betAmount: number, clientSeed?: string) {
  if (!Number.isInteger(betAmount) || betAmount <= 0) {
    throw new RangeError("Le montant de la mise doit être un entier positif.");
  }

  return prisma.$transaction(async (tx) => {
    const activeGame = await tx.gameHistory.findFirst({ where: { userId, status: "active" } });
    if (activeGame) throw new GameAlreadyInProgressError();

    // Débit atomique et conditionnel : évite toute race condition de double débit.
    const debited = await tx.user.updateMany({
      where: { id: userId, balance: { gte: betAmount } },
      data: { balance: { decrement: betAmount } },
    });
    if (debited.count === 0) throw new InsufficientBalanceError();

    const seedSession = await getOrCreateActiveSession(tx, userId, clientSeed);

    const game = await tx.gameHistory.create({
      data: {
        userId,
        gameType: "split",
        betAmount,
        payout: 0,
        multiplierFinal: 1,
        status: "active",
        seedSessionId: seedSession.id,
      },
    });

    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    return {
      gameId: game.id,
      betAmount: game.betAmount,
      balance: user.balance,
      session: toPublicView(seedSession),
    };
  });
}

/** Joue un round : compare le côté choisi au côté sûr dérivé du HMAC, persiste le résultat. */
export async function playRound(userId: string, gameId: string, direction: Side) {
  return prisma.$transaction(async (tx) => {
    const game = await tx.gameHistory.findFirst({ where: { id: gameId, userId } });
    if (!game || game.status !== "active") throw new GameNotActiveError();

    const seedSession = await tx.seedSession.findUniqueOrThrow({ where: { id: game.seedSessionId } });

    const roundsPlayed = await tx.gameRound.count({ where: { gameHistoryId: game.id } });
    const roundNumber = roundsPlayed + 1;

    // Le nonce est incrémenté à chaque round, y compris entre plusieurs parties de la même session.
    const updatedSeedSession = await tx.seedSession.update({
      where: { id: seedSession.id },
      data: { nonce: { increment: 1 } },
    });

    const { hmac, safeSide } = computeSafeSide({
      serverSeed: updatedSeedSession.serverSeed,
      clientSeed: updatedSeedSession.clientSeed,
      nonce: updatedSeedSession.nonce,
      round: roundNumber,
    });
    const survived = direction === safeSide;
    const previousMultiplier = roundsPlayed > 0 ? game.multiplierFinal : 1;
    const cumulativeMultiplier = survived ? previousMultiplier * ROUND_MULTIPLIER : previousMultiplier;

    await tx.gameRound.create({
      data: {
        sessionId: seedSession.id,
        gameHistoryId: game.id,
        gameType: "split",
        betAmount: game.betAmount,
        roundNumber,
        nonce: updatedSeedSession.nonce,
        chosenSide: direction,
        safeSide,
        survived,
        hmac,
      },
    });

    const updatedGame = await tx.gameHistory.update({
      where: { id: game.id },
      data: {
        multiplierFinal: cumulativeMultiplier,
        status: survived ? "active" : "busted",
        closedAt: survived ? null : new Date(),
      },
    });

    return {
      round: roundNumber,
      chosenSide: direction,
      survived,
      // Le côté sûr n'est révélé au joueur qu'en cas de bust : sur un round
      // gagné, il n'apporte aucune information exploitable (le HMAC reste
      // secret) mais on le garde en réserve pour ne pas gâcher le suspense.
      safeSide: survived ? null : safeSide,
      cumulativeMultiplier,
      status: updatedGame.status,
    };
  });
}

/** Cash-out volontaire : crédite le solde et clôture la partie. */
export async function cashOut(userId: string, gameId: string) {
  return prisma.$transaction(async (tx) => {
    const game = await tx.gameHistory.findFirst({ where: { id: gameId, userId } });
    if (!game || game.status !== "active") throw new GameNotActiveError();

    const roundsPlayed = await tx.gameRound.count({ where: { gameHistoryId: game.id } });
    if (roundsPlayed === 0) throw new NoRoundPlayedError();

    const payout = Math.floor(game.betAmount * game.multiplierFinal);

    await tx.user.update({ where: { id: userId }, data: { balance: { increment: payout } } });

    const updatedGame = await tx.gameHistory.update({
      where: { id: game.id },
      data: { status: "cashed_out", payout, closedAt: new Date() },
    });

    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    return { payout, balance: user.balance, multiplierFinal: updatedGame.multiplierFinal };
  });
}

export type VerifySessionResult =
  | { status: "active" }
  | {
      status: "revealed";
      serverSeed: string;
      serverSeedHash: string;
      serverSeedHashValid: boolean;
      clientSeed: string;
      revealedAt: Date | null;
      allValid: boolean;
      rounds: Array<{
        roundNumber: number;
        nonce: number;
        chosenSide: string;
        safeSide: string;
        survived: boolean;
        hmac: string;
        valid: boolean;
      }>;
    };

/**
 * Vérification indépendante d'une session révélée : recalcule chaque round
 * à partir des seeds en clair et confirme que tout correspond aux données
 * publiées au moment du jeu.
 */
export async function verifySession(sessionId: string): Promise<VerifySessionResult | null> {
  const session = await prisma.seedSession.findUnique({ where: { id: sessionId } });
  if (!session) return null;
  if (session.isActive) return { status: "active" };

  const rounds = await prisma.gameRound.findMany({
    where: { sessionId: session.id },
    orderBy: { nonce: "asc" },
  });

  const serverSeedHashValid = hashServerSeed(session.serverSeed) === session.serverSeedHash;

  const roundChecks = rounds.map((round) => {
    const valid = verifyHmac(
      {
        serverSeed: session.serverSeed,
        clientSeed: session.clientSeed,
        nonce: round.nonce,
        round: round.roundNumber,
      },
      { hmac: round.hmac, safeSide: round.safeSide as Side },
    );
    return {
      roundNumber: round.roundNumber,
      nonce: round.nonce,
      chosenSide: round.chosenSide,
      safeSide: round.safeSide,
      survived: round.survived,
      hmac: round.hmac,
      valid,
    };
  });

  return {
    status: "revealed",
    serverSeed: session.serverSeed,
    serverSeedHash: session.serverSeedHash,
    serverSeedHashValid,
    clientSeed: session.clientSeed,
    revealedAt: session.revealedAt,
    allValid: serverSeedHashValid && roundChecks.every((r) => r.valid),
    rounds: roundChecks,
  };
}
