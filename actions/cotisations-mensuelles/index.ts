// Server Actions pour la gestion des types de cotisation mensuelle
"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { UserRole, CategorieTypeCotisation } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { calculerCotisationMensuelle, buildDescriptionLigne } from "@/lib/utils/cotisations";
import { logCreation } from "@/lib/activity-logger";

// Schémas de validation
const CreateTypeCotisationSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  description: z.string().optional(),
  montant: z.number().min(0, "Le montant doit être positif"),
  obligatoire: z.boolean().default(true),
  actif: z.boolean().default(true),
  ordre: z.number().int().min(0).default(0),
  categorie: z.nativeEnum(CategorieTypeCotisation).default(CategorieTypeCotisation.Divers),
  aBeneficiaire: z.boolean().default(false), // Si ce type nécessite un adhérent bénéficiaire
});

const UpdateTypeCotisationSchema = z.object({
  id: z.string().min(1, "ID requis"),
  nom: z.string().min(1, "Le nom est requis").optional(),
  description: z.string().optional(),
  montant: z.number().min(0, "Le montant doit être positif").optional(),
  obligatoire: z.boolean().optional(),
  actif: z.boolean().optional(),
  ordre: z.number().int().min(0).optional(),
  categorie: z.nativeEnum(CategorieTypeCotisation).optional(),
  aBeneficiaire: z.boolean().optional(), // Si ce type nécessite un adhérent bénéficiaire
});

const CreateCotisationMensuelleSchema = z.object({
  periode: z.string().min(1, "La période est requise"),
  annee: z.number().min(2020, "Année invalide"),
  mois: z.number().min(1).max(12, "Mois invalide"),
  typeCotisationIds: z.array(z.string()).min(1, "Au moins un type de cotisation requis"),
  adherentsIds: z.array(z.string()).optional(),
  cotisationDuMoisId: z.string().optional(), // Pour affecter une seule ligne spécifique
});

const UpdateCotisationMensuelleSchema = z.object({
  id: z.string().min(1, "ID requis"),
  montantAttendu: z.number().min(0, "Le montant doit être positif").optional(),
  dateEcheance: z.string().optional(),
  description: z.string().optional(),
  statut: z.enum(["EnAttente", "PartiellementPaye", "Paye", "EnRetard"]).optional(),
});

