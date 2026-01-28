"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { UserRole, MoyenPaiement, TypeEvenementFamilial } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Schéma de validation pour créer une dette initiale
 */
const CreateDetteInitialeSchema = z.object({
  adherentId: z.string().min(1, "L'ID de l'adhérent est requis"),
  annee: z.number().int().min(2020).max(2100, "L'année doit être valide"),
  montant: z.number().positive("Le montant doit être positif"),
  description: z.string().optional(),
});

/**
 * Crée une dette initiale pour un adhérent
 */
export async function createDetteInitiale(data: z.infer<typeof CreateDetteInitialeSchema>) {
try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier la permission dynamique
    const { canWrite } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canWrite(session.user.id, "createDetteInitiale");
    if (!hasAccess) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = CreateDetteInitialeSchema.parse(data);

    // Vérifier si une dette existe déjà pour cette année
    const existing = await prisma.detteInitiale.findUnique({
      where: {
        adherentId_annee: {
          adherentId: validatedData.adherentId,
          annee: validatedData.annee,
        },
      },
    });

    if (existing) {
      return { success: false, error: `Une dette existe déjà pour l'année ${validatedData.annee}` };
    }

    const dette = await prisma.detteInitiale.create({
      data: {
        adherentId: validatedData.adherentId,
        annee: validatedData.annee,
        montant: new Decimal(validatedData.montant),
        montantPaye: new Decimal(0),
        montantRestant: new Decimal(validatedData.montant),
        description: validatedData.description,
        createdBy: session.user.id,
      },
      include: {
        Adherent: {
          include: {
            User: true,
          },
        },
      },
    });

    // Logger l'activité
    try {
      await logCreation(
        `Création d'une dette initiale de ${validatedData.montant}€ pour ${validatedData.annee}`,
        "DetteInitiale",
        dette.id,
        {
          annee: validatedData.annee,
          montant: validatedData.montant,
          adherentId: validatedData.adherentId,
        }
      );
    } catch (logError) {
      console.error("Erreur lors du logging de l'activité:", logError);
      // Ne pas bloquer la création si le logging échoue
    }

    return {
      success: true,
      message: `Dette initiale de ${validatedData.montant}€ créée pour ${validatedData.annee}`,
      data: {
        ...dette,
        montant: Number(dette.montant),
        montantPaye: Number(dette.montantPaye),
        montantRestant: Number(dette.montantRestant),
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la création de la dette initiale:", error);
    return { success: false, error: "Erreur lors de la création de la dette initiale" };
  } finally {
    revalidatePath("/admin");
  }
}

/**
 * Schéma de validation pour créer un paiement
 */
const CreatePaiementSchema = z.object({
  adherentId: z.string().min(1, "L'ID de l'adhérent est requis"),
  montant: z.number().positive("Le montant doit être positif"),
  datePaiement: z.string().optional(), // ISO string
  moyenPaiement: z.enum(["Especes", "Cheque", "Virement", "CarteBancaire"]),
  reference: z.string().optional(),
  description: z.string().optional(),
  // Liens optionnels
  obligationCotisationId: z.string().optional(),
  cotisationMensuelleId: z.string().optional(),
  detteInitialeId: z.string().optional(),
  assistanceId: z.string().optional(),
});

/**
 * Applique automatiquement les avoirs disponibles sur une cotisation/dette/assistance
 */
export async function appliquerAvoirs(
  adherentId: string,
  montantDu: Decimal,
  type: 'cotisationMensuelle' | 'detteInitiale' | 'assistance' | 'obligationCotisation',
  id: string
) {
  let montantRestant = montantDu;
  const avoirsDisponibles = await prisma.avoir.findMany({
    where: {
      adherentId,
      statut: "Disponible",
      montantRestant: { gt: 0 },
    },
    orderBy: {
      createdAt: 'asc', // Utiliser les plus anciens en premier
    },
  });

  for (const avoir of avoirsDisponibles) {
    if (montantRestant.lte(0)) break;

    const montantAUtiliser = Decimal.min(avoir.montantRestant, montantRestant);
    const nouveauMontantUtilise = new Decimal(avoir.montantUtilise).plus(montantAUtiliser);
    const nouveauMontantRestant = new Decimal(avoir.montantRestant).minus(montantAUtiliser);
    const nouveauStatut = nouveauMontantRestant.lte(0) ? "Utilise" : "Disponible";

    // Créer l'utilisation de l'avoir
    await prisma.utilisationAvoir.create({
      data: {
        avoirId: avoir.id,
        montant: montantAUtiliser,
        cotisationMensuelleId: type === 'cotisationMensuelle' ? id : null,
        obligationCotisationId: type === 'obligationCotisation' ? id : null,
        detteInitialeId: type === 'detteInitiale' ? id : null,
        assistanceId: type === 'assistance' ? id : null,
        description: `Utilisation automatique pour ${type}`,
      },
    });

    // Mettre à jour l'avoir
    await prisma.avoir.update({
      where: { id: avoir.id },
      data: {
        montantUtilise: nouveauMontantUtilise,
        montantRestant: nouveauMontantRestant,
        statut: nouveauStatut,
      },
    });

    montantRestant = montantRestant.minus(montantAUtiliser);
  }

  return montantRestant;
}

/**
 * Enregistre un paiement et met à jour les montants payés/restants
 * Gère automatiquement les excédents en créant des avoirs
 */
export async function createPaiement(data: z.infer<typeof CreatePaiementSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = CreatePaiementSchema.parse(data);
    const montantPaiement = new Decimal(validatedData.montant);
    const datePaiement = validatedData.datePaiement ? new Date(validatedData.datePaiement) : new Date();

    let montantRestantAPayer = montantPaiement;
    let avoirCree: any = null;
    let montantEffectivementPaye = new Decimal(0);

    // Mettre à jour les montants selon le type de paiement et appliquer les avoirs
    if (validatedData.cotisationMensuelleId) {
      const cotisation = await prisma.cotisationMensuelle.findUnique({
        where: { id: validatedData.cotisationMensuelleId },
      });

      if (cotisation) {
        // Appliquer d'abord les avoirs disponibles
        const montantApresAvoirs = await appliquerAvoirs(
          validatedData.adherentId,
          cotisation.montantRestant,
          'cotisationMensuelle',
          validatedData.cotisationMensuelleId
        );

        // Calculer le montant réellement payé avec le paiement
        montantEffectivementPaye = Decimal.min(montantPaiement, montantApresAvoirs);
        const nouveauMontantPaye = new Decimal(cotisation.montantPaye).plus(montantEffectivementPaye);
        const nouveauMontantRestant = montantApresAvoirs.minus(montantEffectivementPaye);
        const excédent = montantPaiement.minus(montantEffectivementPaye);
        const nouveauStatut =
          nouveauMontantRestant.lte(0) ? "Paye" : nouveauMontantPaye.gt(0) ? "PartiellementPaye" : "EnAttente";

        await prisma.cotisationMensuelle.update({
          where: { id: validatedData.cotisationMensuelleId },
          data: {
            montantPaye: nouveauMontantPaye,
            montantRestant: nouveauMontantRestant.gt(0) ? nouveauMontantRestant : new Decimal(0),
            statut: nouveauStatut,
          },
        });

        montantRestantAPayer = excédent;
      }
    } else if (validatedData.detteInitialeId) {
      const dette = await prisma.detteInitiale.findUnique({
        where: { id: validatedData.detteInitialeId },
      });

      if (dette) {
        const montantApresAvoirs = await appliquerAvoirs(
          validatedData.adherentId,
          dette.montantRestant,
          'detteInitiale',
          validatedData.detteInitialeId
        );

        montantEffectivementPaye = Decimal.min(montantPaiement, montantApresAvoirs);
        const nouveauMontantPaye = new Decimal(dette.montantPaye).plus(montantEffectivementPaye);
        const nouveauMontantRestant = montantApresAvoirs.minus(montantEffectivementPaye);
        const excédent = montantPaiement.minus(montantEffectivementPaye);

        await prisma.detteInitiale.update({
          where: { id: validatedData.detteInitialeId },
          data: {
            montantPaye: nouveauMontantPaye,
            montantRestant: nouveauMontantRestant.gt(0) ? nouveauMontantRestant : new Decimal(0),
          },
        });

        montantRestantAPayer = excédent;
      }
    } else if (validatedData.assistanceId) {
      const assistance = await prisma.assistance.findUnique({
        where: { id: validatedData.assistanceId },
      });

      if (assistance) {
        const montantApresAvoirs = await appliquerAvoirs(
          validatedData.adherentId,
          assistance.montantRestant,
          'assistance',
          validatedData.assistanceId
        );

        montantEffectivementPaye = Decimal.min(montantPaiement, montantApresAvoirs);
        const nouveauMontantPaye = new Decimal(assistance.montantPaye).plus(montantEffectivementPaye);
        const nouveauMontantRestant = montantApresAvoirs.minus(montantEffectivementPaye);
        const excédent = montantPaiement.minus(montantEffectivementPaye);
        const nouveauStatut = nouveauMontantRestant.lte(0) ? "Paye" : "EnAttente";

        await prisma.assistance.update({
          where: { id: validatedData.assistanceId },
          data: {
            montantPaye: nouveauMontantPaye,
            montantRestant: nouveauMontantRestant.gt(0) ? nouveauMontantRestant : new Decimal(0),
            statut: nouveauStatut,
          },
        });

        montantRestantAPayer = excédent;
      }
    } else if (validatedData.obligationCotisationId) {
      const obligation = await prisma.obligationCotisation.findUnique({
        where: { id: validatedData.obligationCotisationId },
      });

      if (obligation) {
        const montantApresAvoirs = await appliquerAvoirs(
          validatedData.adherentId,
          obligation.montantRestant,
          'obligationCotisation',
          validatedData.obligationCotisationId
        );

        montantEffectivementPaye = Decimal.min(montantPaiement, montantApresAvoirs);
        const nouveauMontantPaye = new Decimal(obligation.montantPaye).plus(montantEffectivementPaye);
        const nouveauMontantRestant = montantApresAvoirs.minus(montantEffectivementPaye);
        const excédent = montantPaiement.minus(montantEffectivementPaye);
        const nouveauStatut =
          nouveauMontantRestant.lte(0) ? "Paye" : nouveauMontantPaye.gt(0) ? "PartiellementPaye" : "EnAttente";

        await prisma.obligationCotisation.update({
          where: { id: validatedData.obligationCotisationId },
          data: {
            montantPaye: nouveauMontantPaye,
            montantRestant: nouveauMontantRestant.gt(0) ? nouveauMontantRestant : new Decimal(0),
            statut: nouveauStatut,
          },
        });

        montantRestantAPayer = excédent;
      }
    }

    // Créer le paiement avec le montant total payé (pas seulement l'effectif)
    const paiement = await prisma.paiementCotisation.create({
      data: {
        adherentId: validatedData.adherentId,
        montant: montantPaiement, // Montant total du paiement
        datePaiement,
        moyenPaiement: validatedData.moyenPaiement as MoyenPaiement,
        reference: validatedData.reference,
        description: validatedData.description,
        obligationCotisationId: validatedData.obligationCotisationId || null,
        cotisationMensuelleId: validatedData.cotisationMensuelleId || null,
        detteInitialeId: validatedData.detteInitialeId || null,
        assistanceId: validatedData.assistanceId || null,
        createdBy: session.user.id,
      },
    });

    // Si il y a un excédent, créer un avoir
    if (montantRestantAPayer.gt(0)) {
      avoirCree = await prisma.avoir.create({
        data: {
          adherentId: validatedData.adherentId,
          montant: montantRestantAPayer,
          montantUtilise: new Decimal(0),
          montantRestant: montantRestantAPayer,
          paiementId: paiement.id,
          description: `Avoir créé suite à un excédent de paiement de ${montantRestantAPayer.toFixed(2)}€`,
          statut: "Disponible",
        },
      });
    }

    // Logger l'activité
    try {
      await logCreation(
        `Enregistrement d'un paiement de ${montantPaiement.toFixed(2)}€`,
        "PaiementCotisation",
        paiement.id,
        {
          montant: Number(montantPaiement),
          moyenPaiement: validatedData.moyenPaiement,
          adherentId: validatedData.adherentId,
          type: validatedData.cotisationMensuelleId ? "cotisationMensuelle" : 
                validatedData.assistanceId ? "assistance" :
                validatedData.detteInitialeId ? "detteInitiale" : "general",
          avoirCree: !!avoirCree,
        }
      );
    } catch (logError) {
      console.error("Erreur lors du logging de l'activité:", logError);
      // Ne pas bloquer le paiement si le logging échoue
    }

    let message = `Paiement de ${montantPaiement.toFixed(2)}€ enregistré avec succès`;
    if (avoirCree) {
      message += `. Un avoir de ${montantRestantAPayer.toFixed(2)}€ a été créé pour l'excédent.`;
    }

    // Récupérer le paiement avec toutes ses relations pour convertir les Decimal
    const paiementWithRelations = await prisma.paiementCotisation.findUnique({
      where: { id: paiement.id },
      include: {
        CotisationMensuelle: true,
        DetteInitiale: true,
        Assistance: true,
        ObligationCotisation: true,
      },
    });

    // Construire l'objet de retour en convertissant tous les Decimal
    const responseData: any = {
      id: paiement.id,
      adherentId: paiement.adherentId,
      montant: Number(paiement.montant),
      datePaiement: paiement.datePaiement,
      moyenPaiement: paiement.moyenPaiement,
      reference: paiement.reference,
      description: paiement.description,
      cotisationMensuelleId: paiement.cotisationMensuelleId,
      detteInitialeId: paiement.detteInitialeId,
      assistanceId: paiement.assistanceId,
      obligationCotisationId: paiement.obligationCotisationId,
      createdAt: paiement.createdAt,
      updatedAt: paiement.updatedAt,
      CotisationMensuelle: paiementWithRelations?.CotisationMensuelle ? {
        ...paiementWithRelations.CotisationMensuelle,
        montantAttendu: Number(paiementWithRelations.CotisationMensuelle.montantAttendu),
        montantPaye: Number(paiementWithRelations.CotisationMensuelle.montantPaye),
        montantRestant: Number(paiementWithRelations.CotisationMensuelle.montantRestant),
      } : null,
      DetteInitiale: paiementWithRelations?.DetteInitiale ? {
        ...paiementWithRelations.DetteInitiale,
        montant: Number(paiementWithRelations.DetteInitiale.montant),
        montantPaye: Number(paiementWithRelations.DetteInitiale.montantPaye),
        montantRestant: Number(paiementWithRelations.DetteInitiale.montantRestant),
      } : null,
      Assistance: paiementWithRelations?.Assistance ? {
        ...paiementWithRelations.Assistance,
        montant: Number(paiementWithRelations.Assistance.montant),
        montantPaye: Number(paiementWithRelations.Assistance.montantPaye),
        montantRestant: Number(paiementWithRelations.Assistance.montantRestant),
      } : null,
      ObligationCotisation: paiementWithRelations?.ObligationCotisation ? {
        ...paiementWithRelations.ObligationCotisation,
        montantAttendu: Number(paiementWithRelations.ObligationCotisation.montantAttendu),
        montantPaye: Number(paiementWithRelations.ObligationCotisation.montantPaye),
        montantRestant: Number(paiementWithRelations.ObligationCotisation.montantRestant),
      } : null,
      avoir: avoirCree ? {
        ...avoirCree,
        montant: Number(avoirCree.montant),
        montantUtilise: Number(avoirCree.montantUtilise),
        montantRestant: Number(avoirCree.montantRestant),
      } : null,
    };

    return {
      success: true,
      message,
      data: responseData,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de l'enregistrement du paiement:", error);
    return { success: false, error: "Erreur lors de l'enregistrement du paiement" };
  } finally {
    revalidatePath("/admin");
  }
}

/**
 * Calcule le cumul de la dette totale d'un adhérent
 */
export async function getCumulDette(adherentId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Récupérer toutes les dettes
    const dettesInitiales = await prisma.detteInitiale.findMany({
      where: { adherentId },
    });

    const cotisationsMensuelles = await prisma.cotisationMensuelle.findMany({
      where: {
        adherentId,
        statut: { in: ["EnAttente", "PartiellementPaye", "EnRetard"] },
      },
    });

    const assistances = await prisma.assistance.findMany({
      where: {
        adherentId,
        statut: { in: ["EnAttente"] },
      },
    });

    const obligations = await prisma.obligationCotisation.findMany({
      where: {
        adherentId,
        statut: { in: ["EnAttente", "PartiellementPaye", "EnRetard"] },
      },
    });

    // Calculer le total
    let totalDette = new Decimal(0);

    dettesInitiales.forEach((d) => {
      totalDette = totalDette.plus(d.montantRestant);
    });

    cotisationsMensuelles.forEach((c) => {
      totalDette = totalDette.plus(c.montantRestant);
    });

    assistances.forEach((a) => {
      totalDette = totalDette.plus(a.montantRestant);
    });

    obligations.forEach((o) => {
      totalDette = totalDette.plus(o.montantRestant);
    });

    // Récupérer les avoirs disponibles et les soustraire de la dette
    const avoirsDisponibles = await prisma.avoir.findMany({
      where: {
        adherentId,
        statut: "Disponible",
        montantRestant: { gt: 0 },
      },
    });

    let totalAvoirs = new Decimal(0);
    avoirsDisponibles.forEach((a) => {
      totalAvoirs = totalAvoirs.plus(a.montantRestant);
    });

    // Dette nette = dette totale - avoirs disponibles
    const detteNette = totalDette.minus(totalAvoirs).gt(0) ? totalDette.minus(totalAvoirs) : new Decimal(0);

    return {
      success: true,
      data: {
        totalDette: Number(totalDette.toFixed(2)),
        totalAvoirs: Number(totalAvoirs.toFixed(2)),
        detteNette: Number(detteNette.toFixed(2)),
        dettesInitiales: dettesInitiales.map((d) => ({
          ...d,
          montant: Number(d.montant),
          montantPaye: Number(d.montantPaye),
          montantRestant: Number(d.montantRestant),
        })),
        cotisationsMensuelles: cotisationsMensuelles.map((c) => ({
          ...c,
          montantAttendu: Number(c.montantAttendu),
          montantPaye: Number(c.montantPaye),
          montantRestant: Number(c.montantRestant),
        })),
        assistances: assistances.map((a) => ({
          ...a,
          montant: Number(a.montant),
          montantPaye: Number(a.montantPaye),
          montantRestant: Number(a.montantRestant),
        })),
        obligations: obligations.map((o) => ({
          ...o,
          montantAttendu: Number(o.montantAttendu),
          montantPaye: Number(o.montantPaye),
          montantRestant: Number(o.montantRestant),
        })),
      },
    };
  } catch (error) {
    console.error("Erreur lors du calcul du cumul de dette:", error);
    return { success: false, error: "Erreur lors du calcul du cumul de dette" };
  }
}

