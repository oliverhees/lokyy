/**
 * hermes-cli-client.ts
 *
 * Runs `hermes <subcommand>` inside the lokyy-hermes container via
 * docker-socket-proxy and returns the captured stdout/stderr.
 *
 * Lokyy-os-be has network access to docker-socket-proxy (POST=1 enabled
 * since Phase-2b). The proxy forwards a bounded subset of Docker API
 * calls to /var/run/docker.sock (mounted read-only there). For us:
 *   POST /containers/{name}/exec      → returns { Id }
 *   POST /exec/{id}/start             → streams stdout/stderr
 *   GET  /exec/{id}/json              → final exit code
 *
 * Stream framing: when we pass Tty:true on exec-create, the output is a
 * plain byte-stream (no 8-byte demux header). We use that mode because
 * for parsed CLI output, separating stderr from stdout is not useful and
 * the muxer adds avoidable complexity.
 */
const PROXY = process.env.DOCKER_API_BASE ?? "http://docker-socket-proxy:2375";
const CONTAINER = process.env.HERMES_CONTAINER_NAME ?? "lokyy-hermes";
const HERMES_BIN = "/opt/hermes/.venv/bin/hermes";
const EXEC_TIMEOUT_MS = 15_000;

export type CliResult = {
  ok: boolean;
  stdout: string;
  exitCode: number;
  durationMs: number;
};

export async function runHermesCli(args: string[]): Promise<CliResult> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), EXEC_TIMEOUT_MS);

  try {
    const createRes = await fetch(
      `${PROXY}/v1.41/containers/${CONTAINER}/exec`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          AttachStdout: true,
          AttachStderr: true,
          Tty: true,
          Cmd: [HERMES_BIN, ...args],
        }),
        signal: ctrl.signal,
      },
    );
    if (!createRes.ok) {
      const txt = await createRes.text().catch(() => "");
      throw new Error(
        `exec-create failed: HTTP ${createRes.status} ${txt.slice(0, 200)}`,
      );
    }
    const { Id } = (await createRes.json()) as { Id: string };

    const startRes = await fetch(`${PROXY}/v1.41/exec/${Id}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Detach: false, Tty: true }),
      signal: ctrl.signal,
    });
    if (!startRes.ok) {
      const txt = await startRes.text().catch(() => "");
      throw new Error(
        `exec-start failed: HTTP ${startRes.status} ${txt.slice(0, 200)}`,
      );
    }
    const stdout = await startRes.text();

    // Wait for inspect to settle ExitCode (very short loop — hermes CLI is fast)
    let exitCode = -1;
    for (let i = 0; i < 6; i++) {
      const inspect = await fetch(`${PROXY}/v1.41/exec/${Id}/json`, {
        signal: ctrl.signal,
      });
      if (inspect.ok) {
        const j = (await inspect.json()) as { Running: boolean; ExitCode: number | null };
        if (!j.Running) {
          exitCode = j.ExitCode ?? -1;
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    return {
      ok: exitCode === 0,
      stdout,
      exitCode,
      durationMs: Date.now() - t0,
    };
  } finally {
    clearTimeout(timer);
  }
}