// Créer un nouveau type de cotisation mensuelle
export async function createTypeCotisationMensuelle(data: z.infer<typeof CreateTypeCotisationSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }
    const { canWrite } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canWrite(session.user.id, "createTypeCotisationMensuelle");
    if (!hasAccess) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = CreateTypeCotisationSchema.parse(data);

    const typeCotisation = await prisma.typeCotisationMensuelle.create({
      data: {
        nom: validatedData.nom,
        description: validatedData.description,
        montant: validatedData.montant,
        obligatoire: validatedData.obligatoire,
        actif: validatedData.actif,
        ordre: validatedData.ordre,
        categorie: validatedData.categorie,
        aBeneficiaire: validatedData.aBeneficiaire,
        createdBy: session.user.id,
      },
      include: {
        CreatedBy: {
          select: {
            id: true,
            email: true,
          }
        }
      }
    });

    // Sérialisation complète pour éviter les erreurs de passage aux composants clients
    const typeCotisationConverted = {
      id: typeCotisation.id,
      nom: typeCotisation.nom,
      description: typeCotisation.description,
      montant: Number(typeCotisation.montant),
      obligatoire: typeCotisation.obligatoire,
      actif: typeCotisation.actif,
      ordre: typeCotisation.ordre,
      aBeneficiaire: typeCotisation.aBeneficiaire || false,
      createdBy: typeCotisation.createdBy,
      createdAt: typeCotisation.createdAt,
      updatedAt: typeCotisation.updatedAt,
      CreatedBy: typeCotisation.CreatedBy ? {
        id: typeCotisation.CreatedBy.id,
        email: typeCotisation.CreatedBy.email,
      } : null,
    };

    return { success: true, data: typeCotisationConverted };

  } catch (error) {
    console.error("Erreur lors de la création du type de cotisation:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Obtenir tous les types de cotisation mensuelle
export async function getAllTypesCotisationMensuelle() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }
    const { canRead } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canRead(session.user.id, "getAllTypesCotisationMensuelle");
    if (!hasAccess) {
      return { success: false, error: "Non autorisé" };
    }

    const typesCotisation = await prisma.typeCotisationMensuelle.findMany({
      include: {
        CreatedBy: {
          select: {
            id: true,
            email: true,
          }
        },
        _count: {
          select: {
            CotisationsMensuelles: true
          }
        }
      },
      orderBy: [
        { ordre: 'asc' },
        { nom: 'asc' }
      ]
    });

    // Conversion des Decimal en nombres (sérialisation complète pour éviter les erreurs de passage aux composants clients)
    const typesCotisationConverted = typesCotisation.map((type: any) => ({
      id: type.id,
      nom: type.nom,
      description: type.description,
      montant: Number(type.montant),
      obligatoire: type.obligatoire,
      actif: type.actif,
      ordre: type.ordre,
      categorie: type.categorie ?? "Divers",
      aBeneficiaire: type.aBeneficiaire || false,
      createdBy: type.createdBy,
      createdAt: type.createdAt,
      updatedAt: type.updatedAt,
      CreatedBy: type.CreatedBy ? {
        id: type.CreatedBy.id,
        email: type.CreatedBy.email,
      } : null,
      _count: type._count ? {
        CotisationsMensuelles: type._count.CotisationsMensuelles,
      } : null,
    }));

    return { success: true, data: typesCotisationConverted };

  } catch (error) {
    console.error("Erreur lors de la récupération des types de cotisation:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Mettre à jour un type de cotisation mensuelle
export async function updateTypeCotisationMensuelle(data: z.infer<typeof UpdateTypeCotisationSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }
    const { canWrite } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canWrite(session.user.id, "updateTypeCotisationMensuelle");
    if (!hasAccess) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = UpdateTypeCotisationSchema.parse(data);

    const updateData: any = {};
    if (validatedData.nom !== undefined) updateData.nom = validatedData.nom;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.montant !== undefined) updateData.montant = validatedData.montant;
    if (validatedData.obligatoire !== undefined) updateData.obligatoire = validatedData.obligatoire;
    if (validatedData.actif !== undefined) updateData.actif = validatedData.actif;
    if (validatedData.ordre !== undefined) updateData.ordre = validatedData.ordre;
    if (validatedData.categorie !== undefined) updateData.categorie = validatedData.categorie;
    if (validatedData.aBeneficiaire !== undefined) updateData.aBeneficiaire = validatedData.aBeneficiaire;

    const typeCotisation = await prisma.typeCotisationMensuelle.update({
      where: { id: validatedData.id },
      data: updateData,
      include: {
        CreatedBy: {
          select: {
            id: true,
            email: true,
          }
        }
      }
    });

    // Sérialisation complète pour éviter les erreurs de passage aux composants clients
    const typeCotisationConverted = {
      id: typeCotisation.id,
      nom: typeCotisation.nom,
      description: typeCotisation.description,
      montant: Number(typeCotisation.montant),
      obligatoire: typeCotisation.obligatoire,
      actif: typeCotisation.actif,
      ordre: typeCotisation.ordre,
      categorie: typeCotisation.categorie,
      aBeneficiaire: typeCotisation.aBeneficiaire || false,
      createdBy: typeCotisation.createdBy,
      createdAt: typeCotisation.createdAt,
      updatedAt: typeCotisation.updatedAt,
      CreatedBy: typeCotisation.CreatedBy ? {
        id: typeCotisation.CreatedBy.id,
        email: typeCotisation.CreatedBy.email,
      } : null,
    };

    return { success: true, data: typeCotisationConverted };

  } catch (error) {
    console.error("Erreur lors de la mise à jour du type de cotisation:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Supprimer un type de cotisation mensuelle
export async function deleteTypeCotisationMensuelle(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }
    const { canDelete } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canDelete(session.user.id, "deleteTypeCotisationMensuelle");
    if (!hasAccess) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier s'il y a des cotisations mensuelles liées
    const cotisationsCount = await prisma.cotisationMensuelle.count({
      where: { typeCotisationId: id }
    });

    if (cotisationsCount > 0) {
      return { 
        success: false, 
        error: `Impossible de supprimer ce type de cotisation car ${cotisationsCount} cotisation(s) mensuelle(s) y sont liées` 
      };
    }

    await prisma.typeCotisationMensuelle.delete({
      where: { id }
    });

    return { success: true, message: "Type de cotisation supprimé avec succès" };

  } catch (error) {
    console.error("Erreur lors de la suppression du type de cotisation:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Créer les cotisations mensuelles pour tous les adhérents
// La cotisation du mois = Forfait mensuel (15€ ou montant variable) + Assistances du mois
export async function createCotisationsMensuelles(data: z.infer<typeof CreateCotisationMensuelleSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }
    const { canWrite } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canWrite(session.user.id, "createCotisationsMensuelles");
    if (!hasAccess) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = CreateCotisationMensuelleSchema.parse(data);
    const periode = `${validatedData.annee}-${validatedData.mois.toString().padStart(2, '0')}`;

    console.log("[createCotisationsMensuelles] ENTRÉE", {
      periode,
      annee: validatedData.annee,
      mois: validatedData.mois,
      typeCotisationIdsCount: validatedData.typeCotisationIds?.length ?? 0,
      cotisationDuMoisId: validatedData.cotisationDuMoisId ?? "(aucun, affectation globale)",
    });

    // Les cotisations ne concernent que les adhérents dont le rôle est MEMBRE (actifs)
    const adherents = await prisma.adherent.findMany({
      where: {
        User: {
          status: "Actif",
          role: UserRole.MEMBRE,
        },
      },
      include: {
        User: true,
      },
    });

    if (adherents.length === 0) {
      return { success: false, error: "Aucun adhérent MEMBRE actif trouvé" };
    }

    // Log des adhérents éligibles (pour diagnostic si un adhérent n'a pas de cotisation créée)
    const adherentIds = adherents.map((a) => a.id);
    console.log(`[createCotisationsMensuelles] Adhérents éligibles (User status=Actif, role=MEMBRE): ${adherents.length} — ids:`, adherentIds);

    // Récupérer toutes les cotisations du mois pour cette période (Planifie ou Cree, pas Annule)
    // Si un cotisationDuMoisId spécifique est fourni, chercher d'abord cette ligne directement
    console.log(`[createCotisationsMensuelles] Recherche des cotisations pour la période: ${periode}${validatedData.cotisationDuMoisId ? ` (ligne spécifique: ${validatedData.cotisationDuMoisId})` : ''}`);
    
    let cotisationsDuMois: any[] = [];
    
    if (validatedData.cotisationDuMoisId) {
      // Chercher directement la ligne spécifique par ID
      const ligneSpecifique = await prisma.cotisationDuMois.findUnique({
        where: { id: validatedData.cotisationDuMoisId },
        include: {
          TypeCotisation: {
            select: {
              id: true,
              nom: true,
              montant: true,
              obligatoire: true,
              categorie: true,
              aBeneficiaire: true,
              ordre: true,
            }
          },
          AdherentBeneficiaire: {
            select: {
              id: true,
              civility: true,
              firstname: true,
              lastname: true,
            }
          }
        }
      });
      
      if (ligneSpecifique) {
        // Vérifier le statut
        if (ligneSpecifique.statut !== "Planifie" && ligneSpecifique.statut !== "Cree") {
          return {
            success: false,
            error: `La cotisation du mois spécifiée a le statut "${ligneSpecifique.statut}" mais doit être "Planifié" ou "Créé" pour être affectée.`
          };
        }
        // Vérifier que la période correspond
        if (ligneSpecifique.periode !== periode) {
          console.log(`[createCotisationsMensuelles] Attention: période de la ligne (${ligneSpecifique.periode}) ne correspond pas à la période demandée (${periode})`);
          // Utiliser la période réelle de la ligne
          const periodeReelle = ligneSpecifique.periode;
          // Vérifier qu'il n'y a pas d'incohérence avec les paramètres
          const anneeReelle = ligneSpecifique.annee;
          const moisReel = ligneSpecifique.mois;
          if (anneeReelle !== validatedData.annee || moisReel !== validatedData.mois) {
            return {
              success: false,
              error: `Incohérence: la cotisation du mois spécifiée appartient à la période ${periodeReelle} (${moisReel}/${anneeReelle}) mais vous avez demandé ${periode} (${validatedData.mois}/${validatedData.annee}).`
            };
          }
        }
        cotisationsDuMois = [ligneSpecifique];
        console.log(`[createCotisationsMensuelles] Ligne spécifique trouvée: ${ligneSpecifique.id} (${ligneSpecifique.periode}, statut: ${ligneSpecifique.statut})`);
      } else {
        return {
          success: false,
          error: `La cotisation du mois spécifiée (ID: ${validatedData.cotisationDuMoisId}) n'existe pas.`
        };
      }
    } else {
      // Chercher toutes les cotisations de la période
      cotisationsDuMois = await prisma.cotisationDuMois.findMany({
        where: {
          periode,
          statut: { in: ["Planifie", "Cree"] }
        },
        include: {
          TypeCotisation: {
            select: {
              id: true,
              nom: true,
              montant: true,
              obligatoire: true,
              categorie: true,
              aBeneficiaire: true,
              ordre: true,
            }
          },
          AdherentBeneficiaire: {
            select: {
              id: true,
              civility: true,
              firstname: true,
              lastname: true,
            }
          }
        },
        orderBy: [
          { TypeCotisation: { ordre: 'asc' } }
        ]
      });
      console.log(`[createCotisationsMensuelles] ${cotisationsDuMois.length} cotisation(s) trouvée(s) pour la période ${periode}`);
    }
    
    if (cotisationsDuMois.length === 0) {
      // Vérifier s'il y a des cotisations avec un autre statut
      const cotisationsAnyStatus = await prisma.cotisationDuMois.findMany({
        where: { periode },
        select: { id: true, statut: true, annee: true, mois: true },
      });
      
      console.log(`[createCotisationsMensuelles] Cotisations trouvées avec tous statuts: ${cotisationsAnyStatus.length}`, cotisationsAnyStatus);
      
      if (cotisationsAnyStatus.length > 0) {
        const statuts = [...new Set(cotisationsAnyStatus.map(c => c.statut))].join(", ");
        return {
          success: false,
          error: `Aucune cotisation du mois valide trouvée pour la période ${periode}. Les cotisations existantes ont le statut "${statuts}" mais doivent être "Planifié" ou "Créé" pour être affectées.`
        };
      }
      
      // Vérifier s'il y a des cotisations avec une période proche (pour détecter les erreurs de format)
      const cotisationsProches = await prisma.cotisationDuMois.findMany({
        where: {
          annee: validatedData.annee,
          mois: validatedData.mois,
        },
        select: { id: true, periode: true, statut: true },
        take: 5,
      });
      
      if (cotisationsProches.length > 0) {
        const periodes = cotisationsProches.map(c => `${c.periode} (${c.statut})`).join(", ");
        console.log(`[createCotisationsMensuelles] Cotisations trouvées pour ${validatedData.annee}-${validatedData.mois}: ${periodes}`);
        return {
          success: false,
          error: `Aucune cotisation du mois trouvée pour la période ${periode}. Des cotisations existent pour cette année/mois mais avec des périodes différentes: ${periodes}. Vérifiez le format de période.`
        };
      }
      
      return { 
        success: false, 
        error: `Aucune cotisation du mois trouvée pour la période ${periode}. Veuillez d'abord créer les cotisations du mois (bouton "Nouvelle cotisation" dans /admin/cotisations-du-mois).` 
      };
    }

    // Ne créer des cotisations mensuelles que pour les lignes CotisationDuMois pas encore affectées (plusieurs assistances possibles par mois)
    // Vérifier quelles lignes ont déjà des cotisations mensuelles créées
    const existingByCotisationDuMois = await prisma.cotisationMensuelle.findMany({
      where: { periode },
      select: { cotisationDuMoisId: true },
    });
    const cotisationDuMoisIdsAlreadyAffected = new Set(
      (existingByCotisationDuMois.map((c) => c.cotisationDuMoisId).filter(Boolean) as string[])
    );

    console.log("[createCotisationsMensuelles] Période", periode, "| CotisationsDuMois chargées:", cotisationsDuMois.length, "| IDs déjà affectés (CotisationMensuelle existantes):", cotisationDuMoisIdsAlreadyAffected.size, Array.from(cotisationDuMoisIdsAlreadyAffected));
    console.log("[createCotisationsMensuelles] IDs des lignes CotisationDuMois pour cette période:", cotisationsDuMois.map((c) => ({ id: c.id, type: c.TypeCotisation?.nom, statut: c.statut })));

    // Si un cotisationDuMoisId spécifique est fourni, vérifier qu'elle n'est pas déjà affectée
    let cotisationsDuMoisAFiltrer = cotisationsDuMois;
    if (validatedData.cotisationDuMoisId) {
      // Vérifier si elle est déjà affectée
      if (cotisationDuMoisIdsAlreadyAffected.has(validatedData.cotisationDuMoisId)) {
        return {
          success: false,
          error: "Cette cotisation du mois est déjà affectée. Des cotisations mensuelles existent déjà pour cette ligne.",
        };
      }
      // Utiliser seulement cette ligne (déjà filtrée dans la requête précédente)
      cotisationsDuMoisAFiltrer = cotisationsDuMois;
    }
    
    // Filtrer pour ne garder que les lignes qui n'ont pas encore de cotisations mensuelles créées
    // Cela permet de réaffecter les lignes qui ont le statut "Créé" mais pas de cotisations mensuelles (cas d'erreur)
    let cotisationsDuMoisToCreate = cotisationsDuMoisAFiltrer.filter((cdm) => !cotisationDuMoisIdsAlreadyAffected.has(cdm.id));

    if (cotisationsDuMoisToCreate.length === 0) {
      console.log("[createCotisationsMensuelles] RETOUR: déjà affectées — aucune ligne à créer. Lignes période:", cotisationsDuMois.map((c) => c.id), "déjà dans alreadyAffected:", cotisationsDuMois.map((c) => cotisationDuMoisIdsAlreadyAffected.has(c.id)));
      return {
        success: true,
        message: "Toutes les cotisations du mois pour cette période sont déjà affectées. Aucune nouvelle ligne créée.",
      };
    }

    console.log("[createCotisationsMensuelles] Lignes à créer:", cotisationsDuMoisToCreate.length, cotisationsDuMoisToCreate.map((c) => ({ id: c.id, type: c.TypeCotisation?.nom })));

    // Vérifier qu'il y a un forfait (parmi les lignes à créer ou déjà existantes)
    // Sauf si on affecte une seule ligne spécifique (peut être une assistance)
    let cotisationForfait: any = null;
    if (!validatedData.cotisationDuMoisId) {
      cotisationForfait = cotisationsDuMoisAFiltrer.find(cdm =>
        cdm.TypeCotisation?.categorie === "ForfaitMensuel" || !cdm.TypeCotisation?.aBeneficiaire
      );

      if (!cotisationForfait) {
        return { 
          success: false, 
          error: `Cotisation forfaitaire mensuelle non trouvée pour la période ${periode}. Veuillez créer une cotisation du mois de type "Forfait Mensuel".` 
        };
      }
    } else {
      // Si on affecte une ligne spécifique, chercher le forfait dans toutes les cotisations de la période (pour le montant dans le retour)
      cotisationForfait = cotisationsDuMois.find(cdm =>
        cdm.TypeCotisation?.categorie === "ForfaitMensuel" || !cdm.TypeCotisation?.aBeneficiaire
      );
    }

    // Une ligne dans cotisations_mensuelles par (adhérent, cotisation_du_mois) : forfait + chaque assistance à payer
    const bulkData: Array<{
      periode: string;
      annee: number;
      mois: number;
      typeCotisationId: string;
      adherentId: string;
      adherentBeneficiaireId?: string;
      montantAttendu: number;
      montantPaye: number;
      montantRestant: number;
      dateEcheance: Date;
      statut: string;
      description: string;
      cotisationDuMoisId: string;
      createdBy: string;
    }> = [];
    // Nettoyage défensif : si une ligne existe déjà pour le bénéficiaire (ancienne donnée erronée), la supprimer.
    const beneficiairesARetirer: Array<{ cotisationDuMoisId: string; adherentId: string }> = [];

    for (const cdm of cotisationsDuMoisToCreate) {
      const typeCotisation = cdm.TypeCotisation;
      const montantBase = Number(cdm.montantBase);
      const estAssistance = typeCotisation.aBeneficiaire === true;
      // Bénéficiaire : champ direct ou relation (le bénéficiaire ne doit pas payer cette cotisation)
      // Bénéficiaire : vient de CotisationDuMois (lui-même rempli depuis assistances.adherentId lors de l'affectation).
      // Sera stocké dans cotisations_mensuelles.adherentBeneficiaireId pour chaque ligne créée.
      const beneficiaireId = cdm.adherentBeneficiaireId ?? cdm.AdherentBeneficiaire?.id ?? undefined;
      const descriptionLigne = buildDescriptionLigne(
        typeCotisation.nom,
        estAssistance,
        montantBase,
        cdm.AdherentBeneficiaire ?? null
      );

      if (estAssistance) {
        if (!beneficiaireId) {
          // Assistance sans bénéficiaire renseigné : ne pas créer de lignes (éviter que tout le monde paie par erreur)
          console.log(`[createCotisationsMensuelles] ⚠️ Assistance ${cdm.id} sans bénéficiaire, ignorée`);
          continue;
        }
        // Préparer un nettoyage: ne jamais laisser une ligne où le bénéficiaire est le payeur
        beneficiairesARetirer.push({ cotisationDuMoisId: cdm.id, adherentId: String(beneficiaireId) });
        console.log(`[createCotisationsMensuelles] Assistance ${cdm.id}: bénéficiaire ID = ${beneficiaireId} (type: ${typeof beneficiaireId}), sera exclu du paiement`);
        console.log(`[createCotisationsMensuelles] Nombre d'adhérents à traiter: ${adherents.length}`);
        // Assistance : une ligne par adhérent qui doit la payer (tous sauf le bénéficiaire)
        let excludedCount = 0;
        for (const adherent of adherents) {
          // Comparaison stricte avec conversion explicite en string pour éviter les problèmes de type
          const adherentIdStr = String(adherent.id);
          const beneficiaireIdStr = String(beneficiaireId);
          if (adherentIdStr === beneficiaireIdStr) {
            excludedCount++;
            console.log(`[createCotisationsMensuelles] ✓ Adhérent ${adherent.id} (${adherent.User?.email || 'N/A'}) est le bénéficiaire, exclu du paiement`);
            continue;
          }
          bulkData.push({
            periode,
            annee: validatedData.annee,
            mois: validatedData.mois,
            typeCotisationId: cdm.typeCotisationId,
            adherentId: adherent.id,
            adherentBeneficiaireId: beneficiaireId,
            montantAttendu: montantBase,
            montantPaye: 0,
            montantRestant: montantBase,
            dateEcheance: cdm.dateEcheance,
            statut: "EnAttente",
            description: descriptionLigne,
            cotisationDuMoisId: cdm.id,
            createdBy: session.user.id,
          });
        }
        const lignesCreeesPourCetteAssistance = adherents.length - excludedCount;
        console.log(`[createCotisationsMensuelles] Assistance ${cdm.id}: ${lignesCreeesPourCetteAssistance} lignes créées, ${excludedCount} bénéficiaire(s) exclu(s)`);
      } else {
        // Forfait (ou type sans bénéficiaire) : une ligne par adhérent
        for (const adherent of adherents) {
          bulkData.push({
            periode,
            annee: validatedData.annee,
            mois: validatedData.mois,
            typeCotisationId: cdm.typeCotisationId,
            adherentId: adherent.id,
            montantAttendu: montantBase,
            montantPaye: 0,
            montantRestant: montantBase,
            dateEcheance: cdm.dateEcheance,
            statut: "EnAttente",
            description: descriptionLigne,
            cotisationDuMoisId: cdm.id,
            createdBy: session.user.id,
          });
        }
      }
    }

    // Vérification finale : s'assurer qu'aucun bénéficiaire d'assistance n'est dans bulkData
    for (const item of bulkData) {
      if (item.adherentBeneficiaireId && item.adherentId === item.adherentBeneficiaireId) {
        console.error(`[createCotisationsMensuelles] ❌ ERREUR: Tentative de créer une cotisation d'assistance pour le bénéficiaire ${item.adherentId}`);
        return {
          success: false,
          error: `Erreur: Le bénéficiaire de l'assistance ne doit pas payer cette cotisation. Veuillez contacter l'administrateur.`,
        };
      }
    }

    // Nettoyage défensif en base: supprimer toute cotisation déjà existante pour (cotisationDuMois, bénéficiaire)
    if (beneficiairesARetirer.length > 0) {
      await prisma.cotisationMensuelle.deleteMany({
        where: {
          OR: beneficiairesARetirer.map((x) => ({
            cotisationDuMoisId: x.cotisationDuMoisId,
            adherentId: x.adherentId,
          })),
        },
      });
    }

    const createManyResult = await prisma.cotisationMensuelle.createMany({
      data: bulkData,
      skipDuplicates: true,
    });

    const createdCount = createManyResult.count;

    // Mettre à jour le statut des cotisations_du_mois de "Planifie" à "Cree" UNIQUEMENT pour celles qui ont été effectivement affectées
    // (seulement celles pour lesquelles des CotisationsMensuelles ont été créées dans bulkData)
    // Certaines cotisations peuvent être dans cotisationsDuMoisToCreate mais ignorées (ex: assistance sans bénéficiaire)
    const idsCotisationsEffectivementAffectees = new Set(
      bulkData.map(item => item.cotisationDuMoisId).filter(Boolean)
    );
    const idsCotisationsAffectees = Array.from(idsCotisationsEffectivementAffectees);
    console.log(`[createCotisationsMensuelles] Mise à jour du statut pour ${idsCotisationsAffectees.length} cotisation(s) du mois effectivement affectée(s): ${idsCotisationsAffectees.join(", ")}`);
    
    // Avertir si certaines cotisations étaient dans la liste mais n'ont pas été traitées
    const idsNonTraitees = cotisationsDuMoisToCreate
      .filter(cdm => !idsCotisationsEffectivementAffectees.has(cdm.id))
      .map(cdm => cdm.id);
    if (idsNonTraitees.length > 0) {
      console.warn(`[createCotisationsMensuelles] ⚠️ ${idsNonTraitees.length} cotisation(s) du mois n'ont pas été traitées (statut non modifié): ${idsNonTraitees.join(", ")}`);
    }
    
    // Vérifier que les cotisations mensuelles ont bien été créées pour chaque ligne avant de mettre à jour le statut
    // Cela évite de mettre à jour le statut de lignes qui n'ont pas de cotisations mensuelles (cas d'erreur)
    const lignesAvecCotisationsMensuelles: string[] = [];
    if (idsCotisationsAffectees.length > 0 && createdCount > 0) {
      // Vérifier pour chaque ligne si elle a des cotisations mensuelles créées
      for (const id of idsCotisationsAffectees) {
        const countPourCetteLigne = bulkData.filter(item => item.cotisationDuMoisId === id).length;
        if (countPourCetteLigne > 0) {
          lignesAvecCotisationsMensuelles.push(id);
        } else {
          console.warn(`[createCotisationsMensuelles] ⚠️ Ligne ${id} était dans idsCotisationsAffectees mais n'a pas de cotisations mensuelles dans bulkData`);
        }
      }
    }
    
    // Mettre à jour le statut UNIQUEMENT pour les lignes qui ont effectivement des cotisations mensuelles créées
    const updatedCotisationsDuMois = lignesAvecCotisationsMensuelles.length > 0
      ? await prisma.cotisationDuMois.updateMany({
          where: {
            id: { in: lignesAvecCotisationsMensuelles },
            statut: "Planifie",
          },
          data: {
            statut: "Cree",
          },
        })
      : { count: 0 };
    console.log(`[createCotisationsMensuelles] ${updatedCotisationsDuMois.count} cotisation(s) du mois mise(s) à jour de "Planifié" à "Créé"`);
    
    // Avertir si certaines lignes n'ont pas été mises à jour
    if (lignesAvecCotisationsMensuelles.length > updatedCotisationsDuMois.count) {
      const lignesNonMisesAJour = lignesAvecCotisationsMensuelles.filter(id => {
        // Ces lignes avaient des cotisations mensuelles mais n'ont pas été mises à jour
        // Cela peut arriver si elles étaient déjà "Créé"
        return true;
      });
      console.warn(`[createCotisationsMensuelles] ⚠️ ${lignesNonMisesAJour.length} cotisation(s) du mois avaient des cotisations mensuelles mais n'ont pas été mises à jour (peut-être déjà "Créé"): ${lignesNonMisesAJour.join(", ")}`);
    }

    // Appliquer automatiquement les avoirs disponibles sur les nouvelles cotisations (toutes les lignes de la période)
    const { appliquerAvoirs } = await import("@/actions/paiements/index");
    const Decimal = (await import("@prisma/client/runtime/library")).Decimal;
    let avoirsAppliques = 0;

    const cotisationsCreees = await prisma.cotisationMensuelle.findMany({
      where: { periode },
    });

    for (const cotisation of cotisationsCreees) {
      // Appliquer les avoirs disponibles
      const montantApresAvoirs = await appliquerAvoirs(
        cotisation.adherentId,
        new Decimal(cotisation.montantRestant),
        'cotisationMensuelle',
        cotisation.id
      );

      if (montantApresAvoirs.lt(cotisation.montantRestant)) {
        // Des avoirs ont été appliqués
        const montantAvoirsAppliques = new Decimal(cotisation.montantRestant).minus(montantApresAvoirs);
        const nouveauMontantPaye = new Decimal(cotisation.montantPaye).plus(montantAvoirsAppliques);
        const nouveauStatut = montantApresAvoirs.lte(0) ? "Paye" : nouveauMontantPaye.gt(0) ? "PartiellementPaye" : "EnAttente";

        // Utiliser Decimal.max() (méthode statique) ou Math.max() avec conversion
        const montantRestantFinal = montantApresAvoirs.gte(0) ? montantApresAvoirs : new Decimal(0);

        await prisma.cotisationMensuelle.update({
          where: { id: cotisation.id },
          data: {
            montantPaye: nouveauMontantPaye,
            montantRestant: montantRestantFinal,
            statut: nouveauStatut,
          },
        });

        avoirsAppliques++;
      }
    }

    const cotisationsAffecteesCount = idsCotisationsAffectees.length;
    let message = `${createdCount} ligne(s) créée(s) dans cotisations_mensuelles (une par cotisation du mois × adhérent concerné : forfait pour tous + chaque assistance pour les adhérents qui la paient). ${cotisationsAffecteesCount} ligne(s) cotisation(s) du mois ont été affectées et leur statut a été mis à jour en « Créé ».`;
    if (idsNonTraitees.length > 0) {
      message += ` ⚠️ ${idsNonTraitees.length} cotisation(s) n'ont pas pu être traitées (ex: assistance sans bénéficiaire renseigné) et conservent leur statut actuel.`;
    }
    if (updatedCotisationsDuMois.count > 0) {
      message += ` ${updatedCotisationsDuMois.count} ligne(s) de la table cotisations_du_mois passée(s) de « Planifié » à « Créé ».`;
    }
    if (avoirsAppliques > 0) {
      message += ` ${avoirsAppliques} cotisation(s) ont été partiellement ou totalement payées avec des avoirs disponibles.`;
    }

    // Logger l'activité
    try {
      await logCreation(
        `Création de ${createdCount} cotisation(s) mensuelle(s) pour la période ${periode}`,
        "CotisationMensuelle",
        periode,
        {
          periode,
          annee: validatedData.annee,
          mois: validatedData.mois,
          count: createdCount,
          totalAdherents: adherents.length,
          avoirsAppliques,
        }
      );
    } catch (logError) {
      console.error("Erreur lors du logging de l'activité:", logError);
      // Ne pas bloquer la création si le logging échoue
    }

    // Revalider les pages des adhérents et de gestion
    revalidatePath("/user/profile");
    revalidatePath("/admin/cotisations");
    revalidatePath("/admin/cotisations/gestion");
    revalidatePath("/admin/cotisations-du-mois");

    console.log("[createCotisationsMensuelles] SUCCÈS:", createdCount, "ligne(s) créée(s), message:", message.slice(0, 120) + "...");

    return { 
      success: true, 
      message,
      data: {
        cotisationsCreated: createdCount,
        adherentsCount: adherents.length,
        montantForfait: cotisationForfait ? Number(cotisationForfait.montantBase) : null,
        avoirsAppliques
      }
    };

  } catch (error) {
    console.error("Erreur lors de la création des cotisations mensuelles:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    // En développement, retourner le message d'erreur complet pour le débogage
    const isDev = process.env.NODE_ENV === 'development';
    return { 
      success: false, 
      error: isDev 
        ? `Erreur lors de la création des cotisations mensuelles: ${errorMessage}` 
        : "Erreur interne du serveur. Veuillez réessayer ou contacter l'administrateur."
    };
  } finally {
    // Revalider même en cas d'erreur partielle
    revalidatePath("/user/profile");
    revalidatePath("/admin/cotisations");
    revalidatePath("/admin/cotisations/gestion");
  }
}

/**
 * Retourne les adhérents (MEMBRE actifs) pour qui la cotisation du mois (forfait) n'a pas été créée pour une période donnée.
 */
export async function getAdherentsSansCotisationPourPeriode(periode: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }
    const { canRead } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canRead(session.user.id, "getAllCotisationsDuMois");
    if (!hasAccess) {
      return { success: false, error: "Non autorisé" };
    }

    const [anneeStr, moisStr] = periode.split("-");
    const annee = parseInt(anneeStr, 10);
    const mois = parseInt(moisStr, 10);
    if (isNaN(annee) || isNaN(mois) || mois < 1 || mois > 12) {
      return { success: false, error: "Période invalide (attendu YYYY-MM)" };
    }

    const adherentsActifs = await prisma.adherent.findMany({
      where: {
        User: {
          status: "Actif",
          role: UserRole.MEMBRE,
        },
      },
      include: {
        User: { select: { email: true } },
      },
      orderBy: [{ lastname: "asc" }, { firstname: "asc" }],
    });

    const cotisationsDuMois = await prisma.cotisationDuMois.findMany({
      where: {
        periode,
        statut: { in: ["Planifie", "Cree"] },
      },
      include: {
        TypeCotisation: {
          select: { id: true, nom: true, aBeneficiaire: true, categorie: true },
        },
      },
    });

    const forfaitLine = cotisationsDuMois.find(
      (c) =>
        c.TypeCotisation?.categorie === "ForfaitMensuel" || !c.TypeCotisation?.aBeneficiaire
    );
    if (!forfaitLine) {
      return {
        success: true,
        data: {
          periode,
          adherents: adherentsActifs.map((a) => ({
            id: a.id,
            civility: a.civility,
            firstname: a.firstname ?? "",
            lastname: a.lastname ?? "",
            email: a.User?.email ?? "",
          })),
          message: "Aucune ligne forfait pour cette période : tous les adhérents sont considérés comme sans cotisation.",
        },
      };
    }

    const adherentIdsAvecForfait = await prisma.cotisationMensuelle.findMany({
      where: {
        periode,
        cotisationDuMoisId: forfaitLine.id,
      },
      select: { adherentId: true },
    });
    const setAvecForfait = new Set(adherentIdsAvecForfait.map((c) => c.adherentId));

    const adherentsSansCotisation = adherentsActifs.filter((a) => !setAvecForfait.has(a.id));

    return {
      success: true,
      data: {
        periode,
        adherents: adherentsSansCotisation.map((a) => ({
          id: a.id,
          civility: a.civility,
          firstname: a.firstname ?? "",
          lastname: a.lastname ?? "",
          email: a.User?.email ?? "",
        })),
      },
    };
  } catch (error) {
    console.error("getAdherentsSansCotisationPourPeriode:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur lors de la récupération",
    };
  }
}

