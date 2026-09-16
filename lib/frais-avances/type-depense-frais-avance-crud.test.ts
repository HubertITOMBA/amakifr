import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  TYPE_DEPENSE_CODE_FRAIS_AVANCE,
  TYPE_DEPENSE_FRAIS_AVANCE_PROTECTED,
  isTypeDepenseFraisAvanceCode,
} from "@/lib/frais-avances/type-depense-frais-avance";

const {
  authMock,
  findUnique,
  update,
  deleteFn,
  count,
  create,
  findMany,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  deleteFn: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: (...a: unknown[]) => authMock(...a),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    typeDepense: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      update: (...a: unknown[]) => update(...a),
      delete: (...a: unknown[]) => deleteFn(...a),
      create: (...a: unknown[]) => create(...a),
      findMany: (...a: unknown[]) => findMany(...a),
    },
    depense: {
      count: (...a: unknown[]) => count(...a),
    },
  },
}));

vi.mock("@/lib/activity-logger", () => ({
  logCreation: vi.fn(),
  logModification: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  deleteTypeDepense,
  updateTypeDepense,
} from "@/actions/depenses/types";

describe("isTypeDepenseFraisAvanceCode", () => {
  it("identifie exclusivement par code (jamais par titre)", () => {
    expect(isTypeDepenseFraisAvanceCode(TYPE_DEPENSE_CODE_FRAIS_AVANCE)).toBe(
      true
    );
    expect(isTypeDepenseFraisAvanceCode("Frais avancés")).toBe(false);
    expect(isTypeDepenseFraisAvanceCode("frais_avance")).toBe(false);
    expect(isTypeDepenseFraisAvanceCode(null)).toBe(false);
    expect(isTypeDepenseFraisAvanceCode(undefined)).toBe(false);
  });
});

describe("CRUD TypeDepense — protection FRAIS_AVANCE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: "admin1", role: "ADMIN" },
    });
  });

  it("refuse la suppression FRAIS_AVANCE sans Depense", async () => {
    findUnique.mockResolvedValue({
      id: "td-fa",
      code: TYPE_DEPENSE_CODE_FRAIS_AVANCE,
    });
    const res = await deleteTypeDepense("td-fa");
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe(TYPE_DEPENSE_FRAIS_AVANCE_PROTECTED);
    }
    expect(count).not.toHaveBeenCalled();
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it("refuse la suppression FRAIS_AVANCE même avec Depenses", async () => {
    findUnique.mockResolvedValue({
      id: "td-fa",
      code: TYPE_DEPENSE_CODE_FRAIS_AVANCE,
    });
    count.mockResolvedValue(3);
    const res = await deleteTypeDepense("td-fa");
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe(TYPE_DEPENSE_FRAIS_AVANCE_PROTECTED);
    }
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it("ne protège pas un type ordinaire portant un titre trompeur", async () => {
    findUnique.mockResolvedValue({
      id: "td-ord",
      code: null,
    });
    count.mockResolvedValue(0);
    deleteFn.mockResolvedValue({});
    const res = await deleteTypeDepense("td-ord");
    expect(res.success).toBe(true);
    expect(deleteFn).toHaveBeenCalled();
  });

  it("refuse actif=false sur FRAIS_AVANCE", async () => {
    findUnique.mockResolvedValue({
      id: "td-fa",
      code: TYPE_DEPENSE_CODE_FRAIS_AVANCE,
    });
    const res = await updateTypeDepense({
      id: "td-fa",
      actif: false,
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe(TYPE_DEPENSE_FRAIS_AVANCE_PROTECTED);
    }
    expect(update).not.toHaveBeenCalled();
  });

  it("autorise titre/description sur FRAIS_AVANCE sans toucher actif/code", async () => {
    findUnique.mockResolvedValue({
      id: "td-fa",
      code: TYPE_DEPENSE_CODE_FRAIS_AVANCE,
    });
    update.mockResolvedValue({
      id: "td-fa",
      code: TYPE_DEPENSE_CODE_FRAIS_AVANCE,
      titre: "Nouveau libellé",
      description: "d",
      actif: true,
      CreatedBy: { id: "admin1", email: "a@x" },
      _count: { Depenses: 0 },
    });
    const res = await updateTypeDepense({
      id: "td-fa",
      titre: "Nouveau libellé",
      description: "d",
    });
    expect(res.success).toBe(true);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "td-fa" },
        data: { titre: "Nouveau libellé", description: "d" },
      })
    );
    const dataArg = update.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(dataArg).not.toHaveProperty("code");
    expect(dataArg).not.toHaveProperty("actif");
  });

  it("type ordinaire : désactivation et suppression selon règles existantes", async () => {
    findUnique.mockResolvedValue({ id: "td-o", code: null });
    update.mockResolvedValue({
      id: "td-o",
      code: null,
      actif: false,
      titre: "Ordinaire",
      CreatedBy: { id: "admin1", email: "a@x" },
      _count: { Depenses: 0 },
    });
    const upd = await updateTypeDepense({ id: "td-o", actif: false });
    expect(upd.success).toBe(true);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actif: false }),
      })
    );

    count.mockResolvedValue(0);
    deleteFn.mockResolvedValue({});
    const del = await deleteTypeDepense("td-o");
    expect(del.success).toBe(true);

    count.mockResolvedValue(2);
    const delBlocked = await deleteTypeDepense("td-o");
    expect(delBlocked.success).toBe(false);
    if (!delBlocked.success) {
      expect(delBlocked.error).toMatch(/utilisé dans 2 dépense/);
    }
  });
});