/**
 * Schéma de validation pour créer une assistance
 */
const CreateAssistanceSchema = z.object({
  adherentId: z.string().min(1, "L'ID de l'adhérent est requis"),
  type: z.enum(["Naissance", "MariageEnfant", "DecesFamille", "AnniversaireSalle", "Autre"]),
  dateEvenement: z.string(), // ISO string
  montant: z.number().optional().default(50),
  description: z.string().optional(),
});

/**
 * Fonction utilitaire pour synchroniser une assistance avec CotisationDuMois
 * Utilisée par createAssistance et updateAssistance
 */
async function syncAssistanceWithCotisationDuMois(
  adherentId: string,
  type: TypeEvenementFamilial,
  dateEvenement: Date,
  montant: number,
  description: string | undefined,
  userId: string,
  periode?: string
) {
  const annee = dateEvenement.getFullYear();
  const mois = dateEvenement.getMonth() + 1;
  const calculatedPeriode = periode || `${annee}-${mois.toString().padStart(2, '0')}`;

  try {
    console.log(`[syncAssistanceWithCotisationDuMois] Synchronisation pour assistance type: ${type}, date: ${dateEvenement.toISOString()}, periode: ${calculatedPeriode}`);
    
    // Mapper le type d'assistance au nom du type de cotisation
    const typeCotisationMap: Record<string, string> = {
      "AnniversaireSalle": "Anniversaire en salle",
      "MariageEnfant": "Mariage",
      "DecesFamille": "Décès",
      "Naissance": "Naissance",
      "Autre": "Décès",
    };

    const nomTypeCotisation = typeCotisationMap[type] || "Assistance décès";
    console.log(`[syncAssistanceWithCotisationDuMois] Recherche du type de cotisation: "${nomTypeCotisation}"`);

    // Récupérer tous les types actifs
    const allTypes = await prisma.typeCotisationMensuelle.findMany({
      where: { actif: true },
      select: { id: true, nom: true, montant: true },
    });

    // Recherche exacte
    let typeCotisation = allTypes.find(t => 
      t.nom.toLowerCase().trim() === nomTypeCotisation.toLowerCase().trim()
    );

    // Recherche partielle si pas trouvé
    if (!typeCotisation) {
      typeCotisation = allTypes.find(t => 
        t.nom.toLowerCase().includes(nomTypeCotisation.toLowerCase()) ||
        nomTypeCotisation.toLowerCase().includes(t.nom.toLowerCase())
      );
    }

    // Recherche par mots-clés avec montant 50€
    if (!typeCotisation) {
      const keywords = ["décès", "naissance", "anniversaire", "mariage"];
      const searchKeyword = nomTypeCotisation.toLowerCase();
      const matchingKeyword = keywords.find(kw => searchKeyword.includes(kw));
      
      if (matchingKeyword) {
        typeCotisation = allTypes.find(t => 
          t.nom.toLowerCase().includes(matchingKeyword) && 
          Number(t.montant) === 50
        );
      }
    }

    // Récupérer l'objet complet
    if (typeCotisation) {
      const fullType = await prisma.typeCotisationMensuelle.findUnique({
        where: { id: typeCotisation.id },
      });
      typeCotisation = fullType;
    }

    if (!typeCotisation) {
      console.error(`[syncAssistanceWithCotisationDuMois] ❌ Type de cotisation "${nomTypeCotisation}" non trouvé`);
      return null;
    }

    console.log(`[syncAssistanceWithCotisationDuMois] Type de cotisation trouvé: ${typeCotisation.id} - ${typeCotisation.nom}`);
    
    // Vérifier si une cotisation du mois existe déjà pour cette période et cet adhérent
    const existingCotisationDuMois = await prisma.cotisationDuMois.findFirst({
      where: {
        periode: calculatedPeriode,
        adherentBeneficiaireId: adherentId,
      },
      include: {
        TypeCotisation: {
          select: {
            nom: true,
          },
        },
      },
    });

    const dateEcheance = new Date(annee, mois - 1, 15);

    if (existingCotisationDuMois) {
      // Mettre à jour la cotisation du mois existante
      const updated = await prisma.cotisationDuMois.update({
        where: { id: existingCotisationDuMois.id },
        data: {
          typeCotisationId: typeCotisation.id,
          montantBase: new Decimal(montant),
          dateEcheance: dateEcheance,
          description: description || `Cotisation du mois pour ${nomTypeCotisation} - ${calculatedPeriode}`,
        },
      });

      console.log(`[syncAssistanceWithCotisationDuMois] ✅ Cotisation du mois mise à jour: ${updated.id}`);
      return updated;
    } else {
      // Créer une nouvelle cotisation du mois
      try {
        const cotisationDuMois = await prisma.cotisationDuMois.create({
          data: {
            periode: calculatedPeriode,
            annee,
            mois,
            typeCotisationId: typeCotisation.id,
            montantBase: new Decimal(montant),
            dateEcheance: dateEcheance,
            description: description || `Cotisation du mois pour ${nomTypeCotisation} - ${calculatedPeriode}`,
            adherentBeneficiaireId: adherentId,
            statut: "Planifie",
            createdBy: userId,
          },
        });

        console.log(`[syncAssistanceWithCotisationDuMois] ✅ Cotisation du mois créée: ${cotisationDuMois.id}`);
        return cotisationDuMois;
      } catch (createError: any) {
        if (createError?.code === 'P2002' && createError?.meta?.target?.includes('adherentBeneficiaireId')) {
          console.log(`[syncAssistanceWithCotisationDuMois] ⚠️ L'adhérent a déjà une assistance pour ${calculatedPeriode}. Contrainte unique violée.`);
        } else {
          throw createError;
        }
        return null;
      }
    }
  } catch (error) {
    console.error("[syncAssistanceWithCotisationDuMois] ❌ Erreur lors de la synchronisation:", error);
    if (error instanceof Error) {
      console.error("[syncAssistanceWithCotisationDuMois] Message d'erreur:", error.message);
    }
    return null;
  }
}