/**
 * Affecte la cotisation du mois à une liste d'adhérents (nouveaux ou venant d'être rendus éligibles)
 * lorsque l'affectation globale du mois a déjà été faite. Crée uniquement les lignes manquantes.
 * @param periode - Période au format "YYYY-MM"
 * @param adherentIds - IDs des adhérents à qui affecter la cotisation pour cette période
 */
export async function affecterCotisationPourAdherents(periode: string, adherentIds: string[]) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }
    const { canWrite } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canWrite(session.user.id, "createCotisationsMensuelles");
    if (!hasAccess) {
      return { success: false, error: "Non autorisé" };
    }

    const [anneeStr, moisStr] = periode.split("-");
    const annee = parseInt(anneeStr, 10);
    const mois = parseInt(moisStr, 10);
    if (isNaN(annee) || isNaN(mois) || mois < 1 || mois > 12) {
      return { success: false, error: "Période invalide (attendu YYYY-MM)" };
    }
    const idsUniques = [...new Set(adherentIds)].filter(Boolean);
    if (idsUniques.length === 0) {
      return { success: false, error: "Aucun adhérent sélectionné" };
    }

    const cotisationsDuMois = await prisma.cotisationDuMois.findMany({
      where: {
        periode,
        statut: { in: ["Planifie", "Cree"] },
      },
      include: {
        TypeCotisation: {
          select: {
            id: true,
            nom: true,
            montant: true,
            aBeneficiaire: true,
            categorie: true,
          },
        },
        AdherentBeneficiaire: {
          select: { id: true, civility: true, firstname: true, lastname: true },
        },
      },
      orderBy: [{ TypeCotisation: { ordre: "asc" } }],
    });
    if (cotisationsDuMois.length === 0) {
      return {
        success: false,
        error: `Aucune cotisation du mois trouvée pour la période ${periode}. Créez d'abord les cotisations du mois (forfait + assistances) pour cette période.`,
      };
    }

    const existing = await prisma.cotisationMensuelle.findMany({
      where: {
        periode,
        adherentId: { in: idsUniques },
        cotisationDuMoisId: { in: cotisationsDuMois.map((c) => c.id) },
      },
      select: { adherentId: true, cotisationDuMoisId: true },
    });
    const setExisting = new Set(existing.map((e) => `${e.adherentId}:${e.cotisationDuMoisId}`));

    const bulkData: Array<{
      periode: string;
      annee: number;
      mois: number;
      typeCotisationId: string;
      adherentId: string;
      adherentBeneficiaireId?: string;
      montantAttendu: number;
      montantPaye: number;
      montantRestant: number;
      dateEcheance: Date;
      statut: string;
      description: string;
      cotisationDuMoisId: string;
      createdBy: string;
    }> = [];

    for (const cdm of cotisationsDuMois) {
      const typeCotisation = cdm.TypeCotisation;
      const montantBase = Number(cdm.montantBase);
      const estAssistance = typeCotisation?.aBeneficiaire === true;
      const beneficiaireId = cdm.adherentBeneficiaireId ?? cdm.AdherentBeneficiaire?.id;
      const descriptionLigne = buildDescriptionLigne(
        typeCotisation?.nom ?? "",
        estAssistance,
        montantBase,
        cdm.AdherentBeneficiaire ?? null
      );

      if (estAssistance) {
        if (!beneficiaireId) continue;
        for (const adherentId of idsUniques) {
          if (adherentId === beneficiaireId) continue;
          if (setExisting.has(`${adherentId}:${cdm.id}`)) continue;
          bulkData.push({
            periode,
            annee,
            mois,
            typeCotisationId: cdm.typeCotisationId,
            adherentId,
            adherentBeneficiaireId: beneficiaireId,
            montantAttendu: montantBase,
            montantPaye: 0,
            montantRestant: montantBase,
            dateEcheance: cdm.dateEcheance,
            statut: "EnAttente",
            description: descriptionLigne,
            cotisationDuMoisId: cdm.id,
            createdBy: session.user.id,
          });
        }
      } else {
        for (const adherentId of idsUniques) {
          if (setExisting.has(`${adherentId}:${cdm.id}`)) continue;
          bulkData.push({
            periode,
            annee,
            mois,
            typeCotisationId: cdm.typeCotisationId,
            adherentId,
            montantAttendu: montantBase,
            montantPaye: 0,
            montantRestant: montantBase,
            dateEcheance: cdm.dateEcheance,
            statut: "EnAttente",
            description: descriptionLigne,
            cotisationDuMoisId: cdm.id,
            createdBy: session.user.id,
          });
        }
      }
    }

    if (bulkData.length === 0) {
      return {
        success: true,
        message: "Aucune nouvelle ligne à créer : les adhérents ont déjà les cotisations pour cette période.",
        data: { created: 0 },
      };
    }

    await prisma.cotisationMensuelle.createMany({
      data: bulkData,
      skipDuplicates: true,
    });

    revalidatePath("/user/profile");
    revalidatePath("/admin/cotisations");
    revalidatePath("/admin/cotisations-du-mois");

    return {
      success: true,
      message: `${bulkData.length} cotisation(s) mensuelle(s) créée(s) pour ${idsUniques.length} adhérent(s) sur la période ${periode}.`,
      data: { created: bulkData.length },
    };
  } catch (error) {
    console.error("affecterCotisationPourAdherents:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur lors de l'affectation",
    };
  }
}

