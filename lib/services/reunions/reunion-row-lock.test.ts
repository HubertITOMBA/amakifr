import { describe, expect, it, vi } from "vitest";
import {
  assertReunionAllowsParticipationWrite,
  lockParticipationRowsSequentially,
  lockReunionRowForUpdate,
  ReunionParticipationNotWritableError,
  sortAdherentIdsDeterministic,
  sortParticipationDeltaByAdherentId,
  withReunionParticipationLocks,
  withReunionRowLock,
} from "@/lib/services/reunions/reunion-row-lock";

describe("ordre de verrouillage déterministe", () => {
  it("trie adherentId ASC", () => {
    expect(sortAdherentIdsDeterministic(["z", "a", "m", "a"])).toEqual([
      "a",
      "m",
      "z",
    ]);
  });

  it("trie le delta admin par adherentId", () => {
    expect(
      sortParticipationDeltaByAdherentId([
        { adherentId: "b", statut: "Present" },
        { adherentId: "a", statut: "Absent" },
      ]).map((x) => x.adherentId)
    ).toEqual(["a", "b"]);
  });
});

describe("assertReunionAllowsParticipationWrite", () => {
  const now = new Date("2026-06-15T12:00:00.000Z");

  it("refuse Annulee", () => {
    expect(() =>
      assertReunionAllowsParticipationWrite(
        {
          id: "r1",
          statut: "Annulee",
          dateReunion: new Date("2026-07-01T12:00:00.000Z"),
        },
        now
      )
    ).toThrow(ReunionParticipationNotWritableError);
  });

  it("refuse date passée (jour civil Paris)", () => {
    expect(() =>
      assertReunionAllowsParticipationWrite(
        {
          id: "r1",
          statut: "DateConfirmee",
          dateReunion: new Date("2026-01-01T12:00:00.000Z"),
        },
        now
      )
    ).toThrow(/passée/);
  });

  it("accepte DateConfirmee future", () => {
    expect(() =>
      assertReunionAllowsParticipationWrite(
        {
          id: "r1",
          statut: "DateConfirmee",
          dateReunion: new Date("2026-07-01T12:00:00.000Z"),
        },
        now
      )
    ).not.toThrow();
  });
});

describe("withReunionParticipationLocks — ordre verrou → relecture → écriture", () => {
  it("appelle FOR UPDATE réunion, puis findUnique, puis participations, puis run", async () => {
    const order: string[] = [];
    const queryRaw = vi.fn(async (strings: TemplateStringsArray) => {
      const sql = strings.join("?");
      if (sql.includes("reunions_mensuelles")) {
        order.push("lock-reunion");
        return [{ id: "r1" }];
      }
      order.push("lock-participation");
      return [];
    });
    const findUnique = vi.fn(async () => {
      order.push("reload-reunion");
      return {
        id: "r1",
        statut: "DateConfirmee",
        dateReunion: new Date("2026-07-01T12:00:00.000Z"),
      };
    });

    const tx = {
      $queryRaw: queryRaw,
      reunionMensuelle: { findUnique, update: vi.fn() },
    };

    await withReunionParticipationLocks(
      tx,
      "r1",
      ["adh-b", "adh-a"],
      async () => {
        order.push("write");
        return "ok";
      },
      new Date("2026-06-15T12:00:00.000Z")
    );

    expect(order[0]).toBe("lock-reunion");
    expect(order[1]).toBe("reload-reunion");
    // participations triées a puis b
    expect(order.filter((x) => x === "lock-participation")).toHaveLength(2);
    expect(order[order.length - 1]).toBe("write");
  });

  it("refuse si statut Annulee après relecture sous verrou", async () => {
    const tx = {
      $queryRaw: vi.fn(async () => [{ id: "r1" }]),
      reunionMensuelle: {
        findUnique: vi.fn(async () => ({
          id: "r1",
          statut: "Annulee",
          dateReunion: new Date("2026-07-01T12:00:00.000Z"),
        })),
        update: vi.fn(),
      },
    };

    await expect(
      withReunionParticipationLocks(tx, "r1", ["a1"], async () => "x")
    ).rejects.toBeInstanceOf(ReunionParticipationNotWritableError);
  });
});

describe("withReunionRowLock", () => {
  it("verrouille avant le callback writers", async () => {
    const order: string[] = [];
    const tx = {
      $queryRaw: vi.fn(async () => {
        order.push("lock");
        return [{ id: "r1" }];
      }),
      reunionMensuelle: { findUnique: vi.fn(), update: vi.fn() },
    };

    await withReunionRowLock(tx, "r1", async () => {
      order.push("run");
      return 1;
    });

    expect(order).toEqual(["lock", "run"]);
  });

  it("lockReunionRowForUpdate retourne false si absent", async () => {
    const tx = { $queryRaw: vi.fn(async () => []) };
    expect(await lockReunionRowForUpdate(tx, "missing")).toBe(false);
  });
});

describe("lockParticipationRowsSequentially", () => {
  it("émet FOR UPDATE dans l'ordre adherentId ASC", async () => {
    const seen: string[] = [];
    const tx = {
      $queryRaw: vi.fn(async (_s: TemplateStringsArray, _r: string, adh: string) => {
        seen.push(adh);
        return [];
      }),
    };
    await lockParticipationRowsSequentially(tx, "r1", ["c", "a", "b"]);
    expect(seen).toEqual(["a", "b", "c"]);
  });
});
