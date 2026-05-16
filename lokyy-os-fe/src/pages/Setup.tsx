import { useState, type FormEvent } from "react";
import { signUp } from "../auth-client";
import { AuthShell, Field, PrimaryButton, ErrorBox } from "../components/AuthShell";

export default function Setup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signUp.email({ name, email, password });
    setLoading(false);
    if (res.error) {
      setError(res.error.message ?? "Setup failed");
      return;
    }
    // Hard reload — see comment in Login.tsx
    window.location.assign("/");
  }

  return (
    <AuthShell
      title="First-run setup"
      subtitle="Create the owner account for this Lokyy instance"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label="Name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          required
          autoComplete="name"
        />
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
          autoComplete="new-password"
          minLength={8}
        />
        <p className="text-xs text-zinc-500">
          Min 8 characters. This is the only account until invitations land in
          a later phase.
        </p>
        {error && <ErrorBox message={error} />}
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? "Creating account…" : "Create owner account"}
        </PrimaryButton>
      </form>
    </AuthShell>
  );
}