/**
 * Crée une assistance de 50€ pour un événement familial
 */
export async function createAssistance(data: z.infer<typeof CreateAssistanceSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = CreateAssistanceSchema.parse(data);

    const dateEvenement = new Date(validatedData.dateEvenement);
    const annee = dateEvenement.getFullYear();
    const mois = dateEvenement.getMonth() + 1;
    const periode = `${annee}-${mois.toString().padStart(2, '0')}`;

    // Créer l'assistance
    const assistance = await prisma.assistance.create({
      data: {
        adherentId: validatedData.adherentId,
        type: validatedData.type as TypeEvenementFamilial,
        montant: new Decimal(validatedData.montant),
        dateEvenement: dateEvenement,
        montantPaye: new Decimal(0),
        montantRestant: new Decimal(validatedData.montant),
        description: validatedData.description,
        createdBy: session.user.id,
      },
      include: {
        Adherent: {
          include: {
            User: true,
          },
        },
      },
    });

    // Synchroniser automatiquement avec cotisation_du_mois
    await syncAssistanceWithCotisationDuMois(
      validatedData.adherentId,
      validatedData.type as TypeEvenementFamilial,
      dateEvenement,
      validatedData.montant,
      validatedData.description,
      session.user.id,
      periode
    );

    // Revalider les pages des adhérents et de gestion
    // Lors de la création d'une assistance, tous les profils d'adhérents sont mis à jour
    // (sauf celui de l'admin qui n'a pas de cotisations)
    revalidatePath("/user/profile");
    revalidatePath("/admin/finances/assistances");
    revalidatePath("/admin/cotisations");
    revalidatePath("/admin/cotisations/gestion");
    revalidatePath("/admin/cotisations-du-mois");

    return {
      success: true,
      message: `Assistance de ${validatedData.montant}€ créée pour ${validatedData.type}`,
      data: {
        ...assistance,
        montant: Number(assistance.montant),
        montantPaye: Number(assistance.montantPaye),
        montantRestant: Number(assistance.montantRestant),
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la création de l'assistance:", error);
    return { success: false, error: "Erreur lors de la création de l'assistance" };
  } finally {
    // Revalider même en cas d'erreur partielle
    revalidatePath("/user/profile");
    revalidatePath("/admin/finances/assistances");
    revalidatePath("/admin/cotisations");
    revalidatePath("/admin/cotisations/gestion");
  }
}

/**
 * Vérifie et envoie des relances automatiques pour les adhérents dont la dette >= 3x cotisation mensuelle
 */
export async function checkAndSendRelances() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé" };
    }

    // Récupérer le montant de la cotisation mensuelle (par défaut 15€)
    const typeCotisationMensuelle = await prisma.typeCotisationMensuelle.findFirst({
      where: { actif: true },
      orderBy: { createdAt: "desc" },
    });

    const montantCotisationMensuelle = typeCotisationMensuelle
      ? Number(typeCotisationMensuelle.montant)
      : 15.0;

    const seuilRelance = montantCotisationMensuelle * 3; // 3x la cotisation mensuelle

    // Récupérer tous les adhérents actifs
    const adherents = await prisma.adherent.findMany({
      where: {
        User: {
          status: "Actif",
        },
      },
      include: {
        User: true,
      },
    });

    const relancesEnvoyees = [];

    for (const adherent of adherents) {
      // Calculer le cumul de dette
      const resultCumul = await getCumulDette(adherent.id);

      if (!resultCumul.success || !resultCumul.data) {
        continue;
      }

      const totalDette = resultCumul.data.totalDette;

      if (totalDette >= seuilRelance) {
        // Vérifier si une relance a déjà été envoyée récemment (dans les 30 derniers jours)
        const relanceRecente = await prisma.relanceCotisationMensuelle.findFirst({
          where: {
            adherentId: adherent.id,
            dateEnvoi: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 jours
            },
          },
        });

        if (!relanceRecente) {
          // Créer une relance
          const cotisationMensuelle = await prisma.cotisationMensuelle.findFirst({
            where: {
              adherentId: adherent.id,
              statut: { in: ["EnAttente", "PartiellementPaye", "EnRetard"] },
            },
            orderBy: { dateEcheance: "asc" },
          });

          if (cotisationMensuelle) {
            const relance = await prisma.relanceCotisationMensuelle.create({
              data: {
                cotisationMensuelleId: cotisationMensuelle.id,
                adherentId: adherent.id,
                type: "Email",
                statut: "EnAttente",
                montantRappele: new Decimal(totalDette),
                contenu: `Bonjour ${adherent.firstname} ${adherent.lastname},\n\nVotre dette totale s'élève actuellement à ${totalDette.toFixed(2)}€, ce qui dépasse le seuil de ${seuilRelance.toFixed(2)}€ (3 fois la cotisation mensuelle de ${montantCotisationMensuelle.toFixed(2)}€).\n\nNous vous remercions de régulariser votre situation dans les plus brefs délais.\n\nCordialement,\nL'équipe de l'association`,
                createdBy: session.user.id,
              },
            });

            relancesEnvoyees.push({
              adherentId: adherent.id,
              adherentName: `${adherent.firstname} ${adherent.lastname}`,
              totalDette,
              relanceId: relance.id,
            });
          }
        }
      }
    }

    return {
      success: true,
      message: `${relancesEnvoyees.length} relance(s) créée(s)`,
      data: relancesEnvoyees,
    };
  } catch (error) {
    console.error("Erreur lors de la vérification des relances:", error);
    return { success: false, error: "Erreur lors de la vérification des relances" };
  }
}

