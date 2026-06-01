/**
 * lokyy-db.ts
 *
 * SQLite-Datenbank für Lokyy-eigene Daten (jobs, prompts, teams) —
 * getrennt von der Better-Auth-DB (auth.db) damit Auth-Migrations und
 * App-Migrations sich nicht gegenseitig blockieren.
 *
 * Path: ./data/lokyy.db (gleicher named-volume wie auth.db).
 *
 * Schema-Bootstrap: idempotent via IF NOT EXISTS. Cron-runner anbinden
 * + status-transitions kommen in Folge-Stories — heute geht's um
 * Persistenz pur (Issue #135).
 */
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DB_PATH = process.env.LOKYY_DB_PATH ?? "./data/lokyy.db";
mkdirSync(dirname(resolve(DB_PATH)), { recursive: true });

export const lokyyDb = new Database(DB_PATH);
lokyyDb.exec("PRAGMA journal_mode = WAL");
lokyyDb.exec("PRAGMA foreign_keys = ON");

lokyyDb.exec(`
  CREATE TABLE IF NOT EXISTS lokyy_job (
    id          TEXT    PRIMARY KEY,
    name        TEXT    NOT NULL,
    schedule    TEXT    NOT NULL,
    prompt      TEXT    NOT NULL,
    status      TEXT    NOT NULL DEFAULT 'paused',
    createdAt   INTEGER NOT NULL,
    lastRun     INTEGER,
    nextRun     INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_lokyy_job_status ON lokyy_job(status);


  CREATE TABLE IF NOT EXISTS lokyy_prompt (
    id          TEXT    PRIMARY KEY,
    title       TEXT    NOT NULL,
    body        TEXT    NOT NULL,
    tags        TEXT    NOT NULL DEFAULT '[]',
    createdAt   INTEGER NOT NULL,
    updatedAt   INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS lokyy_team (
    id              TEXT    PRIMARY KEY,
    name            TEXT    NOT NULL,
    description     TEXT    NOT NULL DEFAULT '',
    memberAgentIds  TEXT    NOT NULL DEFAULT '[]',
    createdAt       INTEGER NOT NULL,
    updatedAt       INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS lokyy_reminder (
    id            TEXT    PRIMARY KEY,
    text          TEXT    NOT NULL,
    scheduledAt   INTEGER NOT NULL,         -- ms epoch
    channel       TEXT    NOT NULL DEFAULT 'in-app',  -- in-app | telegram | email | calendar
    status        TEXT    NOT NULL DEFAULT 'pending', -- pending | fired | dismissed | failed
    createdAt     INTEGER NOT NULL,
    firedAt       INTEGER,
    deliveryError TEXT,
    origin        TEXT    NOT NULL DEFAULT 'user'    -- user (UI) | agent (Hermes-skill)
  );
  CREATE INDEX IF NOT EXISTS idx_lokyy_reminder_status_scheduled
    ON lokyy_reminder(status, scheduledAt);

  -- Second Brain — Phase-3 (B1 foundation).
  -- Singleton row: id is always 'default' for v1, leaves room for multi-vault later.
  CREATE TABLE IF NOT EXISTS lokyy_vault (
    id            TEXT    PRIMARY KEY DEFAULT 'default',
    mode          TEXT    NOT NULL,                -- 'local' | 'remote'
    remoteUrl     TEXT,                            -- null when mode='local'
    sshKeyId      TEXT,                            -- FK to lokyy_ssh_key.id
    lastSyncAt    INTEGER,
    syncError     TEXT,
    createdAt     INTEGER NOT NULL,
    updatedAt     INTEGER NOT NULL
  );

  -- One row per generated keypair. Private key is encrypted at rest (AES-256-GCM
  -- with key derived from BETTER_AUTH_SECRET — same trust boundary as session tokens).
  CREATE TABLE IF NOT EXISTS lokyy_ssh_key (
    id              TEXT    PRIMARY KEY,
    keyType         TEXT    NOT NULL DEFAULT 'ed25519',
    publicKey       TEXT    NOT NULL,
    encPrivateKey   TEXT    NOT NULL,   -- base64(iv) ':' base64(ciphertext+tag)
    createdAt       INTEGER NOT NULL
  );
`);

/**
 * Idempotent column migrations for lokyy_job — Brain-Andockung (Epic Cron-AP1, C2).
 *
 * SQLite has no `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, so we read the live
 * column set via PRAGMA table_info and ADD only the columns that are missing.
 * Safe to run on every boot (existing DBs get upgraded once, new DBs already
 * have nothing to add after the first run).
 */
function ensureColumn(
  table: string,
  column: string,
  ddl: string,
): void {
  const cols = lokyyDb
    .query<{ name: string }, []>(`PRAGMA table_info(${table})`)
    .all()
    .map((r) => r.name);
  if (!cols.includes(column)) {
    lokyyDb.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

ensureColumn("lokyy_job", "brainEnabled", "brainEnabled INTEGER NOT NULL DEFAULT 0");
ensureColumn("lokyy_job", "brainType", "brainType TEXT");
ensureColumn("lokyy_job", "brainFolderHint", "brainFolderHint TEXT");

/** Closed list of Brain DOC types accepted for a job's `brainType`. */
export const BRAIN_DOC_TYPES = [
  "note",
  "capture",
  "project",
  "task",
  "decision",
  "meeting",
  "customer",
  "workflow",
  "intervention",
  "content",
  "skill",
] as const;
export type BrainDocType = (typeof BRAIN_DOC_TYPES)[number];

export type LokyyJobRow = {
  id: string;
  name: string;
  schedule: string;
  prompt: string;
  status: "active" | "paused";
  createdAt: number;
  lastRun: number | null;
  nextRun: number | null;
  /** 0/1 — whether a successful run writes its output into Brain. */
  brainEnabled: number;
  /** Brain DOC type; required (non-null) when brainEnabled = 1. */
  brainType: BrainDocType | null;
  /** Optional folder hint passed to Brain on write. */
  brainFolderHint: string | null;
};

export type LokyyPromptRow = {
  id: string;
  title: string;
  body: string;
  /** JSON-encoded string[] in storage; deserialized at the API boundary. */
  tags: string;
  createdAt: number;
  updatedAt: number;
};

export type LokyyTeamRow = {
  id: string;
  name: string;
  description: string;
  /** JSON-encoded string[] of agent ids; deserialized at the API boundary. */
  memberAgentIds: string;
  createdAt: number;
  updatedAt: number;
};

export type ReminderChannel = "in-app" | "telegram" | "email" | "calendar";
export type ReminderStatus = "pending" | "fired" | "dismissed" | "failed";
export type ReminderOrigin = "user" | "agent";

export type LokyyReminderRow = {
  id: string;
  text: string;
  scheduledAt: number;
  channel: ReminderChannel;
  status: ReminderStatus;
  createdAt: number;
  firedAt: number | null;
  deliveryError: string | null;
  origin: ReminderOrigin;
};

export type VaultMode = "local" | "remote";

export type LokyyVaultRow = {
  id: string;
  mode: VaultMode;
  remoteUrl: string | null;
  sshKeyId: string | null;
  lastSyncAt: number | null;
  syncError: string | null;
  createdAt: number;
  updatedAt: number;
};

export type LokyySshKeyRow = {
  id: string;
  keyType: "ed25519";
  publicKey: string;
  encPrivateKey: string;
  createdAt: number;
};
