import { describe, it, expect } from "vitest";
import {
  generateServerSeed,
  generateClientSeed,
  hashServerSeed,
  computeSafeSide,
  verifyRound,
  verifyServerSeedHash,
} from "../src/provably-fair/provablyFair";

describe("provablyFair", () => {
  it("mêmes seeds + nonce + round => même résultat (déterminisme du RNG)", () => {
    const input = { serverSeed: "seed-a", clientSeed: "client-a", nonce: 1, round: 1 };
    const first = computeSafeSide(input);
    const second = computeSafeSide(input);
    expect(first.hmac).toBe(second.hmac);
    expect(first.safeSide).toBe(second.safeSide);
  });

  it("un nonce ou un round différent change le résultat (avec très forte probabilité)", () => {
    const base = { serverSeed: "seed-a", clientSeed: "client-a", nonce: 1, round: 1 };
    const otherNonce = computeSafeSide({ ...base, nonce: 2 });
    const otherRound = computeSafeSide({ ...base, round: 2 });
    const original = computeSafeSide(base);
    expect(otherNonce.hmac).not.toBe(original.hmac);
    expect(otherRound.hmac).not.toBe(original.hmac);
  });

  it("le hash du serverSeed est stable et vérifiable après révélation", () => {
    const serverSeed = generateServerSeed();
    const hash = hashServerSeed(serverSeed);
    expect(verifyServerSeedHash(serverSeed, hash)).toBe(true);
    expect(verifyServerSeedHash("un-autre-seed", hash)).toBe(false);
  });

  it("distribution ~50/50 sur un grand nombre de tirages", () => {
    const serverSeed = generateServerSeed();
    const clientSeed = generateClientSeed();
    const N = 20_000;
    let leftCount = 0;
    for (let nonce = 0; nonce < N; nonce++) {
      const { safeSide } = computeSafeSide({ serverSeed, clientSeed, nonce, round: 1 });
      if (safeSide === "left") leftCount++;
    }
    const ratio = leftCount / N;
    expect(ratio).toBeGreaterThan(0.47);
    expect(ratio).toBeLessThan(0.53);
  });

  it("verifyRound échoue si le hmac, le safeSide ou les seeds sont altérés", () => {
    const input = { serverSeed: "seed-b", clientSeed: "client-b", nonce: 5, round: 2 };
    const { hmac, safeSide } = computeSafeSide(input);

    expect(verifyRound(input, { hmac, safeSide })).toBe(true);

    const tamperedHmac = (hmac[0] === "a" ? "b" : "a") + hmac.slice(1);
    expect(verifyRound(input, { hmac: tamperedHmac, safeSide })).toBe(false);

    const oppositeSide = safeSide === "left" ? "right" : "left";
    expect(verifyRound(input, { hmac, safeSide: oppositeSide })).toBe(false);

    expect(verifyRound({ ...input, round: input.round + 1 }, { hmac, safeSide })).toBe(false);
    expect(verifyRound({ ...input, serverSeed: "seed-altere" }, { hmac, safeSide })).toBe(false);
  });
});
