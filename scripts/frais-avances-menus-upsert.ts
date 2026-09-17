/**
 * Upsert idempotent des menus frais avancés — seed CLI uniquement.
 * Ne jamais importer depuis une page ou Server Action runtime.
 */
import type { PrismaClient } from "@prisma/client";
import { FRAIS_AVANCES_MENU_SEEDS } from "../lib/frais-avances/menu-seeds";

type MenuClient = Pick<PrismaClient, "menu">;

/**
 * Aligne les 3 entrées (lien + niveau) sans doublon opportuniste runtime.
 *
 * @param client - Client Prisma
 */
export async function upsertFraisAvancesMenusIdempotent(
  client: MenuClient
): Promise<{ updated: number; created: number }> {
  let updated = 0;
  let created = 0;
  for (const seed of FRAIS_AVANCES_MENU_SEEDS) {
    const existing = await client.menu.findFirst({
      where: { lien: seed.lien, niveau: seed.niveau },
    });
    if (existing) {
      await client.menu.update({
        where: { id: existing.id },
        data: {
          libelle: seed.libelle,
          description: seed.description,
          roles: seed.roles,
          icone: seed.icone,
          statut: true,
          ordre: seed.ordre,
          electoral: false,
        },
      });
      updated += 1;
      continue;
    }
    await client.menu.create({
      data: {
        ...seed,
        createdBy: null,
      },
    });
    created += 1;
  }
  return { updated, created };
}
