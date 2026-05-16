#!/usr/bin/env bun
/**
 * cli/lokyy-installer.ts — Lokyy installer CLI
 *
 * Idempotent fresh-server bring-up for the Lokyy KI-Betriebssystem.
 *
 * Commands:
 *   install   prompts for missing env vars, generates secrets, writes .env.local
 *             (chmod 0600), pulls images, brings stack up, waits for healthy
 *   up        docker compose up -d (no prompts)
 *   down      docker compose down (preserves volumes)
 *   purge     docker compose down -v (deletes volumes, requires confirmation)
 *   status    docker compose ps + per-container health summary
 *
 * Acceptance (Issue #84):
 *   ISC-67  CLI exposes the 5 commands above
 *   ISC-68  install is idempotent — run twice → identical end-state
 *   ISC-69  install health-check loop exits 0 only when all containers healthy
 */
import { $ } from "bun";
import { existsSync, statSync, chmodSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";

// ─────────────────────────────────────────────────────────────────────────────
// Paths
// ─────────────────────────────────────────────────────────────────────────────

const SELF = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(SELF), "..");
const INFRA_DIR = resolve(REPO_ROOT, "infrastructure");
const COMPOSE_PROD = resolve(INFRA_DIR, "docker-compose.yml");
const COMPOSE_DEV = resolve(INFRA_DIR, "docker-compose.dev.yml");
const ENV_EXAMPLE = resolve(INFRA_DIR, ".env.example");
const ENV_LOCAL = resolve(INFRA_DIR, ".env.local");

// All expected services for healthcheck waiting (Phase-0 active set)
const EXPECTED_SERVICES = [
  "traefik",
  "docker-socket-proxy",
  "lokyy-os-fe",
  "lokyy-os-be",
  "lokyy-brain",
];

const HEALTHCHECK_TIMEOUT_S = 90;

// ─────────────────────────────────────────────────────────────────────────────
// Colors
// ─────────────────────────────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};
const info = (s: string) => console.log(`${c.cyan}▸${c.reset} ${s}`);
const ok = (s: string) => console.log(`${c.green}✓${c.reset} ${s}`);
const warn = (s: string) => console.log(`${c.yellow}!${c.reset} ${s}`);
const fail = (s: string) => console.error(`${c.red}✗${c.reset} ${s}`);
const dim = (s: string) => `${c.dim}${s}${c.reset}`;

// ─────────────────────────────────────────────────────────────────────────────
// Env file helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1);
    out[key] = val;
  }
  return out;
}

function loadEnvLocal(): Record<string, string> {
  if (!existsSync(ENV_LOCAL)) return {};
  return parseEnv(readFileSync(ENV_LOCAL, "utf-8"));
}

function writeEnvLocal(values: Record<string, string>): void {
  const lines: string[] = [
    "# Lokyy KI-OS — Local Dev Environment (managed by lokyy-installer)",
    "# Generated/updated automatically. Hand-edit is allowed but the installer",
    "# will re-write the file on the next `install` run if values are missing.",
    "",
  ];
  for (const [k, v] of Object.entries(values)) {
    lines.push(`${k}=${v}`);
  }
  writeFileSync(ENV_LOCAL, lines.join("\n") + "\n");
  chmodSync(ENV_LOCAL, 0o600);
}

// ─────────────────────────────────────────────────────────────────────────────
// Secret + prompt helpers
// ─────────────────────────────────────────────────────────────────────────────

async function generateJwtSecret(): Promise<string> {
  const r = await $`openssl rand -hex 32`.quiet();
  return r.stdout.toString().trim();
}

async function generateBasicAuth(user: string, pwd: string): Promise<string> {
  // apr1 hash via openssl, then escape $ → $$ for docker-compose
  const r = await $`openssl passwd -apr1 ${pwd}`.quiet();
  const hash = r.stdout.toString().trim();
  return `${user}:${hash.replace(/\$/g, "$$$$")}`;
}

async function prompt(rl: ReturnType<typeof createInterface>, q: string, fallback?: string): Promise<string> {
  const suffix = fallback ? ` ${dim(`[${fallback}]`)} ` : " ";
  const a = (await rl.question(q + suffix)).trim();
  return a || (fallback ?? "");
}

async function confirm(rl: ReturnType<typeof createInterface>, q: string): Promise<boolean> {
  const a = await rl.question(`${q} ${dim("[y/N]")} `);
  return /^y(es)?$/i.test(a.trim());
}

// ─────────────────────────────────────────────────────────────────────────────
// Docker compose wrapper
// ─────────────────────────────────────────────────────────────────────────────