/**
 * Récupère toutes les dettes initiales
 */
export async function getAllDettesInitiales() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier la permission dynamique
    const { canRead } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canRead(session.user.id, "getAllDettesInitiales");
    if (!hasAccess) {
      return { success: false, error: "Non autorisé" };
    }

    const dettes = await prisma.detteInitiale.findMany({
      include: {
        Adherent: {
          include: {
            User: true,
          },
        },
        CreatedBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { annee: "desc" },
        { createdAt: "desc" },
      ],
    });

    return {
      success: true,
      data: dettes.map((d) => ({
        ...d,
        montant: Number(d.montant),
        montantPaye: Number(d.montantPaye),
        montantRestant: Number(d.montantRestant),
      })),
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des dettes initiales:", error);
    return { success: false, error: "Erreur lors de la récupération des dettes initiales" };
  }
}

/**
 * Schéma de validation pour mettre à jour une dette initiale
 */
const UpdateDetteInitialeSchema = z.object({
  id: z.string().min(1, "L'ID de la dette est requis"),
  adherentId: z.string().min(1, "L'ID de l'adhérent est requis"),
  annee: z.number().int().min(2020).max(2100, "L'année doit être valide"),
  montant: z.number().positive("Le montant doit être positif"),
  description: z.string().optional(),
});

