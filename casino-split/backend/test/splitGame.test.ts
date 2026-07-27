import { describe, it, expect } from "vitest";
import { startGame, playRound, cashOut, verifyGameRound, ROUND_MULTIPLIER } from "../src/games/split/splitGame";
import { computeSafeSide } from "../src/provably-fair/provablyFair";

describe("splitGame", () => {
  it("startGame refuse une mise nulle ou négative", () => {
    expect(() => startGame(0)).toThrow();
    expect(() => startGame(-10)).toThrow();
  });

  it("calcule correctement le multiplicateur cumulé sur plusieurs rounds gagnés", () => {
    const serverSeed = "fixed-server-seed";
    const clientSeed = "fixed-client-seed";
    let game = startGame(100);

    for (let round = 1; round <= 4; round++) {
      const nonce = round;
      const { safeSide } = computeSafeSide({ serverSeed, clientSeed, nonce, round });
      const { state, result } = playRound(game, safeSide, { serverSeed, clientSeed, nonce });
      expect(result.survived).toBe(true);
      game = state;
    }

    expect(game.status).toBe("active");
    expect(game.cumulativeMultiplier).toBeCloseTo(ROUND_MULTIPLIER ** 4, 10);
  });

  it("un mauvais choix termine la partie (bust) et le multiplicateur ne bouge plus", () => {
    const serverSeed = "bust-server-seed";
    const clientSeed = "bust-client-seed";
    const game = startGame(50);
    const nonce = 1;
    const round = 1;
    const { safeSide } = computeSafeSide({ serverSeed, clientSeed, nonce, round });
    const wrongSide = safeSide === "left" ? "right" : "left";

    const { state, result } = playRound(game, wrongSide, { serverSeed, clientSeed, nonce });

    expect(result.survived).toBe(false);
    expect(state.status).toBe("busted");
    expect(state.cumulativeMultiplier).toBe(1);
    expect(() => cashOut(state)).toThrow();
    expect(() => playRound(state, "left", { serverSeed, clientSeed, nonce: nonce + 1 })).toThrow();
  });

  it("cashOut calcule le payout = mise * multiplicateur cumulé, arrondi à l'entier inférieur", () => {
    const serverSeed = "cashout-seed";
    const clientSeed = "cashout-client";
    const game = startGame(100);
    const { safeSide } = computeSafeSide({ serverSeed, clientSeed, nonce: 1, round: 1 });
    const played = playRound(game, safeSide, { serverSeed, clientSeed, nonce: 1 });

    const { payout } = cashOut(played.state);
    expect(payout).toBe(Math.floor(100 * ROUND_MULTIPLIER));
  });

  it("cashOut refuse un cash-out avant le premier round", () => {
    const game = startGame(100);
    expect(() => cashOut(game)).toThrow();
  });

  it("verifyGameRound échoue si les seeds révélés ne correspondent pas au round joué", () => {
    const serverSeed = "verify-seed";
    const clientSeed = "verify-client";
    const game = startGame(100);
    const { safeSide } = computeSafeSide({ serverSeed, clientSeed, nonce: 1, round: 1 });
    const { result } = playRound(game, safeSide, { serverSeed, clientSeed, nonce: 1 });

    expect(verifyGameRound(result, { serverSeed, clientSeed })).toBe(true);
    expect(verifyGameRound(result, { serverSeed: "seed-altere", clientSeed })).toBe(false);
    expect(verifyGameRound(result, { serverSeed, clientSeed: "client-altere" })).toBe(false);
  });
});