function composeArgs(): string[] {
  return [
    "compose",
    "-f", COMPOSE_PROD,
    "-f", COMPOSE_DEV,
    "--env-file", ENV_LOCAL,
  ];
}

async function compose(...extra: string[]): Promise<number> {
  const args = [...composeArgs(), ...extra];
  // Show the command for transparency
  console.log(dim(`$ docker ${args.map(a => a.includes(" ") ? `"${a}"` : a).join(" ")}`));
  const proc = Bun.spawn(["docker", ...args], { stdout: "inherit", stderr: "inherit" });
  return await proc.exited;
}

interface ContainerStatus {
  name: string;
  state: string;
  health: string;
}

async function composePs(): Promise<ContainerStatus[]> {
  const proc = await $`docker ${composeArgs()} ps --format json`.quiet().nothrow();
  if (proc.exitCode !== 0) return [];
  const out = proc.stdout.toString().trim();
  if (!out) return [];
  // compose ps --format json emits one JSON object per line
  const lines = out.split("\n").filter(Boolean);
  return lines.map(line => {
    const j = JSON.parse(line);
    return {
      name: j.Service ?? j.Name,
      state: j.State,
      health: j.Health ?? "",
    };
  });
}

function isFullyHealthy(statuses: ContainerStatus[]): boolean {
  // Every expected service is "running"; if it has a health field, it must be "healthy"
  for (const svc of EXPECTED_SERVICES) {
    const s = statuses.find(x => x.name === svc);
    if (!s) return false;
    if (s.state !== "running") return false;
    if (s.health && s.health !== "healthy") return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────────────────────

async function cmdInstall(): Promise<number> {
  info("Lokyy installer — install / refresh");

  if (!existsSync(COMPOSE_PROD)) {
    fail(`Compose file missing: ${COMPOSE_PROD}`);
    return 2;
  }

  const current = loadEnvLocal();
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    // Required vars; idempotent — keep existing values, only prompt for missing.
    const REQUIRED = [
      { key: "DOMAIN", default: "lokyy.local" },
      { key: "TRAEFIK_DASHBOARD_HOST", default: "traefik.lokyy.local" },
      { key: "ACME_EMAIL", default: "oliver+lokyy@example.com" },
      { key: "LOKYY_BRAIN_FORGEJO_URL", default: "" },
    ];

    for (const v of REQUIRED) {
      if (!current[v.key]) {
        current[v.key] = await prompt(rl, `${v.key}:`, v.default);
      } else {
        ok(`${v.key} present ${dim(`(${current[v.key]})`)}`);
      }
    }

    // Dashboard basic-auth credentials.
    if (!current.TRAEFIK_DASHBOARD_AUTH) {
      const user = await prompt(rl, "Traefik dashboard admin username:", "admin");
      const pwd = await prompt(rl, "Traefik dashboard admin password:", "supersecure123");
      current.TRAEFIK_DASHBOARD_AUTH = await generateBasicAuth(user, pwd);
      ok(`Generated TRAEFIK_DASHBOARD_AUTH for user '${user}'`);
    } else {
      ok(`TRAEFIK_DASHBOARD_AUTH present`);
    }

    // JWT secret (ADR-005)
    if (!current.LOKYY_AGENT_JWT_SECRET) {
      current.LOKYY_AGENT_JWT_SECRET = await generateJwtSecret();
      ok(`Generated LOKYY_AGENT_JWT_SECRET (64 hex chars)`);
    } else {
      ok(`LOKYY_AGENT_JWT_SECRET present`);
    }

    // Better-Auth secret (Phase-1b user auth)
    if (!current.BETTER_AUTH_SECRET) {
      current.BETTER_AUTH_SECRET = await generateJwtSecret();
      ok(`Generated BETTER_AUTH_SECRET (64 hex chars)`);
    } else {
      ok(`BETTER_AUTH_SECRET present`);
    }

    writeEnvLocal(current);
    ok(`Wrote ${ENV_LOCAL} (chmod 0600)`);
  } finally {
    rl.close();
  }

  info("Pulling images …");
  if (await compose("pull") !== 0) {
    warn("compose pull returned non-zero (image already cached?); continuing");
  }

  info("Bringing stack up …");
  if (await compose("up", "-d", "--remove-orphans") !== 0) {
    fail("compose up failed");
    return 1;
  }

  info(`Waiting up to ${HEALTHCHECK_TIMEOUT_S}s for all services healthy …`);
  const t0 = Date.now();
  while (true) {
    const ps = await composePs();
    if (isFullyHealthy(ps)) {
      ok("All services healthy");
      return 0;
    }
    if ((Date.now() - t0) / 1000 > HEALTHCHECK_TIMEOUT_S) {
      fail("Timed out waiting for healthy state. Current:");
      printStatus(ps);
      return 3;
    }
    await Bun.sleep(2000);
  }
}

async function cmdUp(): Promise<number> {
  if (!existsSync(ENV_LOCAL)) {
    fail(`${ENV_LOCAL} missing — run 'lokyy install' first`);
    return 2;
  }
  return await compose("up", "-d", "--remove-orphans");
}

async function cmdDown(): Promise<number> {
  if (!existsSync(ENV_LOCAL)) {
    warn(`${ENV_LOCAL} missing — compose may have nothing to stop`);
  }
  return await compose("down");
}

async function cmdPurge(): Promise<number> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    warn("PURGE will stop containers AND delete named volumes. Data loss is permanent.");
    const sure = await confirm(rl, "Type 'y' to proceed");
    if (!sure) {
      info("Aborted.");
      return 0;
    }
  } finally {
    rl.close();
  }
  return await compose("down", "-v", "--remove-orphans");
}

