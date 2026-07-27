import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Nav() {
  const { auth, logout } = useAuth();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm font-medium transition ${
      isActive ? "bg-gold-500 text-felt-950" : "text-slate-200 hover:bg-felt-800"
    }`;

  return (
    <header className="sticky top-0 z-10 border-b border-felt-800 bg-felt-900/90 backdrop-blur">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <span className="text-lg font-bold tracking-wide text-gold-400">Split</span>
        <nav className="flex items-center gap-2">
          <NavLink to="/" className={linkClass} end>
            Jouer
          </NavLink>
          <NavLink to="/verify" className={linkClass}>
            Vérifier l'équité
          </NavLink>
        </nav>
        {auth && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-300">{auth.username}</span>
            <button
              onClick={logout}
              className="text-slate-400 underline underline-offset-2 hover:text-slate-200"
            >
              Déconnexion
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
