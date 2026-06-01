/**
 * brainAdapter.test.ts — unit tests for the lokyy-brain HTTP client.
 *
 * Run: `bun test src/brain/brainAdapter.test.ts`
 *
 * fetch is stubbed per-case; env (LOKYY_BRAIN_URL / LOKYY_BRAIN_TOKEN) is
 * read lazily by the adapter so we can flip it between cases.
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createManagedNote, probeBrainHealth } from "./brainAdapter.ts";

const realFetch = globalThis.fetch;
const ORIG_URL = process.env.LOKYY_BRAIN_URL;
const ORIG_TOKEN = process.env.LOKYY_BRAIN_TOKEN;

function mockFetch(impl: (url: string, init?: RequestInit) => Response) {
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = typeof input === "string" ? input : String(input);
    return impl(url, init);
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  process.env.LOKYY_BRAIN_URL = "http://lokyy-brain:8787";
  delete process.env.LOKYY_BRAIN_TOKEN;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  if (ORIG_URL === undefined) delete process.env.LOKYY_BRAIN_URL;
  else process.env.LOKYY_BRAIN_URL = ORIG_URL;
  if (ORIG_TOKEN === undefined) delete process.env.LOKYY_BRAIN_TOKEN;
  else process.env.LOKYY_BRAIN_TOKEN = ORIG_TOKEN;
});

describe("createManagedNote — success", () => {
  it("returns {ok:true, id, path} on 2xx with a valid body", async () => {
    let capturedUrl = "";
    let capturedBody: unknown = null;
    let capturedHeaders: Record<string, string> = {};
    mockFetch((url, init) => {
      capturedUrl = url;
      capturedBody = JSON.parse(String(init?.body));
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
      return new Response(
        JSON.stringify({ id: "01J0NOTE", path: "30_captures/note.md" }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    });

    const result = await createManagedNote({
      title: "Job: Daily digest",
      body: "content here",
      type: "capture",
      tags: ["scheduler", "job_abc"],
      folderHint: "30_captures",
    });

    expect(result).toEqual({ ok: true, id: "01J0NOTE", path: "30_captures/note.md" });
    expect(capturedUrl).toBe("http://lokyy-brain:8787/api/notes/create-managed");
    expect(capturedBody).toEqual({
      title: "Job: Daily digest",
      body: "content here",
      type: "capture",
      tags: ["scheduler", "job_abc"],
      folder_hint: "30_captures",
    });
    // No token set → no Authorization header.
    expect(capturedHeaders.Authorization).toBeUndefined();
  });

  it("sends Authorization: Bearer only when LOKYY_BRAIN_TOKEN is set", async () => {
    process.env.LOKYY_BRAIN_TOKEN = "secret-token";
    let auth: string | undefined;
    mockFetch((_url, init) => {
      auth = (init?.headers as Record<string, string>)?.Authorization;
      return new Response(JSON.stringify({ id: "x", path: "p" }), { status: 200 });
    });

    await createManagedNote({ title: "t", body: "b", type: "note" });
    expect(auth).toBe("Bearer secret-token");
  });

  it("defaults tags to [] and omits folder_hint when not provided", async () => {
    let body: any = null;
    mockFetch((_url, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ id: "x", path: "p" }), { status: 200 });
    });
    await createManagedNote({ title: "t", body: "b", type: "note" });
    expect(body.tags).toEqual([]);
    expect(body.folder_hint).toBeUndefined();
  });
});

describe("createManagedNote — conflict (ISC-42)", () => {
  it("returns {ok:false, reason:'conflict'} on HTTP 409 without throwing", async () => {
    mockFetch(() => new Response("already exists", { status: 409 }));
    const result = await createManagedNote({ title: "t", body: "b", type: "note" });
    expect(result).toEqual({ ok: false, reason: "conflict" });
  });
});

describe("createManagedNote — unreachable", () => {
  it("returns {ok:false, reason:'unreachable'} when fetch throws", async () => {
    mockFetch(() => {
      throw new Error("ECONNREFUSED");
    });
    const result = await createManagedNote({ title: "t", body: "b", type: "note" });
    expect(result).toEqual({ ok: false, reason: "unreachable" });
  });
});

describe("createManagedNote — disabled", () => {
  it("returns {ok:false, reason:'disabled'} when LOKYY_BRAIN_URL is unset, never fetching", async () => {
    delete process.env.LOKYY_BRAIN_URL;
    let fetched = false;
    mockFetch(() => {
      fetched = true;
      return new Response("{}", { status: 200 });
    });
    const result = await createManagedNote({ title: "t", body: "b", type: "note" });
    expect(result).toEqual({ ok: false, reason: "disabled" });
    expect(fetched).toBe(false);
  });
});

describe("createManagedNote — error fallbacks", () => {
  it("returns {ok:false, reason:'error'} on a non-409 non-2xx status", async () => {
    mockFetch(() => new Response("boom", { status: 500 }));
    const result = await createManagedNote({ title: "t", body: "b", type: "note" });
    expect(result).toEqual({ ok: false, reason: "error" });
  });

  it("returns {ok:false, reason:'error'} when 2xx body lacks id/path", async () => {
    mockFetch(() => new Response(JSON.stringify({ id: "x" }), { status: 200 }));
    const result = await createManagedNote({ title: "t", body: "b", type: "note" });
    expect(result).toEqual({ ok: false, reason: "error" });
  });
});

describe("probeBrainHealth (ISC-49)", () => {
  it("returns false and does not throw when URL is unset", async () => {
    delete process.env.LOKYY_BRAIN_URL;
    expect(await probeBrainHealth()).toBe(false);
  });

  it("returns true on a 2xx /health response", async () => {
    let url = "";
    mockFetch((u) => {
      url = u;
      return new Response("OK", { status: 200 });
    });
    expect(await probeBrainHealth()).toBe(true);
    expect(url).toBe("http://lokyy-brain:8787/health");
  });

  it("returns false (no throw) when /health is unreachable", async () => {
    mockFetch(() => {
      throw new Error("ENOTFOUND");
    });
    expect(await probeBrainHealth()).toBe(false);
  });
});
