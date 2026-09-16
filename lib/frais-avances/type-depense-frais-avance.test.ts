import { describe, expect, it } from "vitest";
import {
  TYPE_DEPENSE_CODE_FRAIS_AVANCE,
  ensureTypeDepenseFraisAvanceForTests,
} from "@/lib/frais-avances/type-depense-frais-avance";

describe("ensureTypeDepenseFraisAvanceForTests", () => {
  it("crée une fois puis réutilise (idempotent)", async () => {
    const created: unknown[] = [];
    let stored: {
      id: string;
      code: string;
      actif: boolean;
      titre: string;
    } | null = null;

    const client = {
      typeDepense: {
        findFirst: async () => stored,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          stored = {
            id: "td1",
            code: String(data.code),
            actif: Boolean(data.actif),
            titre: String(data.titre),
          };
          created.push(data);
          return stored;
        },
        update: async ({ data }: { data: { actif: boolean } }) => {
          stored = { ...stored!, actif: data.actif };
          return stored;
        },
      },
    };

    const a = await ensureTypeDepenseFraisAvanceForTests(
      client as never,
      "user1"
    );
    const b = await ensureTypeDepenseFraisAvanceForTests(
      client as never,
      "user1"
    );
    expect(a.id).toBe(b.id);
    expect(created).toHaveLength(1);
    expect(a.code).toBe(TYPE_DEPENSE_CODE_FRAIS_AVANCE);
  });

  it("réactive un type inactif", async () => {
    let stored = {
      id: "td1",
      code: TYPE_DEPENSE_CODE_FRAIS_AVANCE,
      actif: false,
      titre: "Frais avancés",
    };
    const client = {
      typeDepense: {
        findFirst: async () => stored,
        create: async () => {
          throw new Error("ne doit pas créer");
        },
        update: async ({ data }: { data: { actif: boolean } }) => {
          stored = { ...stored, actif: data.actif };
          return stored;
        },
      },
    };
    const r = await ensureTypeDepenseFraisAvanceForTests(
      client as never,
      "user1"
    );
    expect(r.actif).toBe(true);
  });
});
