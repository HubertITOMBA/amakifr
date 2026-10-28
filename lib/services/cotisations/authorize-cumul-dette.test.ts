import { describe, expect, it, vi } from "vitest";
import { authorizeCumulDetteAccess } from "@/lib/services/cotisations/authorize-cumul-dette";

describe("authorizeCumulDetteAccess (ownership)", () => {
  it("session absente → refus", async () => {
    const resolveSelfAdherentId = vi.fn();
    const canReadAdherentFinancialItems = vi.fn();

    const r = await authorizeCumulDetteAccess(null, "adh-B", {
      resolveSelfAdherentId,
      canReadAdherentFinancialItems,
    });
    expect(r).toEqual({ ok: false });
    expect(resolveSelfAdherentId).not.toHaveBeenCalled();
    expect(canReadAdherentFinancialItems).not.toHaveBeenCalled();
  });

  it("session vide → refus", async () => {
    const r = await authorizeCumulDetteAccess("  ", "adh-B", {
      resolveSelfAdherentId: vi.fn(),
      canReadAdherentFinancialItems: vi.fn(),
    });
    expect(r).toEqual({ ok: false });
  });

  it("self autorisé (même adherentId)", async () => {
    const resolveSelfAdherentId = vi.fn().mockResolvedValue("adh-A");
    const canReadAdherentFinancialItems = vi.fn();

    const r = await authorizeCumulDetteAccess("user-A", "adh-A", {
      resolveSelfAdherentId,
      canReadAdherentFinancialItems,
    });
    expect(r).toEqual({ ok: true, mode: "self" });
    expect(resolveSelfAdherentId).toHaveBeenCalledWith("user-A");
    expect(canReadAdherentFinancialItems).not.toHaveBeenCalled();
  });

  it("tiers non autorisé → refus (canRead false)", async () => {
    const resolveSelfAdherentId = vi.fn().mockResolvedValue("adh-A");
    const canReadAdherentFinancialItems = vi.fn().mockResolvedValue(false);

    const r = await authorizeCumulDetteAccess("user-A", "adh-B", {
      resolveSelfAdherentId,
      canReadAdherentFinancialItems,
    });
    expect(r).toEqual({ ok: false });
    expect(canReadAdherentFinancialItems).toHaveBeenCalledWith("user-A");
  });

  it("rôle administratif via canRead(getAdherentFinancialItems) → autorisé", async () => {
    const resolveSelfAdherentId = vi.fn().mockResolvedValue("adh-A");
    const canReadAdherentFinancialItems = vi.fn().mockResolvedValue(true);

    const r = await authorizeCumulDetteAccess("user-admin", "adh-B", {
      resolveSelfAdherentId,
      canReadAdherentFinancialItems,
    });
    expect(r).toEqual({ ok: true, mode: "admin" });
  });

  it("admin sans fiche adhérent peut lire un tiers si canRead OK", async () => {
    const resolveSelfAdherentId = vi.fn().mockResolvedValue(null);
    const canReadAdherentFinancialItems = vi.fn().mockResolvedValue(true);

    const r = await authorizeCumulDetteAccess("user-admin", "adh-B", {
      resolveSelfAdherentId,
      canReadAdherentFinancialItems,
    });
    expect(r).toEqual({ ok: true, mode: "admin" });
  });

  it("utilisateur sans canRead et sans match self → refus", async () => {
    const resolveSelfAdherentId = vi.fn().mockResolvedValue(null);
    const canReadAdherentFinancialItems = vi.fn().mockResolvedValue(false);

    const r = await authorizeCumulDetteAccess("user-x", "adh-B", {
      resolveSelfAdherentId,
      canReadAdherentFinancialItems,
    });
    expect(r).toEqual({ ok: false });
  });

  it("targetAdherentId vide → refus", async () => {
    const r = await authorizeCumulDetteAccess("user-A", "", {
      resolveSelfAdherentId: vi.fn(),
      canReadAdherentFinancialItems: vi.fn(),
    });
    expect(r).toEqual({ ok: false });
  });
});