/**
 * Récupère une dette initiale par son ID
 */
export async function getDetteInitialeById(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier la permission dynamique
    const { canRead } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canRead(session.user.id, "getDetteInitialeById");
    if (!hasAccess) {
      return { success: false, error: "Non autorisé" };
    }

    const dette = await prisma.detteInitiale.findUnique({
      where: { id },
      include: {
        Adherent: {
          include: {
            User: true,
          },
        },
        CreatedBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!dette) {
      return { success: false, error: "Dette initiale non trouvée" };
    }

    return {
      success: true,
      data: {
        ...dette,
        montant: Number(dette.montant),
        montantPaye: Number(dette.montantPaye),
        montantRestant: Number(dette.montantRestant),
      },
    };
  } catch (error) {
    console.error("Erreur lors de la récupération de la dette initiale:", error);
    return { success: false, error: "Erreur lors de la récupération de la dette initiale" };
  }
}

/**
 * Met à jour une dette initiale
 */
export async function updateDetteInitiale(data: z.infer<typeof UpdateDetteInitialeSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier la permission dynamique
    const { canWrite } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canWrite(session.user.id, "updateDetteInitiale");
    if (!hasAccess) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = UpdateDetteInitialeSchema.parse(data);

    // Vérifier que la dette existe
    const existing = await prisma.detteInitiale.findUnique({
      where: { id: validatedData.id },
    });

    if (!existing) {
      return { success: false, error: "Dette initiale non trouvée" };
    }

    // Vérifier si une autre dette existe déjà pour cette année (sauf celle qu'on modifie)
    const duplicate = await prisma.detteInitiale.findUnique({
      where: {
        adherentId_annee: {
          adherentId: validatedData.adherentId,
          annee: validatedData.annee,
        },
      },
    });

    if (duplicate && duplicate.id !== validatedData.id) {
      return { success: false, error: `Une dette existe déjà pour l'année ${validatedData.annee}` };
    }

    // Calculer le nouveau montant restant
    const nouveauMontantRestant = new Decimal(validatedData.montant).minus(existing.montantPaye);

    const dette = await prisma.detteInitiale.update({
      where: { id: validatedData.id },
      data: {
        adherentId: validatedData.adherentId,
        annee: validatedData.annee,
        montant: new Decimal(validatedData.montant),
        montantRestant: nouveauMontantRestant,
        description: validatedData.description,
      },
      include: {
        Adherent: {
          include: {
            User: true,
          },
        },
      },
    });

    // Logger l'activité
    try {
      await logModification(
        `Modification de la dette initiale ${validatedData.id}`,
        "DetteInitiale",
        validatedData.id,
        {
          annee: validatedData.annee,
          montant: validatedData.montant,
        }
      );
    } catch (logError) {
      console.error("Erreur lors du logging de l'activité:", logError);
      // Ne pas bloquer la mise à jour si le logging échoue
    }

    return {
      success: true,
      message: `Dette initiale mise à jour avec succès`,
      data: {
        ...dette,
        montant: Number(dette.montant),
        montantPaye: Number(dette.montantPaye),
        montantRestant: Number(dette.montantRestant),
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la mise à jour de la dette initiale:", error);
    return { success: false, error: "Erreur lors de la mise à jour de la dette initiale" };
  } finally {
    revalidatePath("/admin/finances/dettes");
  }
}

/**
 * Récupère tous les paiements
 */
export async function getAllPaiements() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier la permission dynamique
    const { canRead } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canRead(session.user.id, "getAllPaiements");
    if (!hasAccess) {
      return { success: false, error: "Non autorisé" };
    }

    const paiements = await prisma.paiementCotisation.findMany({
      include: {
        Adherent: {
          include: {
            User: true,
          },
        },
        CreatedBy: {
          select: {
            name: true,
            email: true,
          },
        },
        ObligationCotisation: true,
        CotisationMensuelle: true,
        DetteInitiale: true,
        Assistance: true,
      },
      orderBy: {
        datePaiement: "desc",
      },
    });

    return {
      success: true,
      data: paiements.map((p) => ({
        ...p,
        montant: Number(p.montant),
        CotisationMensuelle: p.CotisationMensuelle ? {
          ...p.CotisationMensuelle,
          montantAttendu: Number(p.CotisationMensuelle.montantAttendu),
          montantPaye: Number(p.CotisationMensuelle.montantPaye),
          montantRestant: Number(p.CotisationMensuelle.montantRestant),
        } : null,
        DetteInitiale: p.DetteInitiale ? {
          ...p.DetteInitiale,
          montant: Number(p.DetteInitiale.montant),
          montantPaye: Number(p.DetteInitiale.montantPaye),
          montantRestant: Number(p.DetteInitiale.montantRestant),
        } : null,
        Assistance: p.Assistance ? {
          ...p.Assistance,
          montant: Number(p.Assistance.montant),
          montantPaye: Number(p.Assistance.montantPaye),
          montantRestant: Number(p.Assistance.montantRestant),
        } : null,
        ObligationCotisation: p.ObligationCotisation ? {
          ...p.ObligationCotisation,
          montantAttendu: Number(p.ObligationCotisation.montantAttendu),
          montantPaye: Number(p.ObligationCotisation.montantPaye),
          montantRestant: Number(p.ObligationCotisation.montantRestant),
        } : null,
      })),
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des paiements:", error);
    return { success: false, error: "Erreur lors de la récupération des paiements" };
  }
}

/**
 * Récupère les statistiques financières globales
 */
export async function getFinancialStats() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier la permission dynamique
    const { canRead } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canRead(session.user.id, "getFinancialStats");
    if (!hasAccess) {
      return { success: false, error: "Non autorisé" };
    }

    // Total des dettes initiales
    const dettesInitiales = await prisma.detteInitiale.findMany();
    const totalDettesInitiales = dettesInitiales.reduce((sum, d) => sum + Number(d.montantRestant), 0);

    // Total des paiements
    const paiements = await prisma.paiementCotisation.findMany({
      where: { statut: "Valide" },
    });
    const totalPaiements = paiements.reduce((sum, p) => sum + Number(p.montant), 0);

    // Total des assistances en attente
    const assistances = await prisma.assistance.findMany({
      where: { statut: "EnAttente" },
    });
    const totalAssistancesEnAttente = assistances.reduce((sum, a) => sum + Number(a.montantRestant), 0);

    // Nombre d'adhérents avec dette
    const adherentsAvecDette = await prisma.detteInitiale.findMany({
      select: { adherentId: true },
      distinct: ["adherentId"],
    });

    return {
      success: true,
      data: {
        totalDettesInitiales: Number(totalDettesInitiales.toFixed(2)),
        totalPaiements: Number(totalPaiements.toFixed(2)),
        totalAssistancesEnAttente: Number(totalAssistancesEnAttente.toFixed(2)),
        nombreAdherentsAvecDette: adherentsAvecDette.length,
        nombreDettesInitiales: dettesInitiales.length,
        nombrePaiements: paiements.length,
        nombreAssistances: assistances.length,
      },
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques:", error);
    return { success: false, error: "Erreur lors de la récupération des statistiques" };
  }
}

