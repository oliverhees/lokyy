import { useState, type FormEvent } from "react";
import { signIn } from "../auth-client";
import { AuthShell, Field, PrimaryButton, ErrorBox } from "../components/AuthShell";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn.email({ email, password });
    setLoading(false);
    if (res.error) {
      setError(res.error.message ?? "Sign-in failed");
      return;
    }
    // Hard reload so useSession picks up the freshly-set cookie. SPA-navigate
    // would race the cookie-write and Root would redirect back to /login.
    window.location.assign("/");
  }

  return (
    <AuthShell title="Sign in" subtitle="Lokyy KI-Betriebssystem">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        {error && <ErrorBox message={error} />}
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </PrimaryButton>
      </form>
    </AuthShell>
  );
}
