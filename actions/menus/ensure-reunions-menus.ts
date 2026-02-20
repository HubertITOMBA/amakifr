"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

/**
 * S'assure que les menus "Réunions mensuelles" existent en NAVBAR et SIDEBAR.
 * À exécuter si les entrées n'apparaissent pas (seed non fait ou menus supprimés).
 */
export async function ensureReunionsMenus() {
  try {
    let created = 0;

    // 1. NAVBAR : Réunions mensuelles (visible par adhérents et admin)
    const existingNavbar = await db.menu.findFirst({
      where: {
        lien: "/reunions-mensuelles",
        niveau: "NAVBAR",
      },
    });
    if (!existingNavbar) {
      const maxOrdre = await db.menu.findFirst({
        where: { niveau: "NAVBAR" },
        orderBy: { ordre: "desc" },
        select: { ordre: true },
      });
      await db.menu.create({
        data: {
          libelle: "Réunions mensuelles",
          description: "Calendrier et gestion des réunions mensuelles",
          lien: "/reunions-mensuelles",
          niveau: "NAVBAR",
          roles: ["ADMIN", "MEMBRE"],
          icone: "Calendar",
          statut: true,
          ordre: (maxOrdre?.ordre ?? 0) + 1,
          electoral: false,
        },
      });
      created++;
    } else if (!existingNavbar.statut) {
      await db.menu.update({
        where: { id: existingNavbar.id },
        data: { statut: true },
      });
      created++;
    }

    // 2. SIDEBAR admin : Réunions Mensuelles
    const existingSidebarAdmin = await db.menu.findFirst({
      where: {
        lien: "/admin/reunions-mensuelles",
        niveau: "SIDEBAR",
      },
    });
    if (!existingSidebarAdmin) {
      const maxOrdre = await db.menu.findFirst({
        where: { niveau: "SIDEBAR" },
        orderBy: { ordre: "desc" },
        select: { ordre: true },
      });
      await db.menu.create({
        data: {
          libelle: "Réunions Mensuelles",
          description: "Gérer les réunions mensuelles (validation, hôte, dates)",
          lien: "/admin/reunions-mensuelles",
          niveau: "SIDEBAR",
          roles: ["ADMIN"],
          icone: "Calendar",
          statut: true,
          ordre: (maxOrdre?.ordre ?? 0) + 1,
          electoral: false,
        },
      });
      created++;
    } else if (!existingSidebarAdmin.statut) {
      await db.menu.update({
        where: { id: existingSidebarAdmin.id },
        data: { statut: true },
      });
      created++;
    }

    // 3. SIDEBAR membre : Réunions mensuelles (si l'adhérent a une vue avec sidebar)
    const existingSidebarMembre = await db.menu.findFirst({
      where: {
        lien: "/reunions-mensuelles",
        niveau: "SIDEBAR",
      },
    });
    if (!existingSidebarMembre) {
      const maxOrdre = await db.menu.findFirst({
        where: { niveau: "SIDEBAR" },
        orderBy: { ordre: "desc" },
        select: { ordre: true },
      });
      await db.menu.create({
        data: {
          libelle: "Réunions mensuelles",
          description: "Calendrier des réunions mensuelles",
          lien: "/reunions-mensuelles",
          niveau: "SIDEBAR",
          roles: ["MEMBRE"],
          icone: "Calendar",
          statut: true,
          ordre: (maxOrdre?.ordre ?? 0) + 1,
          electoral: false,
        },
      });
      created++;
    } else if (!existingSidebarMembre.statut) {
      await db.menu.update({
        where: { id: existingSidebarMembre.id },
        data: { statut: true },
      });
      created++;
    }

    revalidatePath("/");
    revalidatePath("/admin");
    return { success: true, message: `Menus Réunions mensuelles vérifiés. ${created} entrée(s) créée(s) ou réactivée(s).` };
  } catch (error) {
    console.error("Erreur ensure-reunions-menus:", error);
    return { success: false, error: "Erreur lors de la création des menus Réunions mensuelles." };
  }
}
