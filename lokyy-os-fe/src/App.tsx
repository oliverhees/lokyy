import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useSession } from "./auth-client";
import { api } from "./lib/api";
import Login from "./pages/Login";
import Setup from "./pages/Setup";
import Dashboard from "./pages/Dashboard";

function Root() {
  const { data: session, isPending } = useSession();
  const [setupNeeded, setSetupNeeded] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .setupNeeded()
      .then((r) => setSetupNeeded(r.setupNeeded))
      .catch(() => setSetupNeeded(false));
  }, []);

  if (isPending || setupNeeded === null) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-500 flex items-center justify-center">
        loading…
      </main>
    );
  }
  if (setupNeeded) return <Navigate to="/setup" replace />;
  if (!session) return <Navigate to="/login" replace />;
  return <Dashboard />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Root />} />
        <Route path="/login" element={<Login />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
