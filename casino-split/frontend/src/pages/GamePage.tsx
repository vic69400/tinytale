import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { LoginForm } from "../components/LoginForm";
import { ApiError, cashOut, playRound, startGame } from "../api/client";
import type { PlayRoundResponse, PublicSeedSession, Side } from "../types";

interface ActiveGame {
  gameId: string;
  status: "active" | "busted" | "cashed_out";
  betAmount: number;
  cumulativeMultiplier: number;
  rounds: PlayRoundResponse[];
  finalPayout: number | null;
}

export function GamePage() {
  const { auth, setBalance } = useAuth();
  const [betInput, setBetInput] = useState("100");
  const [game, setGame] = useState<ActiveGame | null>(null);
  const [session, setSession] = useState<PublicSeedSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<"survived" | "busted" | null>(null);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 700);
    return () => clearTimeout(timer);
  }, [flash]);

  if (!auth) {
    return <LoginForm />;
  }

  const isGameActive = game?.status === "active";

  async function handleStart() {
    if (!auth) return;
    const betAmount = Number(betInput);
    if (!Number.isInteger(betAmount) || betAmount <= 0) {
      setError("Le montant de la mise doit être un entier positif.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await startGame(auth.token, auth.userId, betAmount);
      setBalance(response.balance);
      setSession(response.session);
      setGame({
        gameId: response.gameId,
        status: "active",
        betAmount: response.betAmount,
        cumulativeMultiplier: 1,
        rounds: [],
        finalPayout: null,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors du démarrage de la partie.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePlay(direction: Side) {
    if (!auth || !game) return;
    setBusy(true);
    setError(null);
    try {
      const result = await playRound(auth.token, auth.userId, game.gameId, direction);
      setGame((prev) =>
        prev
          ? {
              ...prev,
              status: result.status,
              cumulativeMultiplier: result.cumulativeMultiplier,
              rounds: [...prev.rounds, result],
            }
          : prev,
      );
      setSession((prev) => (prev ? { ...prev, nonce: prev.nonce + 1 } : prev));
      setFlash(result.survived ? "survived" : "busted");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors du round.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCashOut() {
    if (!auth || !game) return;
    setBusy(true);
    setError(null);
    try {
      const result = await cashOut(auth.token, auth.userId, game.gameId);
      setBalance(result.balance);
      setGame((prev) => (prev ? { ...prev, status: "cashed_out", finalPayout: result.payout } : prev));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors du cash-out.");
    } finally {
      setBusy(false);
    }
  }

  function handleNewGame() {
    setGame(null);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-felt-800 bg-felt-900 p-5">
        <p className="text-sm text-slate-400">Solde simulé</p>
        <p className="text-3xl font-bold text-gold-400">{auth.balance.toLocaleString("fr-FR")} crédits</p>
      </section>

      {!game || game.status !== "active" ? (
        <section className="rounded-2xl border border-felt-800 bg-felt-900 p-5">
          <label className="mb-2 block text-sm text-slate-400" htmlFor="bet">
            Montant de la mise
          </label>
          <div className="flex gap-2">
            <input
              id="bet"
              type="number"
              min={1}
              step={1}
              value={betInput}
              onChange={(e) => setBetInput(e.target.value)}
              className="flex-1 rounded-lg border border-felt-800 bg-felt-950 px-3 py-2 text-slate-100 outline-none focus:border-gold-500"
            />
            <button
              onClick={handleStart}
              disabled={busy}
              className="rounded-lg bg-gold-500 px-5 py-2 font-semibold text-felt-950 transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Démarrer la partie
            </button>
          </div>
          {game?.status === "busted" && (
            <p className="mt-3 text-sm text-red-400">
              Bust ! Mise de {game.betAmount} perdue. Le côté sûr était :{" "}
              <span className="font-semibold">
                {game.rounds.at(-1)?.safeSide === "left" ? "gauche" : "droite"}
              </span>
              .
            </p>
          )}
          {game?.status === "cashed_out" && (
            <p className="mt-3 text-sm text-emerald-400">
              Cash-out réussi ! Gain : {game.finalPayout} crédits (x{game.cumulativeMultiplier.toFixed(2)}).
            </p>
          )}
          {game && game.status !== "active" && (
            <button
              onClick={handleNewGame}
              className="mt-3 text-sm text-slate-400 underline underline-offset-2 hover:text-slate-200"
            >
              Nouvelle partie
            </button>
          )}
        </section>
      ) : (
        <section
          className={`rounded-2xl border p-5 transition-colors duration-500 ${
            flash === "survived"
              ? "border-emerald-500 bg-emerald-950/40"
              : flash === "busted"
                ? "border-red-500 bg-red-950/40"
                : "border-felt-800 bg-felt-900"
          }`}
        >
          <div className="mb-4 flex items-baseline justify-between">
            <span className="text-sm text-slate-400">Multiplicateur cumulé</span>
            <span className="text-3xl font-bold text-gold-400">
              x{game.cumulativeMultiplier.toFixed(2)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handlePlay("left")}
              disabled={busy || !isGameActive}
              className="rounded-xl bg-felt-800 py-6 text-xl font-bold text-slate-100 transition hover:bg-felt-800/70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ← GAUCHE
            </button>
            <button
              onClick={() => handlePlay("right")}
              disabled={busy || !isGameActive}
              className="rounded-xl bg-felt-800 py-6 text-xl font-bold text-slate-100 transition hover:bg-felt-800/70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              DROITE →
            </button>
          </div>

          <button
            onClick={handleCashOut}
            disabled={busy || game.rounds.length === 0}
            className="mt-4 w-full rounded-xl bg-gold-500 py-3 font-semibold text-felt-950 transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cash-out
          </button>
        </section>
      )}

      {error && (
        <p className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-2 text-sm text-red-400">{error}</p>
      )}

      {game && game.rounds.length > 0 && (
        <section className="rounded-2xl border border-felt-800 bg-felt-900 p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-400">Historique de la partie en cours</h2>
          <ul className="flex flex-col gap-2">
            {[...game.rounds].reverse().map((r) => (
              <li
                key={r.round}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                  r.survived ? "bg-emerald-950/40 text-emerald-300" : "bg-red-950/40 text-red-300"
                }`}
              >
                <span>Round {r.round}</span>
                <span>Choisi : {r.chosenSide === "left" ? "gauche" : "droite"}</span>
                <span>{r.survived ? "Survécu ✓" : `Busté — sûr : ${r.safeSide === "left" ? "gauche" : "droite"}`}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {session && (
        <section className="rounded-2xl border border-felt-800 bg-felt-900 p-5 text-xs text-slate-500">
          <p>Session : {session.id}</p>
          <p className="break-all">Hash du serverSeed : {session.serverSeedHash}</p>
          <p>Client seed : {session.clientSeed}</p>
          <p>Nonce : {session.nonce}</p>
        </section>
      )}
    </div>
  );
}
