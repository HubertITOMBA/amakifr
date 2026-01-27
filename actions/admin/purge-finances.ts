"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

/**
 * Purge toutes les cotisations, dettes initiales, paiements et avoirs de tous les adhérents
 * ATTENTION: Cette opération est irréversible !
 */
export async function purgeAllFinancialData() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé" };
    }

    // Supprimer dans l'ordre pour respecter les contraintes de clés étrangères
    
    // 1. Supprimer les utilisations d'avoirs
    const utilisationsAvoir = await prisma.utilisationAvoir.deleteMany({});
    console.log(`[purgeAllFinancialData] ${utilisationsAvoir.count} utilisations d'avoirs supprimées`);

    // 2. Supprimer les avoirs
    const avoirs = await prisma.avoir.deleteMany({});
    console.log(`[purgeAllFinancialData] ${avoirs.count} avoirs supprimés`);

    // 3. Supprimer les paiements
    const paiements = await prisma.paiementCotisation.deleteMany({});
    console.log(`[purgeAllFinancialData] ${paiements.count} paiements supprimés`);

    // 4. Supprimer les assistances
    const assistances = await prisma.assistance.deleteMany({});
    console.log(`[purgeAllFinancialData] ${assistances.count} assistances supprimées`);

    // 5. Supprimer les cotisations mensuelles
    const cotisationsMensuelles = await prisma.cotisationMensuelle.deleteMany({});
    console.log(`[purgeAllFinancialData] ${cotisationsMensuelles.count} cotisations mensuelles supprimées`);

    // 6. Supprimer les obligations de cotisation
    const obligationsCotisation = await prisma.obligationCotisation.deleteMany({});
    console.log(`[purgeAllFinancialData] ${obligationsCotisation.count} obligations de cotisation supprimées`);

    // 7. Supprimer les dettes initiales
    const dettesInitiales = await prisma.detteInitiale.deleteMany({});
    console.log(`[purgeAllFinancialData] ${dettesInitiales.count} dettes initiales supprimées`);

    // 8. Supprimer les relances
    const relances = await prisma.relanceCotisationMensuelle.deleteMany({});
    console.log(`[purgeAllFinancialData] ${relances.count} relances supprimées`);

    return {
      success: true,
      message: `Purge terminée : ${utilisationsAvoir.count} utilisations d'avoirs, ${avoirs.count} avoirs, ${paiements.count} paiements, ${assistances.count} assistances, ${cotisationsMensuelles.count} cotisations mensuelles, ${obligationsCotisation.count} obligations, ${dettesInitiales.count} dettes initiales, ${relances.count} relances supprimés`,
      data: {
        utilisationsAvoir: utilisationsAvoir.count,
        avoirs: avoirs.count,
        paiements: paiements.count,
        assistances: assistances.count,
        cotisationsMensuelles: cotisationsMensuelles.count,
        obligationsCotisation: obligationsCotisation.count,
        dettesInitiales: dettesInitiales.count,
        relances: relances.count,
      },
    };
  } catch (error) {
    console.error("Erreur lors de la purge des données financières:", error);
    return { success: false, error: "Erreur lors de la purge des données financières" };
  } finally {
    revalidatePath("/admin");
  }
}

