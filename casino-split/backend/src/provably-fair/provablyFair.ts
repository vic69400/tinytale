/**
 * Moteur provably fair générique.
 *
 * Principe : le serveur génère un `serverSeed` secret et n'en publie que le
 * hash (SHA-256) avant la partie. Le joueur fournit (ou se voit attribuer)
 * un `clientSeed`. Chaque tirage combine serverSeed + clientSeed + nonce +
 * round dans un HMAC-SHA256, ce qui rend le résultat impossible à prédire
 * à l'avance (le serverSeed est secret) et vérifiable après coup une fois
 * le serverSeed révélé (le calcul est déterministe et reproductible).
 */
import { randomBytes, createHmac, createHash } from "node:crypto";

export type Side = "left" | "right";

export interface HmacInput {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  round: number;
}

/** Génère un serverSeed aléatoire cryptographiquement sûr (32 octets, hex). */
export function generateServerSeed(): string {
  return randomBytes(32).toString("hex");
}

/** Génère un clientSeed par défaut si le joueur n'en fournit pas un lui-même. */
export function generateClientSeed(): string {
  return randomBytes(16).toString("hex");
}

/** Hash SHA-256 du serverSeed, publiable avant révélation (engagement cryptographique). */
export function hashServerSeed(serverSeed: string): string {
  return createHash("sha256").update(serverSeed).digest("hex");
}

/** Calcule le HMAC-SHA256 déterministe pour un round donné. */
export function computeHmac({ serverSeed, clientSeed, nonce, round }: HmacInput): string {
  return createHmac("sha256", serverSeed).update(`${clientSeed}:${nonce}:${round}`).digest("hex");
}

/**
 * Dérive le côté "sûr" (gauche/droite) à partir d'un HMAC hexadécimal.
 * On lit le premier octet (2 caractères hex) : pair => gauche, impair => droite.
 * Distribution uniforme car un octet de sortie HMAC-SHA256 est uniformément
 * réparti sur [0, 255].
 */
export function resolveSafeSide(hmacHex: string): Side {
  const firstByte = parseInt(hmacHex.slice(0, 2), 16);
  return firstByte % 2 === 0 ? "left" : "right";
}

/** Calcule en une fois le HMAC et le côté sûr correspondant. */
export function computeSafeSide(input: HmacInput): { hmac: string; safeSide: Side } {
  const hmac = computeHmac(input);
  return { hmac, safeSide: resolveSafeSide(hmac) };
}

/**
 * Vérifie qu'un round est valide en recalculant le HMAC à partir des seeds
 * (une fois le serverSeed révélé) et en comparant au résultat annoncé.
 */
export function verifyRound(
  input: HmacInput,
  expected: { hmac: string; safeSide: Side },
): boolean {
  const { hmac, safeSide } = computeSafeSide(input);
  return hmac === expected.hmac && safeSide === expected.safeSide;
}

/** Vérifie que le serverSeed révélé correspond bien au hash publié avant la partie. */
export function verifyServerSeedHash(serverSeed: string, expectedHash: string): boolean {
  return hashServerSeed(serverSeed) === expectedHash;
}
