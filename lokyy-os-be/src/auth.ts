/**
 * Better-Auth configuration for lokyy-os-be.
 *
 * Mirrors the ADR-002 Etappe-1 pattern (email+password, httpOnly cookies,
 * SQLite, organizations plugin loaded but unused) so that Lokyy Personal
 * (single tenant) keeps the SaaS migration path open without refactor.
 *
 * DB location: ./data/auth.db inside the container.
 * The /data directory is mounted as a named volume (lokyy-os-db) in compose.
 */
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { Database } from "bun:sqlite";
import { Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DB_PATH = process.env.AUTH_DB_PATH ?? "./data/auth.db";
mkdirSync(dirname(resolve(DB_PATH)), { recursive: true });

const db = new Database(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

const kysely = new Kysely<unknown>({
  dialect: new BunSqliteDialect({ database: db }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Schema bootstrap
//
// Better-Auth's CLI migrator (`bunx @better-auth/cli migrate`) hangs in Bun's
// non-TTY Docker context (the CLI is interactive even with -y). We apply the
// schema directly here on first boot. The shape matches what Better-Auth +
// the organization plugin expects (verified against better-auth 1.2.x).
//
// IDEMPOTENT: every CREATE uses IF NOT EXISTS. Safe to re-run on container
// restart. Schema versioning is intentionally not introduced yet — when a
// schema migration becomes necessary, switch to a real migrator.
// ─────────────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS "user" (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    emailVerified INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL,
    image TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    expiresAt INTEGER NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    activeOrganizationId TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_session_userId ON session(userId);
  CREATE INDEX IF NOT EXISTS idx_session_token ON session(token);

  CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    providerId TEXT NOT NULL,
    accountId TEXT NOT NULL,
    password TEXT,
    accessToken TEXT,
    refreshToken TEXT,
    idToken TEXT,
    accessTokenExpiresAt INTEGER,
    refreshTokenExpiresAt INTEGER,
    scope TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_account_userId ON account(userId);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_account_provider_account
    ON account(providerId, accountId);

  CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_verification_identifier ON verification(identifier);

  -- organization plugin tables (loaded but unused per ADR-002 pattern;
  -- keeps the SaaS migration path open without a schema change)
  CREATE TABLE IF NOT EXISTS organization (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    logo TEXT,
    metadata TEXT,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS member (
    id TEXT PRIMARY KEY,
    organizationId TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invitation (
    id TEXT PRIMARY KEY,
    organizationId TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    inviterId TEXT NOT NULL REFERENCES "user"(id),
    createdAt INTEGER NOT NULL
  );
`);

const SECRET = process.env.BETTER_AUTH_SECRET;
if (!SECRET) {
  console.error(
    "FATAL: BETTER_AUTH_SECRET env var is required. " +
      "Run `lokyy install` or set it manually in .env.local."
  );
  process.exit(1);
}

const TRUSTED_ORIGINS = (process.env.AUTH_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const auth = betterAuth({
  database: {
    db: kysely,
    type: "sqlite",
  },
  secret: SECRET,
  baseURL: process.env.AUTH_BASE_URL ?? "https://lokyy.local",
  trustedOrigins: TRUSTED_ORIGINS.length > 0 ? TRUSTED_ORIGINS : ["https://lokyy.local"],
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    // No email verification in Phase-1 — single-user local install (ADR-002).
    requireEmailVerification: false,
  },
  session: {
    // 30-day session, 1-day rolling refresh (matches ADR-002).
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  advanced: {
    // SameSite=lax + httpOnly + secure-when-https
    useSecureCookies: process.env.NODE_ENV === "production",
    cookies: {
      sessionToken: {
        attributes: {
          sameSite: "lax",
        },
      },
    },
  },
  plugins: [
    // Loaded but unused — keeps SaaS migration path open per ADR-002.
    organization(),
  ],
});

export type Auth = typeof auth;