/**
 * Diagnostic : indique pourquoi un adhérent reçoit ou non une cotisation lors de l'affectation.
 * Les cotisations ne sont créées que pour les adhérents dont le User a status = "Actif" et role = "MEMBRE".
 */
export async function getAdherentEligibiliteCotisation(adherentId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }
    const { canRead } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canRead(session.user.id, "getAllCotisationsDuMois");
    if (!hasAccess) {
      return { success: false, error: "Non autorisé" };
    }

    const adherent = await prisma.adherent.findUnique({
      where: { id: adherentId },
      include: {
        User: { select: { status: true, role: true, email: true } },
      },
    });

    if (!adherent) {
      return {
        success: true,
        data: {
          adherentId,
          eligible: false,
          reason: "Adhérent introuvable.",
          userStatus: null,
          userRole: null,
        },
      };
    }

    if (!adherent.User) {
      return {
        success: true,
        data: {
          adherentId,
          eligible: false,
          reason: "Cet adhérent n'a pas de compte utilisateur (User) lié.",
          userStatus: null,
          userRole: null,
        },
      };
    }

    const userStatus = (adherent.User as { status?: string }).status ?? null;
    const userRole = (adherent.User as { role?: string }).role ?? null;
    const isActif = userStatus === "Actif";
    const isMembre = userRole === UserRole.MEMBRE;
    const eligible = isActif && isMembre;

    let reason: string;
    if (eligible) {
      reason = "L'adhérent est éligible (User actif + rôle MEMBRE). Il doit recevoir une cotisation lors de l'affectation.";
    } else {
      const motifs: string[] = [];
      if (!isActif) motifs.push(`statut utilisateur = "${userStatus ?? "?"}" au lieu de "Actif"`);
      if (!isMembre) motifs.push(`rôle = "${userRole ?? "?"}" au lieu de "MEMBRE"`);
      reason = `L'adhérent n'est pas inclus dans l'affectation : ${motifs.join(" ; ")}. Corrigez le profil utilisateur (Admin > Utilisateurs ou profil adhérent).`;
    }

    return {
      success: true,
      data: {
        adherentId,
        eligible,
        reason,
        userStatus,
        userRole,
        email: (adherent.User as { email?: string }).email ?? null,
      },
    };
  } catch (error) {
    console.error("getAdherentEligibiliteCotisation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur lors du diagnostic",
    };
  }
}

