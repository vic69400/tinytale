import { Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { Nav } from "./components/Nav";
import { GamePage } from "./pages/GamePage";
import { VerifyPage } from "./pages/VerifyPage";

export default function App() {
  return (
    <AuthProvider>
      <div className="flex min-h-screen flex-col">
        <Nav />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
          <Routes>
            <Route path="/" element={<GamePage />} />
            <Route path="/verify" element={<VerifyPage />} />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  );
}
