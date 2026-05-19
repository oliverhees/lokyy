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
`);

export type LokyyJobRow = {
  id: string;
  name: string;
  schedule: string;
  prompt: string;
  status: "active" | "paused";
  createdAt: number;
  lastRun: number | null;
  nextRun: number | null;
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
