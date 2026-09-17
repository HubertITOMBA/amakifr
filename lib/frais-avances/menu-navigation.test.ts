import { beforeEach, describe, expect, it, vi } from "vitest";
import { FRAIS_AVANCES_MENU_SEEDS } from "@/lib/frais-avances/menu-seeds";
import {
  filterMenusByNotesFraisPublicHint,
  isFraisAvancesMenuLien,
} from "@/lib/frais-avances/menu-visibility";
import { upsertFraisAvancesMenusIdempotent } from "../../scripts/frais-avances-menus-upsert";

describe("menus frais avancés — seed et hint", () => {
  it("seed contient exactement 3 entrées et rôles attendus", () => {
    expect(FRAIS_AVANCES_MENU_SEEDS).toHaveLength(3);
    const byLien = Object.fromEntries(
      FRAIS_AVANCES_MENU_SEEDS.map((m) => [m.lien, m])
    );
    expect(byLien["/user/frais-avances"].roles).toEqual(
      expect.arrayContaining(["MEMBRE"])
    );
    expect(byLien["/admin/frais-avances"].roles.sort()).toEqual(
      ["ADMIN", "PRESID", "SECRET", "TRESOR"].sort()
    );
    expect(byLien["/admin/frais-avances/comptabilite"].roles.sort()).toEqual(
      ["ADMIN", "COMCPT", "TRESOR"].sort()
    );
    expect(byLien["/admin/frais-avances"].roles).not.toContain("COMCPT");
    expect(byLien["/admin/frais-avances/comptabilite"].roles).not.toContain(
      "PRESID"
    );
    expect(byLien["/admin/frais-avances/comptabilite"].roles).not.toContain(
      "SECRET"
    );
  });

  it("aucune occurrence ensure runtime dans le dépôt pages/actions", async () => {
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const roots = [
      "app/admin/frais-avances",
      "app/user/frais-avances",
      "actions/frais-avances",
      "actions/menus",
    ];
    const hits: string[] = [];
    function walk(dir: string) {
      let entries: string[] = [];
      try {
        entries = readdirSync(dir);
      } catch {
        return;
      }
      for (const name of entries) {
        const p = join(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name)) {
          const txt = readFileSync(p, "utf8");
          if (
            txt.includes("ensureFraisAvancesMenus") ||
            txt.includes("ensure-frais-avances-menus")
          ) {
            hits.push(p);
          }
        }
      }
    }
    for (const r of roots) walk(join(process.cwd(), r));
    expect(hits).toEqual([]);
  });

  it("seed upsert idempotent : 2e appel = updates seulement", async () => {
    const store = new Map<string, { id: string; roles: string[] }>();
    const client = {
      menu: {
        findFirst: vi.fn(async ({ where }: { where: { lien: string } }) => {
          const row = store.get(where.lien);
          return row ? { id: row.id, roles: row.roles, statut: true } : null;
        }),
        create: vi.fn(async ({ data }: { data: { lien: string; roles: string[] } }) => {
          const id = `id-${data.lien}`;
          store.set(data.lien, { id, roles: data.roles });
          return { id };
        }),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: { roles: string[] } }) => {
          for (const [lien, row] of store) {
            if (row.id === where.id) {
              store.set(lien, { id: row.id, roles: data.roles });
            }
          }
          return { id: where.id };
        }),
      },
    };

    const first = await upsertFraisAvancesMenusIdempotent(client as never);
    expect(first.created).toBe(3);
    expect(first.updated).toBe(0);
    const second = await upsertFraisAvancesMenusIdempotent(client as never);
    expect(second.created).toBe(0);
    expect(second.updated).toBe(3);
    expect(client.menu.create).toHaveBeenCalledTimes(3);
  });
});

describe("filterMenusByNotesFraisPublicHint", () => {
  const menus = [
    { lien: "/admin/users", libelle: "Users" },
    { lien: "/user/frais-avances", libelle: "Mes frais" },
    { lien: "/admin/frais-avances", libelle: "Live" },
    { lien: "/admin/frais-avances/comptabilite", libelle: "Compta" },
  ];

  it("flag public off masque les trois liens", () => {
    const prev = process.env.NEXT_PUBLIC_NOTES_FRAIS_ENABLED;
    delete process.env.NEXT_PUBLIC_NOTES_FRAIS_ENABLED;
    const filtered = filterMenusByNotesFraisPublicHint(menus);
    expect(filtered.map((m) => m.lien)).toEqual(["/admin/users"]);
    expect(isFraisAvancesMenuLien("/admin/frais-avances/archives")).toBe(true);
    if (prev === undefined) delete process.env.NEXT_PUBLIC_NOTES_FRAIS_ENABLED;
    else process.env.NEXT_PUBLIC_NOTES_FRAIS_ENABLED = prev;
  });

  it("flag on conserve les liens (affichage hint, pas authz)", () => {
    const prev = process.env.NEXT_PUBLIC_NOTES_FRAIS_ENABLED;
    process.env.NEXT_PUBLIC_NOTES_FRAIS_ENABLED = "true";
    const filtered = filterMenusByNotesFraisPublicHint(menus);
    expect(filtered).toHaveLength(4);
    if (prev === undefined) delete process.env.NEXT_PUBLIC_NOTES_FRAIS_ENABLED;
    else process.env.NEXT_PUBLIC_NOTES_FRAIS_ENABLED = prev;
  });
});
