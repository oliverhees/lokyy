/**
 * fireJob-brain.test.ts — verifies the Brain-write wiring inside the job-runner.
 *
 * Run: `bun test src/scheduler/fireJob-brain.test.ts`
 *
 * Strategy:
 *   - `bun:sqlite` DB lives at an in-memory path (LOKYY_DB_PATH=:memory:) so the
 *     migration runs cleanly and we don't touch ./data.
 *   - `createManagedNote` is mock.module-replaced so we can assert it's called
 *     (or not) and inject failures without a live Brain.
 *   - Hermes is driven via HERMES_API_KEY + a stubbed global fetch returning a
 *     chat-completion body.
 *
 * Env must be set BEFORE importing the modules under test, because lokyy-db.ts
 * resolves LOKYY_DB_PATH and job-runner.ts resolves HERMES_* at import time.
 */
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

process.env.LOKYY_DB_PATH = ":memory:";
process.env.HERMES_API_KEY = "test-key";
process.env.HERMES_BASE_URL = "http://hermes.test";

// Capture adapter calls; default behaviour = success.
const adapterCalls: any[] = [];
let adapterImpl: (input: any) => Promise<any> = async (input) => {
  adapterCalls.push(input);
  return { ok: true, id: "01JNOTE", path: "30_captures/note.md" };
};

mock.module("../brain/brainAdapter.ts", () => ({
  createManagedNote: (input: any) => adapterImpl(input),
  probeBrainHealth: async () => true,
}));

const { lokyyDb } = await import("../db/lokyy-db.ts");
const { fireJob } = await import("./job-runner.ts");
import type { LokyyJobRow } from "../db/lokyy-db.ts";

const realFetch = globalThis.fetch;

function stubHermesOk(content: string) {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({ choices: [{ message: { content } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )) as unknown as typeof fetch;
}

function makeJob(overrides: Partial<LokyyJobRow>): LokyyJobRow {
  return {
    id: "job_test1",
    name: "Test Job",
    schedule: "* * * * *",
    prompt: "do a thing",
    status: "active",
    createdAt: Date.now(),
    lastRun: null,
    nextRun: null,
    brainEnabled: 0,
    brainType: null,
    brainFolderHint: null,
    ...overrides,
  };
}

function insertJob(job: LokyyJobRow) {
  lokyyDb
    .query(
      `INSERT OR REPLACE INTO lokyy_job
         (id, name, schedule, prompt, status, createdAt, lastRun, nextRun,
          brainEnabled, brainType, brainFolderHint)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      job.id, job.name, job.schedule, job.prompt, job.status, job.createdAt,
      job.lastRun, job.nextRun, job.brainEnabled, job.brainType, job.brainFolderHint,
    );
}

beforeEach(() => {
  adapterCalls.length = 0;
  adapterImpl = async (input) => {
    adapterCalls.push(input);
    return { ok: true, id: "01JNOTE", path: "30_captures/note.md" };
  };
  stubHermesOk("hermes output text");
});

afterEach(() => {
  globalThis.fetch = realFetch;
  lokyyDb.query("DELETE FROM lokyy_job").run();
});

describe("fireJob → Brain wiring", () => {
  it("writes to Brain with the contracted payload when brainEnabled", async () => {
    const job = makeJob({
      id: "job_brain",
      name: "Daily Digest",
      brainEnabled: 1,
      brainType: "capture",
      brainFolderHint: "30_captures",
    });
    insertJob(job);

    const result = await fireJob(job);

    expect(result.ok).toBe(true);
    expect(result.hermesContent).toBe("hermes output text");
    expect(adapterCalls).toHaveLength(1);
    expect(adapterCalls[0]).toEqual({
      title: "Job: Daily Digest",
      body: "hermes output text",
      type: "capture",
      folderHint: "30_captures",
      tags: ["scheduler", "job_brain"],
    });
  });

  it("passes folderHint=undefined when brainFolderHint is null", async () => {
    const job = makeJob({ id: "job_nf", brainEnabled: 1, brainType: "note", brainFolderHint: null });
    insertJob(job);
    await fireJob(job);
    expect(adapterCalls[0].folderHint).toBeUndefined();
  });

  it("does NOT write to Brain when brainEnabled is 0", async () => {
    const job = makeJob({ id: "job_off", brainEnabled: 0 });
    insertJob(job);
    const result = await fireJob(job);
    expect(result.ok).toBe(true);
    expect(adapterCalls).toHaveLength(0);
  });

  it("keeps the job ok when the Brain adapter reports a conflict", async () => {
    adapterImpl = async (input) => {
      adapterCalls.push(input);
      return { ok: false, reason: "conflict" };
    };
    const job = makeJob({ id: "job_conf", brainEnabled: 1, brainType: "note" });
    insertJob(job);
    const result = await fireJob(job);
    expect(result.ok).toBe(true);
    expect(adapterCalls).toHaveLength(1);
  });

  it("keeps the job ok even if the Brain adapter throws unexpectedly", async () => {
    adapterImpl = async () => {
      throw new Error("unexpected");
    };
    const job = makeJob({ id: "job_throw", brainEnabled: 1, brainType: "note" });
    insertJob(job);
    const result = await fireJob(job);
    expect(result.ok).toBe(true);
  });
});