/**
 * Récupère les dettes, cotisations et assistances disponibles pour un adhérent
 */
export async function getAdherentFinancialItems(adherentId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier la permission dynamique
    const { canRead } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canRead(session.user.id, "getAdherentFinancialItems");
    if (!hasAccess) {
      return { success: false, error: "Non autorisé" };
    }

    const [dettes, cotisations, assistances] = await Promise.all([
      prisma.detteInitiale.findMany({
        where: {
          adherentId,
          montantRestant: { gt: 0 },
        },
        orderBy: { annee: "desc" },
      }),
      prisma.cotisationMensuelle.findMany({
        where: {
          adherentId,
          statut: { in: ["EnAttente", "PartiellementPaye", "EnRetard"] },
          montantRestant: { gt: 0 },
        },
        include: {
          TypeCotisation: true,
        },
        orderBy: { periode: "desc" },
      }),
      prisma.assistance.findMany({
        where: {
          adherentId,
          statut: "EnAttente",
          montantRestant: { gt: 0 },
        },
        orderBy: { dateEvenement: "desc" },
      }),
    ]);

    return {
      success: true,
      data: {
        dettes: dettes.map((d) => ({
          id: d.id,
          label: `Dette ${d.annee} - ${Number(d.montantRestant).toFixed(2)}€ restant`,
          montantRestant: Number(d.montantRestant),
          type: "dette",
        })),
        cotisations: cotisations.map((c) => ({
          id: c.id,
          label: `${c.TypeCotisation?.nom || "Cotisation"} ${c.periode} - ${Number(c.montantRestant).toFixed(2)}€ restant`,
          montantRestant: Number(c.montantRestant),
          type: "cotisation",
        })),
        assistances: assistances.map((a) => ({
          id: a.id,
          label: `Assistance ${a.type} - ${Number(a.montantRestant).toFixed(2)}€ restant`,
          montantRestant: Number(a.montantRestant),
          type: "assistance",
        })),
      },
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des éléments financiers:", error);
    return { success: false, error: "Erreur lors de la récupération" };
  }
}

/**
 * Crée un paiement général qui sera distribué automatiquement sur toutes les dettes en cours
 * Le paiement est distribué en commençant par les dettes les plus anciennes
 */
