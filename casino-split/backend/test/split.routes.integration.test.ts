/**
 * Tests d'intégration légers sur les endpoints critiques /start, /round et
 * /cashout. Nécessitent Postgres + Redis démarrés (`docker-compose up -d`
 * à la racine de casino-split/) avec DATABASE_URL / REDIS_URL configurés
 * (voir .env.example) et les migrations appliquées (`npm run prisma:migrate`).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { prisma } from "../src/db/prisma";
import { redis } from "../src/db/redis";
import { issueDevToken } from "../src/auth/authPlugin";

const TEST_USERNAME = "vitest_integration_user";

async function cleanupTestUser(): Promise<void> {
  await prisma.gameRound.deleteMany({ where: { gameHistory: { user: { username: TEST_USERNAME } } } });
  await prisma.gameHistory.deleteMany({ where: { user: { username: TEST_USERNAME } } });
  await prisma.seedSession.deleteMany({ where: { user: { username: TEST_USERNAME } } });
  await prisma.user.deleteMany({ where: { username: TEST_USERNAME } });
}

describe("routes Split (intégration)", () => {
  let app: FastifyInstance;
  let userId: string;
  let token: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await cleanupTestUser();
    await app.close();
    await redis.quit();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupTestUser();
    const user = await prisma.user.create({ data: { username: TEST_USERNAME, balance: 1000 } });
    userId = user.id;
    token = issueDevToken(userId);
  });

  it("refuse /start sans authentification", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/split/start",
      payload: { userId, betAmount: 100 },
    });
    expect(response.statusCode).toBe(401);
  });

  it("refuse une mise supérieure au solde disponible", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/split/start",
      headers: { authorization: `Bearer ${token}` },
      payload: { userId, betAmount: 999_999 },
    });
    expect(response.statusCode).toBe(400);
  });

  it("refuse une mise négative dès la validation du schéma", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/split/start",
      headers: { authorization: `Bearer ${token}` },
      payload: { userId, betAmount: -10 },
    });
    expect(response.statusCode).toBe(400);
  });

  it("démarre une partie : débite le solde et crée une game_history active", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/split/start",
      headers: { authorization: `Bearer ${token}` },
      payload: { userId, betAmount: 100 },
    });
    expect(response.statusCode).toBe(201);

    const body = response.json();
    expect(body.balance).toBe(900);
    expect(typeof body.session.serverSeedHash).toBe("string");

    const game = await prisma.gameHistory.findUnique({ where: { id: body.gameId } });
    expect(game?.status).toBe("active");
    expect(game?.betAmount).toBe(100);
  });

  it("refuse de démarrer une deuxième partie pendant qu'une est active", async () => {
    await app.inject({
      method: "POST",
      url: "/api/split/start",
      headers: { authorization: `Bearer ${token}` },
      payload: { userId, betAmount: 100 },
    });
    const second = await app.inject({
      method: "POST",
      url: "/api/split/start",
      headers: { authorization: `Bearer ${token}` },
      payload: { userId, betAmount: 100 },
    });
    expect(second.statusCode).toBe(409);
  });

  it("joue un round et persiste le résultat en base", async () => {
    const start = await app.inject({
      method: "POST",
      url: "/api/split/start",
      headers: { authorization: `Bearer ${token}` },
      payload: { userId, betAmount: 100 },
    });
    const { gameId } = start.json();

    const round = await app.inject({
      method: "POST",
      url: "/api/split/round",
      headers: { authorization: `Bearer ${token}` },
      payload: { userId, gameId, direction: "left" },
    });
    expect(round.statusCode).toBe(200);
    expect(["active", "busted"]).toContain(round.json().status);

    const persisted = await prisma.gameRound.findMany({ where: { gameHistoryId: gameId } });
    expect(persisted).toHaveLength(1);
  });

  it("empêche un double cash-out sur la même partie", async () => {
    const start = await app.inject({
      method: "POST",
      url: "/api/split/start",
      headers: { authorization: `Bearer ${token}` },
      payload: { userId, betAmount: 100 },
    });
    const { gameId } = start.json();

    let status = "active";
    for (let attempts = 0; attempts < 15 && status === "active"; attempts++) {
      const roundResponse = await app.inject({
        method: "POST",
        url: "/api/split/round",
        headers: { authorization: `Bearer ${token}` },
        payload: { userId, gameId, direction: "left" },
      });
      status = roundResponse.json().status;
    }

    const cashoutResponse = await app.inject({
      method: "POST",
      url: "/api/split/cashout",
      headers: { authorization: `Bearer ${token}` },
      payload: { userId, gameId },
    });

    if (status === "busted") {
      // Une partie déjà bustée ne peut plus être cash-out.
      expect(cashoutResponse.statusCode).toBe(409);
      return;
    }

    expect(cashoutResponse.statusCode).toBe(200);

    const secondCashout = await app.inject({
      method: "POST",
      url: "/api/split/cashout",
      headers: { authorization: `Bearer ${token}` },
      payload: { userId, gameId },
    });
    expect(secondCashout.statusCode).toBe(409);
  });

  it("refuse d'agir pour un userId différent de l'utilisateur authentifié", async () => {
    const other = await prisma.user.create({ data: { username: "vitest_other_user", balance: 500 } });
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/split/start",
        headers: { authorization: `Bearer ${token}` },
        payload: { userId: other.id, betAmount: 100 },
      });
      expect(response.statusCode).toBe(403);
    } finally {
      await prisma.user.delete({ where: { id: other.id } });
    }
  });
});
