export type Side = "left" | "right";
export type GameStatus = "active" | "busted" | "cashed_out";

export interface PublicSeedSession {
  id: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  isActive: boolean;
}

export interface RevealedSeedSession {
  id: string;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  revealedAt: string | null;
}

export interface StartGameResponse {
  gameId: string;
  betAmount: number;
  balance: number;
  session: PublicSeedSession;
}

export interface PlayRoundResponse {
  round: number;
  chosenSide: Side;
  survived: boolean;
  safeSide: Side | null;
  cumulativeMultiplier: number;
  status: GameStatus;
}

export interface CashOutResponse {
  payout: number;
  balance: number;
  multiplierFinal: number;
}

export interface RoundHistoryEntry extends PlayRoundResponse {}

export interface VerifyRoundEntry {
  roundNumber: number;
  nonce: number;
  chosenSide: Side;
  safeSide: Side;
  survived: boolean;
  hmac: string;
  valid: boolean;
}

export type VerifySessionResponse =
  | { status: "active" }
  | {
      status: "revealed";
      serverSeed: string;
      serverSeedHash: string;
      serverSeedHashValid: boolean;
      clientSeed: string;
      revealedAt: string | null;
      allValid: boolean;
      rounds: VerifyRoundEntry[];
    };

export interface DevLoginResponse {
  userId: string;
  username: string;
  balance: number;
  token: string;
}