export async function createPaiementGeneral(data: {
  adherentId: string;
  montant: number;
  datePaiement?: string;
  moyenPaiement: "Especes" | "Cheque" | "Virement" | "CarteBancaire";
  reference?: string;
  description?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier la permission dynamique
    const { canWrite } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canWrite(session.user.id, "createPaiementGeneral");
    if (!hasAccess) {
      return { success: false, error: "Non autorisé" };
    }

    const montantPaiement = new Decimal(data.montant);
    const datePaiement = data.datePaiement ? new Date(data.datePaiement) : new Date();

    // Récupérer d'abord les avoirs existants pour le débogage
    const avoirsExistants = await prisma.avoir.findMany({
      where: {
        adherentId: data.adherentId,
        statut: "Disponible",
        montantRestant: { gt: 0 },
      },
    });
    const totalAvoirsExistants = avoirsExistants.reduce((sum, a) => sum.plus(a.montantRestant), new Decimal(0));
    
    // Log pour débogage
    console.log(`[createPaiementGeneral] Paiement: ${data.montant}€, Avoirs existants: ${totalAvoirsExistants.toFixed(2)}€`);

    // Récupérer toutes les dettes en cours, triées par date (plus anciennes en premier)
    const [dettesInitiales, cotisationsMensuelles, assistances, obligations] = await Promise.all([
      prisma.detteInitiale.findMany({
        where: {
          adherentId: data.adherentId,
          montantRestant: { gt: 0 },
        },
        orderBy: { annee: "asc" }, // Plus anciennes en premier
      }),
      prisma.cotisationMensuelle.findMany({
        where: {
          adherentId: data.adherentId,
          statut: { in: ["EnAttente", "PartiellementPaye", "EnRetard"] },
          montantRestant: { gt: 0 },
        },
        orderBy: { dateEcheance: "asc" }, // Plus anciennes en premier
      }),
      prisma.assistance.findMany({
        where: {
          adherentId: data.adherentId,
          statut: "EnAttente",
          montantRestant: { gt: 0 },
        },
        orderBy: { dateEvenement: "asc" }, // Plus anciennes en premier
      }),
      prisma.obligationCotisation.findMany({
        where: {
          adherentId: data.adherentId,
          statut: { in: ["EnAttente", "PartiellementPaye", "EnRetard"] },
          montantRestant: { gt: 0 },
        },
        orderBy: { dateEcheance: "asc" }, // Plus anciennes en premier
      }),
    ]);

    // Créer une liste de toutes les dettes avec leur type
    const toutesDettes: Array<{
      id: string;
      type: 'detteInitiale' | 'cotisationMensuelle' | 'assistance' | 'obligationCotisation';
      montantRestant: Decimal;
    }> = [];

    dettesInitiales.forEach(d => {
      toutesDettes.push({
        id: d.id,
        type: 'detteInitiale',
        montantRestant: d.montantRestant,
      });
    });

    cotisationsMensuelles.forEach(c => {
      toutesDettes.push({
        id: c.id,
        type: 'cotisationMensuelle',
        montantRestant: c.montantRestant,
      });
    });

    assistances.forEach(a => {
      toutesDettes.push({
        id: a.id,
        type: 'assistance',
        montantRestant: a.montantRestant,
      });
    });

    obligations.forEach(o => {
      toutesDettes.push({
        id: o.id,
        type: 'obligationCotisation',
        montantRestant: o.montantRestant,
      });
    });

    let montantRestant = montantPaiement;
    const paiementsCrees: any[] = [];
    let avoirCree: any = null;

    // Distribuer le paiement sur toutes les dettes en commençant par les plus anciennes
    for (const dette of toutesDettes) {
      if (montantRestant.lte(0)) break;

      // Appliquer d'abord les avoirs disponibles sur cette dette
      // Cette fonction retourne le montant restant après application des avoirs
      const montantDetteAvantAvoirs = dette.montantRestant;
      const montantRestantApresAvoirs = await appliquerAvoirs(
        data.adherentId,
        dette.montantRestant,
        dette.type,
        dette.id
      );
      
      // Calculer combien d'avoirs ont été utilisés
      const avoirsUtilises = montantDetteAvantAvoirs.minus(montantRestantApresAvoirs);

      // Si le montant restant après avoirs est 0 ou négatif, passer à la dette suivante
      if (montantRestantApresAvoirs.lte(0)) continue;

      // Calculer le montant à payer pour cette dette avec le nouveau paiement
      // Le montant à payer est le minimum entre le montant restant du paiement et le montant restant de la dette après avoirs
      const montantAPayer = Decimal.min(montantRestant, montantRestantApresAvoirs);
      
      // S'assurer que montantAPayer est un Decimal
      const montantAPayerDecimal = montantAPayer instanceof Decimal ? montantAPayer : new Decimal(montantAPayer);

      if (montantAPayerDecimal.gt(0)) {
        // Créer un paiement pour cette dette
        const paiement = await prisma.paiementCotisation.create({
          data: {
            adherentId: data.adherentId,
            montant: montantAPayerDecimal,
            datePaiement,
            moyenPaiement: data.moyenPaiement as MoyenPaiement,
            reference: data.reference,
            description: data.description || `Paiement général distribué sur ${dette.type}`,
            [dette.type === 'detteInitiale' ? 'detteInitialeId' : 
              dette.type === 'cotisationMensuelle' ? 'cotisationMensuelleId' :
              dette.type === 'assistance' ? 'assistanceId' : 'obligationCotisationId']: dette.id,
            createdBy: session.user.id,
          },
        });

        paiementsCrees.push(paiement);

        // Mettre à jour la dette avec le paiement
        if (dette.type === 'detteInitiale') {
          const detteObj = await prisma.detteInitiale.findUnique({ where: { id: dette.id } });
          if (detteObj) {
            const nouveauMontantPaye = new Decimal(detteObj.montantPaye).plus(montantAPayerDecimal);
            const nouveauMontantRestant = montantRestantApresAvoirs.minus(montantAPayerDecimal);
            await prisma.detteInitiale.update({
              where: { id: dette.id },
              data: {
                montantPaye: nouveauMontantPaye,
                montantRestant: nouveauMontantRestant.gt(0) ? nouveauMontantRestant : new Decimal(0),
              },
            });
          }
        } else if (dette.type === 'cotisationMensuelle') {
          const cotisation = await prisma.cotisationMensuelle.findUnique({ where: { id: dette.id } });
          if (cotisation) {
            const nouveauMontantPaye = new Decimal(cotisation.montantPaye).plus(montantAPayerDecimal);
            const nouveauMontantRestant = montantRestantApresAvoirs.minus(montantAPayerDecimal);
            const nouveauStatut = nouveauMontantRestant.lte(0) ? "Paye" : nouveauMontantPaye.gt(0) ? "PartiellementPaye" : "EnAttente";
            await prisma.cotisationMensuelle.update({
              where: { id: dette.id },
              data: {
                montantPaye: nouveauMontantPaye,
                montantRestant: nouveauMontantRestant.gt(0) ? nouveauMontantRestant : new Decimal(0),
                statut: nouveauStatut,
              },
            });
          }
        } else if (dette.type === 'assistance') {
          const assistance = await prisma.assistance.findUnique({ where: { id: dette.id } });
          if (assistance) {
            const nouveauMontantPaye = new Decimal(assistance.montantPaye).plus(montantAPayerDecimal);
            const nouveauMontantRestant = montantRestantApresAvoirs.minus(montantAPayerDecimal);
            const nouveauStatut = nouveauMontantRestant.lte(0) ? "Paye" : "EnAttente";
            await prisma.assistance.update({
              where: { id: dette.id },
              data: {
                montantPaye: nouveauMontantPaye,
                montantRestant: nouveauMontantRestant.gt(0) ? nouveauMontantRestant : new Decimal(0),
                statut: nouveauStatut,
              },
            });
          }
        } else if (dette.type === 'obligationCotisation') {
          const obligation = await prisma.obligationCotisation.findUnique({ where: { id: dette.id } });
          if (obligation) {
            const nouveauMontantPaye = new Decimal(obligation.montantPaye).plus(montantAPayerDecimal);
            const nouveauMontantRestant = montantRestantApresAvoirs.minus(montantAPayerDecimal);
            const nouveauStatut = nouveauMontantRestant.lte(0) ? "Paye" : nouveauMontantPaye.gt(0) ? "PartiellementPaye" : "EnAttente";
            await prisma.obligationCotisation.update({
              where: { id: dette.id },
              data: {
                montantPaye: nouveauMontantPaye,
                montantRestant: nouveauMontantRestant.gt(0) ? nouveauMontantRestant : new Decimal(0),
                statut: nouveauStatut,
              },
            });
          }
        }

        montantRestant = montantRestant.minus(montantAPayerDecimal);
        
        // Log pour débogage
        console.log(`[createPaiementGeneral] Dette ${dette.type} (${dette.id}): montantDetteAvantAvoirs=${montantDetteAvantAvoirs.toFixed(2)}€, montantRestantApresAvoirs=${montantRestantApresAvoirs.toFixed(2)}€, avoirsUtilises=${avoirsUtilises.toFixed(2)}€, montantAPayer=${montantAPayerDecimal.toFixed(2)}€, montantRestant=${montantRestant.toFixed(2)}€`);
      }
    }

    // Log pour débogage
    console.log(`[createPaiementGeneral] Après distribution: montantRestant=${montantRestant.toFixed(2)}€, totalAvoirsExistants=${totalAvoirsExistants.toFixed(2)}€`);

    // Si il reste un montant après avoir payé toutes les dettes, créer un avoir
    // Le montant de l'avoir doit être le montant restant du paiement
    // IMPORTANT: montantRestant représente déjà le montant restant du paiement après avoir payé toutes les dettes
    // Les avoirs existants ont été utilisés pour réduire les dettes, mais cela n'affecte pas le montant restant du paiement
    // 
    // Exemple: Dette de 135€, avoirs existants de 15€, paiement de 200€
    // - Avoirs de 15€ appliqués → dette réduite à 120€
    // - Paiement de 120€ utilisé pour payer la dette
    // - Il reste 200€ - 120€ = 80€ pour créer un avoir
    // Le calcul est correct car on soustrait seulement le montant payé avec le nouveau paiement
    if (montantRestant.gt(0)) {
      avoirCree = await prisma.avoir.create({
        data: {
          adherentId: data.adherentId,
          montant: montantRestant,
          montantUtilise: new Decimal(0),
          montantRestant: montantRestant,
          description: `Avoir créé suite à un excédent de paiement général de ${montantRestant.toFixed(2)}€`,
          statut: "Disponible",
        },
      });
    }

    let message = `Paiement de ${data.montant.toFixed(2)}€ enregistré et distribué sur ${paiementsCrees.length} dette(s).`;
    if (avoirCree) {
      message += ` Un avoir de ${montantRestant.toFixed(2)}€ a été créé pour l'excédent.`;
    }

    return {
      success: true,
      message,
      data: {
        paiementsCrees: paiementsCrees.map(p => ({
          ...p,
          montant: Number(p.montant),
        })),
        avoir: avoirCree ? {
          ...avoirCree,
          montant: Number(avoirCree.montant),
          montantUtilise: Number(avoirCree.montantUtilise),
          montantRestant: Number(avoirCree.montantRestant),
        } : null,
      },
    };
  } catch (error) {
    console.error("Erreur lors de l'enregistrement du paiement général:", error);
    return { success: false, error: "Erreur lors de l'enregistrement du paiement" };
  } finally {
    revalidatePath("/admin");
  }
}

