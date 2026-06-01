/**
 * Thin wrapper around the `git` CLI. Runs every command in the vault dir,
 * with the SSH key (if any) forced via GIT_SSH_COMMAND so we don't depend on
 * an interactive ~/.ssh/config setup. StrictHostKeyChecking=no is acceptable
 * because the user pastes a remote URL they trust; we're not MITM-resilient
 * for arbitrary discovery.
 */
import { MANAGED_VAULT_PATH } from "./runtime.ts";

export type GitResult = {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export type GitOpts = {
  cwd?: string;
  sshKeyPath?: string | null;
  env?: Record<string, string>;
  /** Hard timeout in ms; default 25_000. Kills the spawned process on expiry. */
  timeoutMs?: number;
};

export async function runGit(args: string[], opts: GitOpts = {}): Promise<GitResult> {
  const cwd = opts.cwd ?? MANAGED_VAULT_PATH;
  const timeoutMs = opts.timeoutMs ?? 25_000;
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    ...(opts.env ?? {}),
    GIT_TERMINAL_PROMPT: "0",
  };
  if (opts.sshKeyPath) {
    // ConnectTimeout + BatchMode prevent hangs when SSH-port is filtered
    // (Cloudflare-proxied DNS is a common foot-gun: HTTPS goes through, 22 doesn't).
    // -4 forces IPv4: Docker default bridge has no IPv6 route, so a DNS
    // record like Cloudflare's returning AAAA first ends up as
    // "Network is unreachable" otherwise.
    env.GIT_SSH_COMMAND =
      `ssh -4 -i ${opts.sshKeyPath} -o IdentitiesOnly=yes -o StrictHostKeyChecking=no ` +
      `-o UserKnownHostsFile=/dev/null -o BatchMode=yes -o ConnectTimeout=8`;
  }
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  const killer = setTimeout(() => {
    try { proc.kill(); } catch { /* already exited */ }
  }, timeoutMs);
  let timedOut = false;
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  clearTimeout(killer);
  // Bun reports null exitCode when killed by signal; surface a readable message.
  if (exitCode === null || exitCode === undefined) {
    timedOut = true;
  }
  const stderrFinal = timedOut
    ? `${stderr}\n[lokyy] killed after ${timeoutMs}ms — connection likely blocked (Cloudflare-proxy filters port 22? non-standard SSH port? key not on remote?)`
    : stderr;
  return { ok: exitCode === 0, exitCode, stdout, stderr: stderrFinal };
}

export async function gitVersion(): Promise<string> {
  const r = await runGit(["--version"], { cwd: "/" });
  return r.ok ? r.stdout.trim() : "(git not available)";
}
