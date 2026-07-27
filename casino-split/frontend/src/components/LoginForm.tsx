import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";

export function LoginForm() {
  const { login, loading, error } = useAuth();
  const [username, setUsername] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!username.trim()) return;
    await login(username.trim()).catch(() => {
      /* l'erreur est déjà exposée via useAuth().error */
    });
  }

  return (
    <div className="mx-auto mt-12 max-w-sm rounded-2xl border border-felt-800 bg-felt-900 p-6 shadow-xl">
      <h1 className="mb-1 text-2xl font-bold text-gold-400">Split</h1>
      <p className="mb-6 text-sm text-slate-400">
        Connexion de développement : entrez un pseudo, un compte simulé est créé si besoin.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="pseudo"
          className="rounded-lg border border-felt-800 bg-felt-950 px-3 py-2 text-slate-100 outline-none focus:border-gold-500"
          autoFocus
        />
        <button
          type="submit"
          disabled={loading || !username.trim()}
          className="rounded-lg bg-gold-500 px-4 py-2 font-semibold text-felt-950 transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Connexion…" : "Se connecter"}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    </div>
  );
}
