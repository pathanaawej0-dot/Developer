import { describe, it, expect } from "vitest";
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSessionStore } from "../../src/session-store/index.js";
import type { Session } from "../../src/session-store/index.js";

function tmpDir() {
  return mkdtempSync(join(tmpdir(), "session-test-"));
}

describe("SessionStore", () => {
  it("createSession creates a valid session file on disk", async () => {
    const dir = tmpDir();
    const store = createSessionStore(dir);

    const session = await store.createSession();

    expect(session.id).toBeTruthy();
    expect(session.createdAt).toBeTruthy();
    expect(session.updatedAt).toBe(session.createdAt);
    expect(session.messages).toEqual([]);

    const filePath = join(dir, `${session.id}.json`);
    expect(existsSync(filePath)).toBe(true);

    const raw = JSON.parse(readFileSync(filePath, "utf-8"));
    expect(raw.id).toBe(session.id);
    expect(raw.messages).toEqual([]);
  });

  it("loadSession hydrates messages from disk", async () => {
    const dir = tmpDir();
    const store = createSessionStore(dir);

    const created = await store.createSession();
    const loaded = await store.loadSession(created.id);

    expect(loaded.id).toBe(created.id);
    expect(loaded.createdAt).toBe(created.createdAt);
    expect(loaded.messages).toEqual([]);
  });

  it("appendMessages appends and updates updatedAt", async () => {
    const dir = tmpDir();
    const store = createSessionStore(dir);

    const session = await store.createSession();
    const originalUpdatedAt = session.updatedAt;

    await new Promise((r) => setTimeout(r, 10));

    const updated = await store.appendMessages(session.id, [
      { role: "user", content: "hello" },
    ]);

    expect(updated.messages).toHaveLength(1);
    expect(updated.messages[0].role).toBe("user");
    expect(updated.messages[0].content).toBe("hello");
    expect(updated.updatedAt).not.toBe(originalUpdatedAt);

    const loaded = await store.loadSession(session.id);
    expect(loaded.messages).toHaveLength(1);

    const raw = JSON.parse(readFileSync(join(dir, `${session.id}.json`), "utf-8"));
    expect(raw.messages).toHaveLength(1);
  });

  it("listSessions returns metadata for all sessions", async () => {
    const dir = tmpDir();
    const store = createSessionStore(dir);

    const s1 = await store.createSession();
    await store.appendMessages(s1.id, [{ role: "user", content: "hi" }]);
    const s2 = await store.createSession();

    const list = await store.listSessions();

    expect(list).toHaveLength(2);
    expect(list.find((s) => s.id === s1.id)?.messageCount).toBe(1);
    expect(list.find((s) => s.id === s2.id)?.messageCount).toBe(0);
  });

  it("deleteSession removes the session file", async () => {
    const dir = tmpDir();
    const store = createSessionStore(dir);

    const session = await store.createSession();
    const filePath = join(dir, `${session.id}.json`);
    expect(existsSync(filePath)).toBe(true);

    await store.deleteSession(session.id);

    expect(existsSync(filePath)).toBe(false);
  });

  it("loadSession throws for missing id", async () => {
    const store = createSessionStore(tmpDir());

    await expect(store.loadSession("nonexistent")).rejects.toThrow("Session not found");
  });

  it("appendMessages throws for missing id", async () => {
    const store = createSessionStore(tmpDir());

    await expect(
      store.appendMessages("nonexistent", [{ role: "user", content: "hi" }]),
    ).rejects.toThrow("Session not found");
  });

  it("deleteSession throws for missing id", async () => {
    const store = createSessionStore(tmpDir());

    await expect(store.deleteSession("nonexistent")).rejects.toThrow("Session not found");
  });

  it("listSessions returns empty array for empty dir", async () => {
    const dir = tmpDir();
    const store = createSessionStore(dir);

    const list = await store.listSessions();
    expect(list).toEqual([]);
  });
});
