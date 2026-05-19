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
