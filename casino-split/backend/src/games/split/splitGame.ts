/**
 * Moteur du jeu Split : choix binaire en cascade.
 *
 * À chaque round, le joueur choisit un côté (gauche/droite). Un seul côté
 * est "sûr", déterminé par le moteur provably fair. Bon choix => le
 * multiplicateur cumulé est multiplié par ROUND_MULTIPLIER et la partie
 * continue ; mauvais choix => la mise est perdue et la partie se termine.
 * Le joueur peut cash-out à tout moment tant que la partie est active et
 * qu'au moins un round a été joué.
 */
import { computeSafeSide, verifyRound as verifyRoundHmac, type HmacInput, type Side } from "../../provably-fair/provablyFair";

/** House edge de 3 % : un côté sur deux gagne, donc le multiplicateur "juste" serait x2. */
export const HOUSE_EDGE = 0.03;
export const FAIR_MULTIPLIER = 2;
export const ROUND_MULTIPLIER = FAIR_MULTIPLIER * (1 - HOUSE_EDGE); // 1.94

export type GameStatus = "active" | "busted" | "cashed_out";

export interface RoundResult {
  round: number;
  nonce: number;
  chosenSide: Side;
  safeSide: Side;
  survived: boolean;
  hmac: string;
  cumulativeMultiplier: number;
}

export interface SplitGameState {
  betAmount: number;
  status: GameStatus;
  currentRound: number;
  cumulativeMultiplier: number;
  rounds: RoundResult[];
}

export interface SeedInput {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
}

/** Démarre une nouvelle partie avec une mise donnée. */
export function startGame(betAmount: number): SplitGameState {
  if (!Number.isFinite(betAmount) || betAmount <= 0) {
    throw new Error("Le montant de la mise doit être un nombre positif.");
  }
  return {
    betAmount,
    status: "active",
    currentRound: 0,
    cumulativeMultiplier: 1,
    rounds: [],
  };
}

/** Joue un round : le côté choisi est comparé au côté sûr dérivé du HMAC. */
export function playRound(
  state: SplitGameState,
  direction: Side,
  seedInput: SeedInput,
): { state: SplitGameState; result: RoundResult } {
  if (state.status !== "active") {
    throw new Error("La partie est déjà terminée.");
  }

  const round = state.currentRound + 1;
  const hmacInput: HmacInput = { ...seedInput, round };
  const { hmac, safeSide } = computeSafeSide(hmacInput);
  const survived = direction === safeSide;
  const cumulativeMultiplier = survived
    ? state.cumulativeMultiplier * ROUND_MULTIPLIER
    : state.cumulativeMultiplier;

  const result: RoundResult = {
    round,
    nonce: seedInput.nonce,
    chosenSide: direction,
    safeSide,
    survived,
    hmac,
    cumulativeMultiplier,
  };

  const newState: SplitGameState = {
    ...state,
    currentRound: round,
    cumulativeMultiplier,
    status: survived ? "active" : "busted",
    rounds: [...state.rounds, result],
  };

  return { state: newState, result };
}

/** Cash-out volontaire : clôture la partie et calcule le gain. */
export function cashOut(state: SplitGameState): { state: SplitGameState; payout: number } {
  if (state.status !== "active") {
    throw new Error("Impossible de cash-out : la partie n'est pas active.");
  }
  if (state.currentRound === 0) {
    throw new Error("Impossible de cash-out avant d'avoir joué au moins un round.");
  }
  const payout = Math.floor(state.betAmount * state.cumulativeMultiplier);
  return { state: { ...state, status: "cashed_out" }, payout };
}

/** Recalcule et vérifie un round à partir des seeds révélés. */
export function verifyGameRound(
  round: RoundResult,
  seeds: { serverSeed: string; clientSeed: string },
): boolean {
  return verifyRoundHmac(
    { serverSeed: seeds.serverSeed, clientSeed: seeds.clientSeed, nonce: round.nonce, round: round.round },
    { hmac: round.hmac, safeSide: round.safeSide },
  );
}