async function cmdStatus(): Promise<number> {
  if (!existsSync(ENV_LOCAL)) {
    warn(`${ENV_LOCAL} missing — run 'lokyy install' first`);
    return 2;
  }
  const ps = await composePs();
  if (ps.length === 0) {
    info("No containers in the lokyy stack are running.");
    return 0;
  }
  printStatus(ps);
  return isFullyHealthy(ps) ? 0 : 1;
}

function printStatus(ps: ContainerStatus[]): void {
  const nameW = Math.max(6, ...ps.map(p => p.name.length));
  const stateW = Math.max(5, ...ps.map(p => p.state.length));
  console.log("");
  console.log(`  ${"SERVICE".padEnd(nameW)}  ${"STATE".padEnd(stateW)}  HEALTH`);
  console.log(`  ${"-".repeat(nameW)}  ${"-".repeat(stateW)}  ${"-".repeat(8)}`);
  for (const svc of EXPECTED_SERVICES) {
    const s = ps.find(x => x.name === svc);
    if (!s) {
      console.log(`  ${c.red}${svc.padEnd(nameW)}${c.reset}  ${"missing".padEnd(stateW)}  ${"—"}`);
      continue;
    }
    const stateColor = s.state === "running" ? c.green : c.yellow;
    const healthColor =
      s.health === "healthy" ? c.green :
      s.health === "" ? c.dim :
      c.yellow;
    console.log(
      `  ${s.name.padEnd(nameW)}  ${stateColor}${s.state.padEnd(stateW)}${c.reset}  ${healthColor}${s.health || "(no healthcheck)"}${c.reset}`
    );
  }
  console.log("");
}

function help(): number {
  console.log(`${c.bold}lokyy${c.reset} — Lokyy installer CLI`);
  console.log("");
  console.log("Usage:");
  console.log(`  lokyy ${c.cyan}install${c.reset}    Prompt for missing config, generate secrets, bring up stack`);
  console.log(`  lokyy ${c.cyan}up${c.reset}         Start the stack (uses existing .env.local)`);
  console.log(`  lokyy ${c.cyan}down${c.reset}       Stop containers, preserve volumes`);
  console.log(`  lokyy ${c.cyan}purge${c.reset}      Stop containers and DELETE volumes (requires confirmation)`);
  console.log(`  lokyy ${c.cyan}status${c.reset}     Show per-service container state and health`);
  console.log("");
  console.log("Files:");
  console.log(`  ${INFRA_DIR}/docker-compose.yml`);
  console.log(`  ${INFRA_DIR}/docker-compose.dev.yml`);
  console.log(`  ${INFRA_DIR}/.env.local ${dim("(generated, chmod 0600)")}`);
  console.log("");
  console.log("See: docs/decisions/ADR-003-docker-topology-etappe-2.md");
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entrypoint
// ─────────────────────────────────────────────────────────────────────────────

const cmd = (process.argv[2] ?? "").toLowerCase();
let exit = 0;
switch (cmd) {
  case "install": exit = await cmdInstall(); break;
  case "up": exit = await cmdUp(); break;
  case "down": exit = await cmdDown(); break;
  case "purge": exit = await cmdPurge(); break;
  case "status": exit = await cmdStatus(); break;
  case "":
  case "help":
  case "-h":
  case "--help":
    exit = help();
    break;
  default:
    fail(`Unknown command: ${cmd}`);
    help();
    exit = 2;
}
process.exit(exit);