/**
 * Schéma de validation pour mettre à jour une assistance
 */
const UpdateAssistanceSchema = z.object({
  id: z.string().min(1, "L'ID de l'assistance est requis"),
  adherentId: z.string().min(1, "L'ID de l'adhérent est requis").optional(),
  type: z.enum(["Naissance", "MariageEnfant", "DecesFamille", "AnniversaireSalle", "Autre"]).optional(),
  dateEvenement: z.string().optional(), // ISO string
  montant: z.number().optional(),
  description: z.string().optional(),
});

/**
 * Met à jour une assistance et synchronise avec CotisationDuMois
 */
export async function updateAssistance(data: z.infer<typeof UpdateAssistanceSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier la permission dynamique
    const { canWrite } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canWrite(session.user.id, "updateAssistance");
    if (!hasAccess) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = UpdateAssistanceSchema.parse(data);

    // Récupérer l'assistance existante
    const existingAssistance = await prisma.assistance.findUnique({
      where: { id: validatedData.id },
    });

    if (!existingAssistance) {
      return { success: false, error: "Assistance introuvable" };
    }

    // Préparer les données de mise à jour
    const updateData: any = {};
    let dateEvenement = existingAssistance.dateEvenement;
    let adherentId = existingAssistance.adherentId;
    let type = existingAssistance.type;
    let montant = Number(existingAssistance.montant);

    if (validatedData.adherentId) {
      updateData.adherentId = validatedData.adherentId;
      adherentId = validatedData.adherentId;
    }
    if (validatedData.type) {
      updateData.type = validatedData.type as TypeEvenementFamilial;
      type = validatedData.type as TypeEvenementFamilial;
    }
    if (validatedData.dateEvenement) {
      dateEvenement = new Date(validatedData.dateEvenement);
      updateData.dateEvenement = dateEvenement;
    }
    if (validatedData.montant !== undefined) {
      updateData.montant = new Decimal(validatedData.montant);
      montant = validatedData.montant;
      // Recalculer montantRestant si le montant change
      const montantPaye = Number(existingAssistance.montantPaye);
      updateData.montantRestant = new Decimal(validatedData.montant - montantPaye);
    }
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description;
    }

    // Mettre à jour l'assistance
    const updatedAssistance = await prisma.assistance.update({
      where: { id: validatedData.id },
      data: updateData,
      include: {
        Adherent: {
          include: {
            User: true,
          },
        },
      },
    });

    // Synchroniser avec CotisationDuMois
    const annee = dateEvenement.getFullYear();
    const mois = dateEvenement.getMonth() + 1;
    const periode = `${annee}-${mois.toString().padStart(2, '0')}`;

    await syncAssistanceWithCotisationDuMois(
      adherentId,
      type,
      dateEvenement,
      montant,
      validatedData.description,
      session.user.id,
      periode
    );

    // Logger l'activité
    try {
      await logModification(
        `Modification de l'assistance ${validatedData.id}`,
        "Assistance",
        validatedData.id,
        {
          fieldsUpdated: Object.keys(updateData),
          type: type,
          montant: montant,
        }
      );
    } catch (logError) {
      console.error("Erreur lors du logging de l'activité:", logError);
      // Ne pas bloquer la mise à jour si le logging échoue
    }

    // Revalider les pages
    revalidatePath("/user/profile");
    revalidatePath("/admin/finances/assistances");
    revalidatePath("/admin/cotisations");
    revalidatePath("/admin/cotisations/gestion");
    revalidatePath("/admin/cotisations-du-mois");

    return {
      success: true,
      message: `Assistance mise à jour avec succès`,
      data: {
        ...updatedAssistance,
        montant: Number(updatedAssistance.montant),
        montantPaye: Number(updatedAssistance.montantPaye),
        montantRestant: Number(updatedAssistance.montantRestant),
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("Erreur lors de la mise à jour de l'assistance:", error);
    return { success: false, error: "Erreur lors de la mise à jour de l'assistance" };
  } finally {
    revalidatePath("/user/profile");
    revalidatePath("/admin/finances/assistances");
    revalidatePath("/admin/cotisations");
    revalidatePath("/admin/cotisations/gestion");
    revalidatePath("/admin/cotisations-du-mois");
  }
}

export async function getAllAssistances() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier la permission dynamique
    const { canRead } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canRead(session.user.id, "getAllAssistances");
    if (!hasAccess) {
      return { success: false, error: "Non autorisé" };
    }

    const assistances = await prisma.assistance.findMany({
      include: {
        Adherent: {
          include: {
            User: true,
          },
        },
        CreatedBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        dateEvenement: "desc",
      },
    });

    return {
      success: true,
      data: assistances.map((a) => ({
        ...a,
        montant: Number(a.montant),
        montantPaye: Number(a.montantPaye),
        montantRestant: Number(a.montantRestant),
      })),
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des assistances:", error);
    return { success: false, error: "Erreur lors de la récupération des assistances" };
  }
}

