import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth } = vi.hoisted(() => ({
  auth: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth }));

import { resolveApiActorFromWebSession } from "@/lib/api/auth-web";

describe("resolveApiActorFromWebSession", () => {
  beforeEach(() => {
    auth.mockReset();
  });

  it("retourne null si session absente", async () => {
    auth.mockResolvedValue(null);
    await expect(resolveApiActorFromWebSession()).resolves.toBeNull();
  });

  it("retourne null si session sans user", async () => {
    auth.mockResolvedValue({});
    await expect(resolveApiActorFromWebSession()).resolves.toBeNull();
  });

  it("retourne null si session.user.id absent/vide", async () => {
    auth.mockResolvedValue({
      user: { id: "", role: "MEMBRE", status: "Actif" },
    });
    await expect(resolveApiActorFromWebSession()).resolves.toBeNull();

    auth.mockResolvedValue({
      user: { role: "MEMBRE", status: "Actif" },
    });
    await expect(resolveApiActorFromWebSession()).resolves.toBeNull();
  });

  it("conserve et normalise un rôle réel", async () => {
    auth.mockResolvedValue({
      user: {
        id: "user-1",
        role: "  admin ",
        status: "Actif",
        email: "a@example.com",
        name: "Ada",
        sessionId: "session_abc",
      },
    });
    const actor = await resolveApiActorFromWebSession();
    expect(actor).toMatchObject({
      userId: "user-1",
      role: "ADMIN",
      status: "Actif",
      email: "a@example.com",
      name: "Ada",
      sessionId: "session_abc",
      channel: "web",
    });
  });

  it("fail closed si rôle absent (pas de fallback MEMBRE)", async () => {
    auth.mockResolvedValue({
      user: { id: "user-1", status: "Actif" },
    });
    await expect(resolveApiActorFromWebSession()).resolves.toBeNull();

    auth.mockResolvedValue({
      user: { id: "user-1", role: "   ", status: "Actif" },
    });
    await expect(resolveApiActorFromWebSession()).resolves.toBeNull();
  });

  it("conserve un status réel", async () => {
    auth.mockResolvedValue({
      user: { id: "user-1", role: "MEMBRE", status: "Inactif" },
    });
    const actor = await resolveApiActorFromWebSession();
    expect(actor?.status).toBe("Inactif");
  });

  it("fail closed si status absent (pas de Actif inventé)", async () => {
    auth.mockResolvedValue({
      user: { id: "user-1", role: "MEMBRE" },
    });
    await expect(resolveApiActorFromWebSession()).resolves.toBeNull();

    auth.mockResolvedValue({
      user: { id: "user-1", role: "MEMBRE", status: "" },
    });
    await expect(resolveApiActorFromWebSession()).resolves.toBeNull();
  });

  it("propage sessionId réel ou null", async () => {
    auth.mockResolvedValue({
      user: {
        id: "user-1",
        role: "MEMBRE",
        status: "Actif",
        sessionId: "jti-1",
      },
    });
    expect((await resolveApiActorFromWebSession())?.sessionId).toBe("jti-1");

    auth.mockResolvedValue({
      user: { id: "user-1", role: "MEMBRE", status: "Actif" },
    });
    expect((await resolveApiActorFromWebSession())?.sessionId).toBeNull();
  });

  it("conserve email/name réels (null si absents)", async () => {
    auth.mockResolvedValue({
      user: { id: "user-1", role: "MEMBRE", status: "Actif" },
    });
    const actor = await resolveApiActorFromWebSession();
    expect(actor?.email).toBeNull();
    expect(actor?.name).toBeNull();
  });

  it("fixe adminRoles=[] et adherentId=null comme non résolus", async () => {
    auth.mockResolvedValue({
      user: { id: "user-1", role: "MEMBRE", status: "Actif" },
    });
    const actor = await resolveApiActorFromWebSession();
    expect(actor?.adminRoles).toEqual([]);
    expect(actor?.adherentId).toBeNull();
  });
});
