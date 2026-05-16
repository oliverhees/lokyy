import type { ReactNode } from "react";

export function AuthShell({ title, subtitle, children }: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-fuchsia-400 bg-clip-text text-transparent">
            Lokyy
          </h1>
          <p className="text-zinc-400">{title}</p>
          {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
        </div>
        {children}
      </div>
    </main>
  );
}

export function Field({ label, ...input }: {
  label: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block space-y-1">
      <span className="text-xs uppercase tracking-wide text-zinc-500">{label}</span>
      <input
        {...input}
        className="w-full rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-400 transition"
      />
    </label>
  );
}

export function PrimaryButton({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className="w-full rounded-md bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-4 py-2 font-medium text-zinc-950 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
    >
      {children}
    </button>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
      {message}
    </div>
  );
}
