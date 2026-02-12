"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { TypeCotisation } from "@prisma/client";
import jsPDF from "jspdf";
import { buildLettreRelancePDF } from "@/lib/lettre-relance-pdf";
import type { RappelDetailleData } from "@/lib/mail";

/**
 * Génère le PDF de la lettre de relance.
 * - Si adherentId est fourni : pré-remplit coordonnées + détail des dettes/forfaits/assistances.
 * - Si adherentId est absent : modèle vierge (coordonnées et montant à remplir à la main).
 */
export async function getLettreRelancePDF(adherentId?: string | null) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé" };
    }

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    let coordonnees: import("@/lib/lettre-relance-pdf").CoordonneesDestinataire | undefined;
    let data: RappelDetailleData | undefined;
    let fileName = "lettre_relance_cotisations.pdf";

    if (adherentId) {
      const adherent = await prisma.adherent.findUnique({
        where: { id: adherentId },
        include: {
          User: { select: { email: true } },
          Adresse: true,
          Telephones: true,
          ObligationsCotisation: {
            where: { statut: { in: ["EnAttente", "PartiellementPaye", "EnRetard"] } },
            orderBy: { dateEcheance: "asc" },
          },
          DettesInitiales: { where: { montantRestant: { gt: 0 } } },
        },
      });

      if (!adherent) {
        return { success: false, error: "Adhérent non trouvé" };
      }

      const detteObligations = adherent.ObligationsCotisation.reduce(
        (s, ob) => s + Number(ob.montantRestant),
        0
      );
      const detteInitiale = adherent.DettesInitiales.reduce(
        (s, d) => s + Number(d.montantRestant),
        0
      );
      const totalDette = detteObligations + detteInitiale;

      const forfaits = adherent.ObligationsCotisation.filter((ob) => ob.type === TypeCotisation.Forfait);
      const assistances = adherent.ObligationsCotisation.filter((ob) => ob.type === TypeCotisation.Assistance);
      const prochaineEcheance = adherent.ObligationsCotisation[0]?.dateEcheance ?? null;
      const now = new Date();
      const joursRestants =
        prochaineEcheance != null
          ? Math.floor((prochaineEcheance.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null;

      data = {
        dettesInitiales: adherent.DettesInitiales.map((d) => ({
          annee: d.annee,
          montantRestant: Number(d.montantRestant),
          description: d.description,
        })),
        forfaitsNonPayes: forfaits.map((ob) => ({
          periode: ob.periode,
          montantRestant: Number(ob.montantRestant),
          dateEcheance: ob.dateEcheance,
        })),
        assistancesNonPayees: assistances.map((ob) => ({
          periode: ob.periode,
          montantRestant: Number(ob.montantRestant),
          dateEcheance: ob.dateEcheance,
          description: ob.description,
        })),
        total: totalDette,
        prochaineEcheance,
        joursRestants,
      };

      const adr = adherent.Adresse?.[0];
      const tel = adherent.Telephones?.find((t) => t.numero)?.numero;
      coordonnees = {
        nom: adherent.lastname,
        prenom: adherent.firstname,
        adresseLigne1: adr?.label ?? [adr?.streetnum, adr?.street1].filter(Boolean).join(" ") ?? adr?.street1 ?? undefined,
        adresseLigne2: adr?.street2 ?? undefined,
        codePostal: adr?.codepost ?? adr?.postcode ?? undefined,
        ville: adr?.city ?? undefined,
        email: adherent.User?.email ?? undefined,
        telephone: tel ?? undefined,
      };

      fileName = `lettre_relance_${adherent.firstname}_${adherent.lastname}.pdf`.replace(/\s+/g, "_");
    }

    buildLettreRelancePDF(doc, {
      coordonnees: coordonnees ?? null,
      data: data ?? null,
    });

    const pdfOutput = doc.output("datauristring");
    return { success: true, fileName, pdfData: pdfOutput };
  } catch (error) {
    console.error("Erreur génération lettre de relance PDF:", error);
    return { success: false, error: "Erreur lors de la génération du PDF" };
  }
}
