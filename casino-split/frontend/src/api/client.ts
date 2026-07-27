/** Client API du backend Split. */
import type {
  CashOutResponse,
  DevLoginResponse,
  PlayRoundResponse,
  PublicSeedSession,
  Side,
  StartGameResponse,
  VerifySessionResponse,
} from "../types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiError(response.status, body.error ?? "Erreur inconnue.");
  }

  return response.json() as Promise<T>;
}

/** Connexion de développement : associe/crée un utilisateur par username et renvoie un token. */
export function devLogin(username: string): Promise<DevLoginResponse> {
  return request<DevLoginResponse>("/api/dev/login", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

export function startGame(token: string, userId: string, betAmount: number): Promise<StartGameResponse> {
  return request<StartGameResponse>("/api/split/start", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ userId, betAmount }),
  });
}

export function playRound(
  token: string,
  userId: string,
  gameId: string,
  direction: Side,
): Promise<PlayRoundResponse> {
  return request<PlayRoundResponse>("/api/split/round", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ userId, gameId, direction }),
  });
}

export function cashOut(token: string, userId: string, gameId: string): Promise<CashOutResponse> {
  return request<CashOutResponse>("/api/split/cashout", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ userId, gameId }),
  });
}

export function getSession(token: string, userId: string): Promise<PublicSeedSession> {
  return request<PublicSeedSession>(`/api/split/session/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function rotateSession(
  token: string,
  userId: string,
): Promise<{ revealed: (PublicSeedSession & { serverSeed: string }) | null; current: PublicSeedSession }> {
  return request("/api/split/session/rotate", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ userId }),
  });
}

/** Vérification publique — aucune authentification requise. */
export function verifySession(sessionId: string): Promise<VerifySessionResponse> {
  return request<VerifySessionResponse>(`/api/split/verify/${sessionId}`);
}