// Obtenir les cotisations mensuelles d'un adhérent
export async function getCotisationsMensuellesAdherent(adherentId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Vérifier que l'utilisateur est admin ou que c'est son propre profil
    const adherent = await prisma.adherent.findUnique({
      where: { id: adherentId },
      select: { userId: true }
    });

    if (!adherent) {
      return { success: false, error: "Adhérent non trouvé" };
    }

    if (session.user.role !== UserRole.ADMIN && adherent.userId !== session.user.id) {
      return { success: false, error: "Non autorisé" };
    }

    const cotisationsMensuelles = await prisma.cotisationMensuelle.findMany({
      where: { adherentId },
      include: {
        TypeCotisation: true,
        Adherent: {
          include: {
            User: true
          }
        }
      },
      orderBy: {
        periode: 'desc'
      }
    });

    // Conversion des Decimal en nombres
    const cotisationsConverted = cotisationsMensuelles.map((cotisation: any) => ({
      ...cotisation,
      montantAttendu: Number(cotisation.montantAttendu),
      montantPaye: Number(cotisation.montantPaye),
      montantRestant: Number(cotisation.montantRestant),
      TypeCotisation: {
        ...cotisation.TypeCotisation,
        montant: Number(cotisation.TypeCotisation.montant)
      }
    }));

    return { success: true, data: cotisationsConverted };

  } catch (error) {
    console.error("Erreur lors de la récupération des cotisations mensuelles:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Obtenir les statistiques des cotisations mensuelles
export async function getCotisationsMensuellesStats() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé" };
    }

    const currentMonth = new Date();
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    const [
      totalTypesCotisation,
      typesActifs,
      totalCotisationsMois,
      totalDettes,
      adherentsEnRetard
    ] = await Promise.all([
      prisma.typeCotisationMensuelle.count(),
      prisma.typeCotisationMensuelle.count({
        where: { actif: true }
      }),
      prisma.cotisationMensuelle.count({
        where: {
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        }
      }),
      prisma.cotisationMensuelle.aggregate({
        where: {
          statut: { in: ["EnAttente", "PartiellementPaye", "EnRetard"] }
        },
        _sum: {
          montantRestant: true
        }
      }),
      prisma.adherent.count({
        where: {
          CotisationsMensuelles: {
            some: {
              statut: "EnRetard"
            }
          }
        }
      })
    ]);

    return {
      success: true,
      data: {
        totalTypesCotisation,
        typesActifs,
        totalCotisationsMois,
        totalDettes: Number(totalDettes._sum.montantRestant || 0),
        adherentsEnRetard,
      }
    };

  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

/**
 * Met à jour une cotisation mensuelle (uniquement pour le mois en cours ou mois en cours + 1)
 * 
 * @param data - Les données de mise à jour contenant l'ID et les champs à modifier
 * @returns Un objet avec success (boolean), data (cotisation mise à jour) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function updateCotisationMensuelle(data: z.infer<typeof UpdateCotisationMensuelleSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = UpdateCotisationMensuelleSchema.parse(data);

    // Récupérer la cotisation existante
    const cotisation = await prisma.cotisationMensuelle.findUnique({
      where: { id: validatedData.id },
      include: {
        TypeCotisation: true
      }
    });

    if (!cotisation) {
      return { success: false, error: "Cotisation non trouvée" };
    }

    // Vérifier que la cotisation est du mois en cours ou mois en cours + 1
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;

    const isCurrentMonth = cotisation.annee === currentYear && cotisation.mois === currentMonth;
    const isNextMonth = cotisation.annee === nextYear && cotisation.mois === nextMonth;

    if (!isCurrentMonth && !isNextMonth) {
      return { 
        success: false, 
        error: "Seules les cotisations du mois en cours ou du mois suivant peuvent être modifiées" 
      };
    }

    // Préparer les données de mise à jour
    const updateData: any = {};
    
    if (validatedData.montantAttendu !== undefined) {
      updateData.montantAttendu = validatedData.montantAttendu;
      // Recalculer le montant restant si le montant attendu change
      const montantPaye = Number(cotisation.montantPaye);
      const nouveauMontantRestant = validatedData.montantAttendu - montantPaye;
      updateData.montantRestant = nouveauMontantRestant >= 0 ? nouveauMontantRestant : 0;
      
      // Mettre à jour le statut en fonction du montant restant
      if (nouveauMontantRestant <= 0) {
        updateData.statut = "Paye";
      } else if (montantPaye > 0) {
        updateData.statut = "PartiellementPaye";
      } else {
        updateData.statut = cotisation.statut === "EnRetard" ? "EnRetard" : "EnAttente";
      }
    }

    if (validatedData.dateEcheance) {
      updateData.dateEcheance = new Date(validatedData.dateEcheance);
    }

    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description;
    }

    if (validatedData.statut !== undefined) {
      updateData.statut = validatedData.statut;
    }

    // Mettre à jour la cotisation
    const cotisationUpdated = await prisma.cotisationMensuelle.update({
      where: { id: validatedData.id },
      data: updateData,
      include: {
        TypeCotisation: {
          select: {
            id: true,
            nom: true,
            description: true,
            montant: true,
            obligatoire: true,
          }
        },
        Adherent: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            User: {
              select: {
                email: true
              }
            }
          }
        }
      }
    });

    // Convertir les Decimal en nombres
    const cotisationConverted = {
      ...cotisationUpdated,
      montantAttendu: Number(cotisationUpdated.montantAttendu),
      montantPaye: Number(cotisationUpdated.montantPaye),
      montantRestant: Number(cotisationUpdated.montantRestant),
      TypeCotisation: {
        ...cotisationUpdated.TypeCotisation,
        montant: Number(cotisationUpdated.TypeCotisation.montant)
      }
    };

    revalidatePath("/admin/cotisations");
    revalidatePath("/admin/cotisations/gestion");
    revalidatePath("/user/profile");

    return { success: true, data: cotisationConverted, message: "Cotisation mise à jour avec succès" };

  } catch (error) {
    console.error("Erreur lors de la mise à jour de la cotisation mensuelle:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: "Erreur interne du serveur" };
  }
}

/**
 * Récupère les cotisations mensuelles créées pour une période donnée
 * 
 * @param periode - La période au format "YYYY-MM" (ex: "2024-01")
 * @returns Un objet avec success (boolean), data (array de cotisations) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function getCotisationsMensuellesByPeriode(periode: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }
    const { canRead } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canRead(session.user.id, "getCotisationsMensuellesByPeriode");
    if (!hasAccess) {
      return { success: false, error: "Non autorisé" };
    }

    const cotisationsMensuelles = await prisma.cotisationMensuelle.findMany({
      where: {
        periode: periode
      },
      include: {
        TypeCotisation: {
          select: {
            id: true,
            nom: true,
            description: true,
            montant: true,
            obligatoire: true,
            aBeneficiaire: true,
          }
        },
        Adherent: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            User: {
              select: {
                email: true
              }
            }
          }
        },
        AdherentBeneficiaire: {
          select: {
            id: true,
            civility: true,
            firstname: true,
            lastname: true,
          }
        },
        CotisationDuMois: {
          select: {
            adherentBeneficiaireId: true,
            AdherentBeneficiaire: {
              select: {
                id: true,
                civility: true,
                firstname: true,
                lastname: true,
              }
            }
          }
        },
        CreatedBy: {
          select: {
            name: true,
            email: true
          }
        },
        Paiements: {
          select: {
            id: true,
            montant: true,
            datePaiement: true,
            moyenPaiement: true,
            reference: true,
            description: true,
            justificatifChemin: true,
            createdAt: true,
          },
          orderBy: { datePaiement: "desc" }
        },
        _count: {
          select: {
            Paiements: true
          }
        }
      },
      orderBy: [
        { TypeCotisation: { ordre: 'asc' } },
        { Adherent: { User: { email: 'asc' } } }
      ]
    });

    // Repérer les assistances sans bénéficiaire chargé pour les charger par ID
    const missingBeneficiaryIds = new Set<string>();
    for (const cotisation of cotisationsMensuelles) {
      const typeNom = cotisation.TypeCotisation?.nom ?? "";
      const estAssistance = cotisation.TypeCotisation?.aBeneficiaire === true
        || (typeNom && /assistance|décès|naissance|mariage|anniversaire/i.test(typeNom));
      const benef = cotisation.AdherentBeneficiaire ?? cotisation.CotisationDuMois?.AdherentBeneficiaire;
      const adherentBeneficiaireId = cotisation.adherentBeneficiaireId ?? cotisation.CotisationDuMois?.adherentBeneficiaireId;
      if (estAssistance && !benef && adherentBeneficiaireId) {
        missingBeneficiaryIds.add(adherentBeneficiaireId);
      }
    }
    let beneficiariesById: Map<string, { id: string; civility: string | null; firstname: string; lastname: string }> = new Map();
    if (missingBeneficiaryIds.size > 0) {
      const adherents = await prisma.adherent.findMany({
        where: { id: { in: Array.from(missingBeneficiaryIds) } },
        select: { id: true, civility: true, firstname: true, lastname: true },
      });
      adherents.forEach((a: any) => beneficiariesById.set(a.id, { id: a.id, civility: a.civility, firstname: a.firstname ?? "", lastname: a.lastname ?? "" }));
    }

    // Conversion + description "Type - civilité Prénom Nom" pour les assistances
    // FILTRE CRITIQUE : Exclure les lignes où l'adhérent payeur est le bénéficiaire (il ne doit pas payer son assistance)
    const cotisationsConverted = cotisationsMensuelles
      .filter((cotisation: any) => {
        const adherentBeneficiaireId = cotisation.adherentBeneficiaireId ?? cotisation.CotisationDuMois?.adherentBeneficiaireId;
        const typeNom = cotisation.TypeCotisation?.nom ?? "";
        const estAssistance = cotisation.TypeCotisation?.aBeneficiaire === true
          || (typeNom && /assistance|décès|naissance|mariage|anniversaire/i.test(typeNom));
        // Pour les assistances : exclure si le payeur est le bénéficiaire
        if (estAssistance && adherentBeneficiaireId && cotisation.adherentId === adherentBeneficiaireId) {
          console.warn(`[getCotisationsMensuellesByPeriode] ⚠️ Ligne exclue: adhérent ${cotisation.adherentId} est bénéficiaire de l'assistance ${cotisation.id}`);
          return false;
        }
        return true;
      })
      .map((cotisation: any) => {
        let benef = cotisation.AdherentBeneficiaire ?? cotisation.CotisationDuMois?.AdherentBeneficiaire;
        const adherentBeneficiaireId = cotisation.adherentBeneficiaireId ?? cotisation.CotisationDuMois?.adherentBeneficiaireId;
        if (!benef && adherentBeneficiaireId) {
          const fromMap = beneficiariesById.get(adherentBeneficiaireId);
          if (fromMap) benef = fromMap;
        }
        const typeNom = cotisation.TypeCotisation?.nom ?? "";
        const estAssistance = cotisation.TypeCotisation?.aBeneficiaire === true
          || (typeNom && /assistance|décès|naissance|mariage|anniversaire/i.test(typeNom));
        let descriptionWithBeneficiaire: string | null = null;
        if (estAssistance && benef) {
          const parts = [
            benef.civility,
            benef.firstname,
            benef.lastname,
          ].filter(Boolean);
          if (parts.length > 0) {
            descriptionWithBeneficiaire = `${typeNom} - ${parts.join(" ")}`;
          }
        }
        // Pour l'affichage dans /admin/finances/paiements : la colonne Description doit montrer "Type - Civilité Prénom Nom" pour les assistances
        const descriptionAffichage = descriptionWithBeneficiaire ?? (estAssistance ? typeNom : (cotisation.description || typeNom));
        return {
          ...cotisation,
          montantAttendu: Number(cotisation.montantAttendu),
          montantPaye: Number(cotisation.montantPaye),
          montantRestant: Number(cotisation.montantRestant),
          adherentBeneficiaireId: adherentBeneficiaireId ?? undefined,
          AdherentBeneficiaire: benef ? {
            id: benef.id,
            civility: benef.civility,
            firstname: benef.firstname ?? "",
            lastname: benef.lastname ?? "",
          } : null,
          CotisationDuMois: cotisation.CotisationDuMois ? {
            adherentBeneficiaireId: cotisation.CotisationDuMois.adherentBeneficiaireId,
            AdherentBeneficiaire: cotisation.CotisationDuMois.AdherentBeneficiaire ? {
              id: cotisation.CotisationDuMois.AdherentBeneficiaire.id,
              civility: cotisation.CotisationDuMois.AdherentBeneficiaire.civility,
              firstname: cotisation.CotisationDuMois.AdherentBeneficiaire.firstname ?? "",
              lastname: cotisation.CotisationDuMois.AdherentBeneficiaire.lastname ?? "",
            } : null,
          } : null,
          descriptionWithBeneficiaire,
          description: descriptionAffichage,
          TypeCotisation: {
            ...cotisation.TypeCotisation,
            montant: Number(cotisation.TypeCotisation.montant)
          },
          Paiements: (cotisation.Paiements ?? []).map((p: any) => ({
            ...p,
            montant: Number(p.montant),
          })),
        };
      });

    return { success: true, data: cotisationsConverted };

  } catch (error) {
    console.error("Erreur lors de la récupération des cotisations mensuelles:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

/**
 * Récupère toutes les cotisations mensuelles pour l'admin
 * 
 * @returns Un objet avec success (boolean), data (array de cotisations) en cas de succès, 
 *          ou error (string) en cas d'échec
 */
export async function getAllCotisationsMensuelles() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé" };
    }

    const cotisationsMensuelles = await prisma.cotisationMensuelle.findMany({
      include: {
        TypeCotisation: {
          select: {
            id: true,
            nom: true,
            description: true,
            montant: true,
            obligatoire: true,
            aBeneficiaire: true,
          }
        },
        Adherent: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            User: {
              select: {
                email: true
              }
            }
          }
        },
        AdherentBeneficiaire: {
          select: {
            id: true,
            civility: true,
            firstname: true,
            lastname: true,
          }
        },
        CotisationDuMois: {
          select: {
            adherentBeneficiaireId: true,
            AdherentBeneficiaire: {
              select: {
                id: true,
                civility: true,
                firstname: true,
                lastname: true,
              }
            }
          }
        },
        CreatedBy: {
          select: {
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            Paiements: true
          }
        }
      },
      orderBy: [
        { periode: 'desc' },
        { TypeCotisation: { ordre: 'asc' } },
        { Adherent: { User: { email: 'asc' } } }
      ]
    });

    // Conversion des Decimal en nombres + fallback bénéficiaire depuis CotisationDuMois pour anciennes lignes
    const cotisationsConverted = cotisationsMensuelles.map((cotisation: any) => {
      const benef = cotisation.AdherentBeneficiaire ?? cotisation.CotisationDuMois?.AdherentBeneficiaire;
      const adherentBeneficiaireId = cotisation.adherentBeneficiaireId ?? cotisation.CotisationDuMois?.adherentBeneficiaireId;
      return {
        ...cotisation,
        montantAttendu: Number(cotisation.montantAttendu),
        montantPaye: Number(cotisation.montantPaye),
        montantRestant: Number(cotisation.montantRestant),
        adherentBeneficiaireId: adherentBeneficiaireId ?? undefined,
        AdherentBeneficiaire: benef,
        TypeCotisation: {
          ...cotisation.TypeCotisation,
          montant: Number(cotisation.TypeCotisation.montant)
        }
      };
    });

    return { success: true, data: cotisationsConverted };

  } catch (error) {
    console.error("Erreur lors de la récupération de toutes les cotisations mensuelles:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}
