import { useState, type FormEvent } from "react";
import { ApiError, verifySession } from "../api/client";
import type { VerifySessionResponse } from "../types";

export function VerifyPage() {
  const [sessionId, setSessionId] = useState("");
  const [result, setResult] = useState<VerifySessionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!sessionId.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await verifySession(sessionId.trim());
      setResult(response);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de la vérification.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-felt-800 bg-felt-900 p-5">
        <h1 className="mb-1 text-xl font-bold text-gold-400">Vérifier l'équité</h1>
        <p className="mb-4 text-sm text-slate-400">
          Entrez l'identifiant d'une session de seed révélée pour recalculer indépendamment chaque
          round à partir des seeds publiés et confirmer qu'aucune manipulation n'a eu lieu.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="ID de session (UUID)"
            className="flex-1 rounded-lg border border-felt-800 bg-felt-950 px-3 py-2 text-slate-100 outline-none focus:border-gold-500"
          />
          <button
            type="submit"
            disabled={loading || !sessionId.trim()}
            className="rounded-lg bg-gold-500 px-5 py-2 font-semibold text-felt-950 transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Vérification…" : "Vérifier"}
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </section>

      {result?.status === "active" && (
        <section className="rounded-2xl border border-amber-800 bg-amber-950/30 p-5 text-sm text-amber-300">
          Cette session est encore active : le serverSeed n'est pas encore révélé. Revenez après
          rotation du seed ou fin de partie.
        </section>
      )}

      {result?.status === "revealed" && (
        <>
          <section
            className={`rounded-2xl border p-5 ${
              result.allValid ? "border-emerald-700 bg-emerald-950/30" : "border-red-700 bg-red-950/30"
            }`}
          >
            <p className={`text-lg font-bold ${result.allValid ? "text-emerald-400" : "text-red-400"}`}>
              {result.allValid ? "✓ Session vérifiée : tous les rounds sont valides." : "✗ Anomalie détectée."}
            </p>
          </section>

          <section className="rounded-2xl border border-felt-800 bg-felt-900 p-5 text-sm">
            <h2 className="mb-3 font-semibold text-slate-300">Seeds révélés</h2>
            <dl className="grid grid-cols-1 gap-2 break-all text-slate-400 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">serverSeed</dt>
                <dd>{result.serverSeed}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">serverSeedHash</dt>
                <dd>
                  {result.serverSeedHash}{" "}
                  <span className={result.serverSeedHashValid ? "text-emerald-400" : "text-red-400"}>
                    ({result.serverSeedHashValid ? "correspond" : "ne correspond pas"})
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">clientSeed</dt>
                <dd>{result.clientSeed}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Révélé le</dt>
                <dd>{result.revealedAt ? new Date(result.revealedAt).toLocaleString("fr-FR") : "—"}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-felt-800 bg-felt-900 p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-300">Détail des rounds</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-xs text-slate-400">
                <thead>
                  <tr className="border-b border-felt-800 text-slate-500">
                    <th className="py-2 pr-3">Round</th>
                    <th className="py-2 pr-3">Nonce</th>
                    <th className="py-2 pr-3">Choisi</th>
                    <th className="py-2 pr-3">Sûr</th>
                    <th className="py-2 pr-3">Survécu</th>
                    <th className="py-2 pr-3">HMAC</th>
                    <th className="py-2">Valide</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rounds.map((r) => (
                    <tr key={r.roundNumber} className="border-b border-felt-800/50">
                      <td className="py-2 pr-3">{r.roundNumber}</td>
                      <td className="py-2 pr-3">{r.nonce}</td>
                      <td className="py-2 pr-3">{r.chosenSide}</td>
                      <td className="py-2 pr-3">{r.safeSide}</td>
                      <td className="py-2 pr-3">{r.survived ? "oui" : "non"}</td>
                      <td className="max-w-[160px] truncate py-2 pr-3" title={r.hmac}>
                        {r.hmac}
                      </td>
                      <td className={`py-2 font-semibold ${r.valid ? "text-emerald-400" : "text-red-400"}`}>
                        {r.valid ? "✓" : "✗"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
