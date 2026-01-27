"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { subDays, format } from "date-fns";
import { sendCustomEmailToUsers } from "@/lib/mail";
import { revalidatePath } from "next/cache";
import { RELANCE_VARIABLES } from "@/lib/relances/constants";

/**
 * Schéma pour créer un template de relance
 */
const CreateRelanceTemplateSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  typeCotisation: z.string().optional(),
  niveau: z.enum(["Premiere", "Deuxieme", "Urgente"]),
  sujet: z.string().min(1, "Le sujet est requis"),
  contenu: z.string().min(1, "Le contenu est requis"),
  joursApresEcheance: z.number().min(0).default(15),
  actif: z.boolean().default(true),
});

/**
 * Schéma pour la configuration des relances automatiques
 */
const RelanceAutomatiqueConfigSchema = z.object({
  actif: z.boolean(),
  premiereRelanceJours: z.number().min(0).default(15),
  deuxiemeRelanceJours: z.number().min(0).default(30),
  relanceUrgenteJours: z.number().min(0).default(60),
  exclusionAdherentsAJour: z.boolean().default(true),
});


/**
 * Remplace les variables dans un template
 */
function replaceTemplateVariables(
  template: string,
  data: {
    prenom: string;
    nom: string;
    montant: number;
    dateEcheance: Date;
    joursRetard: number;
    moisRetard: number;
    typeCotisation: string;
    totalDette: number;
  }
): string {
  let result = template;
  result = result.replace(/{PRENOM}/g, data.prenom);
  result = result.replace(/{NOM}/g, data.nom);
  result = result.replace(/{MONTANT}/g, data.montant.toFixed(2).replace(".", ","));
  result = result.replace(/{DATE_ECHEANCE}/g, format(data.dateEcheance, "dd/MM/yyyy"));
  result = result.replace(/{JOURS_RETARD}/g, data.joursRetard.toString());
  result = result.replace(/{MOIS_RETARD}/g, data.moisRetard.toString());
  result = result.replace(/{TYPE_COTISATION}/g, data.typeCotisation);
  result = result.replace(/{TOTAL_DETTE}/g, data.totalDette.toFixed(2).replace(".", ","));
  return result;
}

/**
 * Calcule le nombre de jours de retard
 */
function calculateJoursRetard(dateEcheance: Date): number {
  const now = new Date();
  const diffTime = now.getTime() - dateEcheance.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Calcule le nombre de mois de retard
 */
function calculateMoisRetard(dateEcheance: Date): number {
  const joursRetard = calculateJoursRetard(dateEcheance);
  return Math.floor(joursRetard / 30);
}

/**
 * Détermine le niveau de relance selon les jours de retard
 */
function determineNiveauRelance(
  joursRetard: number,
  config: {
    premiereRelanceJours: number;
    deuxiemeRelanceJours: number;
    relanceUrgenteJours: number;
  }
): "Premiere" | "Deuxieme" | "Urgente" | null {
  if (joursRetard >= config.relanceUrgenteJours) {
    return "Urgente";
  } else if (joursRetard >= config.deuxiemeRelanceJours) {
    return "Deuxieme";
  } else if (joursRetard >= config.premiereRelanceJours) {
    return "Premiere";
  }
  return null;
}

/**
 * Vérifie si une relance a déjà été envoyée récemment
 */
async function hasRecentRelance(
  adherentId: string,
  obligationId: string,
  niveau: "Premiere" | "Deuxieme" | "Urgente",
  joursMinimum: number = 7
): Promise<boolean> {
  const dateLimite = subDays(new Date(), joursMinimum);
  
  const relanceRecente = await prisma.relance.findFirst({
    where: {
      adherentId,
      obligationCotisationId: obligationId,
      createdAt: {
        gte: dateLimite,
      },
    },
  });

  return !!relanceRecente;
}

/**
 * Exécute les relances automatiques
 */
export async function executeRelancesAutomatiques() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé" };
    }

    // Récupérer la configuration (pour l'instant, valeurs par défaut)
    const config = {
      actif: true,
      premiereRelanceJours: 15,
      deuxiemeRelanceJours: 30,
      relanceUrgenteJours: 60,
      exclusionAdherentsAJour: true,
    };

    if (!config.actif) {
      return { success: true, message: "Relances automatiques désactivées", data: [] };
    }

    // Récupérer toutes les obligations en retard
    const obligations = await prisma.obligationCotisation.findMany({
      where: {
        statut: { in: ["EnAttente", "PartiellementPaye", "EnRetard"] },
        dateEcheance: {
          lte: new Date(), // Échéance passée
        },
      },
      include: {
        Adherent: {
          include: {
            User: {
              select: {
                email: true,
                status: true,
              },
            },
          },
        },
      },
    });

    const relancesEnvoyees = [];
    let emailsEnvoyes = 0;
    const totalObligations = obligations.length;

    for (let i = 0; i < obligations.length; i++) {
      const obligation = obligations[i];
      
      // Exclure les adhérents à jour si configuré
      if (config.exclusionAdherentsAJour && obligation.statut === "Paye") {
        continue;
      }

      const joursRetard = calculateJoursRetard(obligation.dateEcheance);
      const niveau = determineNiveauRelance(joursRetard, config);

      if (!niveau) {
        continue; // Pas encore le moment d'envoyer une relance
      }

      // Vérifier si une relance a déjà été envoyée récemment
      const hasRecent = await hasRecentRelance(
        obligation.adherentId,
        obligation.id,
        niveau,
        7 // Minimum 7 jours entre relances
      );

      if (hasRecent) {
        continue; // Relance déjà envoyée récemment
      }

      // Récupérer le template correspondant
      // Pour l'instant, on utilise un template par défaut
      const template = {
        sujet: `Relance de paiement - ${niveau === "Urgente" ? "URGENT" : niveau}`,
        contenu: `Bonjour {PRENOM} {NOM},

Votre cotisation de {MONTANT} € est en retard de {JOURS_RETARD} jours (échéance : {DATE_ECHEANCE}).

Nous vous remercions de régulariser votre situation dans les plus brefs délais.

Cordialement,
L'équipe AMAKI France`,
      };

      // Calculer les données pour le template
      const totalDette = Number(obligation.montantRestant);
      const moisRetard = calculateMoisRetard(obligation.dateEcheance);

      const contenuFinal = replaceTemplateVariables(template.contenu, {
        prenom: obligation.Adherent.firstname,
        nom: obligation.Adherent.lastname,
        montant: totalDette,
        dateEcheance: obligation.dateEcheance,
        joursRetard,
        moisRetard,
        typeCotisation: obligation.type,
        totalDette,
      });

      const sujetFinal = replaceTemplateVariables(template.sujet, {
        prenom: obligation.Adherent.firstname,
        nom: obligation.Adherent.lastname,
        montant: totalDette,
        dateEcheance: obligation.dateEcheance,
        joursRetard,
        moisRetard,
        typeCotisation: obligation.type,
        totalDette,
      });

      // Créer la relance en base
      const relance = await prisma.relance.create({
        data: {
          adherentId: obligation.adherentId,
          obligationCotisationId: obligation.id,
          type: "Email",
          statut: "EnAttente",
          contenu: contenuFinal,
          montantRappele: obligation.montantRestant,
        },
      });

      // Envoyer l'email si l'adhérent a un email
      if (obligation.Adherent.User?.email && obligation.Adherent.User.status === "Actif") {
        try {
          await sendCustomEmailToUsers(
            obligation.Adherent.User.email,
            `${obligation.Adherent.firstname} ${obligation.Adherent.lastname}`,
            sujetFinal,
            contenuFinal
          );

          // Marquer la relance comme envoyée
          await prisma.relance.update({
            where: { id: relance.id },
            data: {
              statut: "Envoyee",
              dateEnvoi: new Date(),
            },
          });

          relancesEnvoyees.push({
            id: relance.id,
            adherent: `${obligation.Adherent.firstname} ${obligation.Adherent.lastname}`,
            niveau,
            montant: totalDette,
            joursRetard,
          });
          
          emailsEnvoyes++;
          
          // Attendre 5 secondes avant d'envoyer le prochain email (sauf pour le dernier)
          // Pour éviter l'erreur 429 (rate limit: 2 requêtes par seconde)
          // 5 secondes = 0.2 requête/seconde, bien en dessous de la limite
          // Vérifier s'il reste des obligations à traiter qui pourraient envoyer un email
          const resteObligations = obligations.slice(i + 1);
          const resteAvecEmail = resteObligations.some(obl => 
            obl.Adherent.User?.email && 
            obl.Adherent.User.status === "Actif" &&
            !(config.exclusionAdherentsAJour && obl.statut === "Paye")
          );
          
          if (resteAvecEmail) {
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        } catch (error) {
          console.error(`Erreur lors de l'envoi de l'email à ${obligation.Adherent.User.email}:`, error);
          // La relance reste en "EnAttente"
          
          // Attendre quand même 5 secondes même en cas d'erreur pour éviter le rate limit
          const resteObligations = obligations.slice(i + 1);
          const resteAvecEmail = resteObligations.some(obl => 
            obl.Adherent.User?.email && 
            obl.Adherent.User.status === "Actif" &&
            !(config.exclusionAdherentsAJour && obl.statut === "Paye")
          );
          
          if (resteAvecEmail) {
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
      }
    }

    revalidatePath("/admin/relances");

    return {
      success: true,
      message: `${relancesEnvoyees.length} relance(s) envoyée(s)`,
      data: relancesEnvoyees,
    };
  } catch (error) {
    console.error("Erreur lors de l'exécution des relances automatiques:", error);
    return { success: false, error: "Erreur lors de l'exécution des relances automatiques" };
  }
}

/**
 * Récupère les statistiques des relances
 */
export async function getRelancesStats() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé" };
    }

    const [total, envoyees, enAttente, adherentsRecalcitrants] = await Promise.all([
      prisma.relance.count(),
      prisma.relance.count({ where: { statut: "Envoyee" } }),
      prisma.relance.count({ where: { statut: "EnAttente" } }),
      prisma.adherent.count({
        where: {
          Relances: {
            some: {
              statut: "Envoyee",
              createdAt: {
                gte: subDays(new Date(), 90), // 3 derniers mois
              },
            },
          },
          ObligationsCotisation: {
            some: {
              statut: { in: ["EnAttente", "PartiellementPaye", "EnRetard"] },
            },
          },
        },
      }),
    ]);

    const tauxEnvoi = total > 0 ? (envoyees / total) * 100 : 0;

    return {
      success: true,
      data: {
        total,
        envoyees,
        enAttente,
        adherentsRecalcitrants,
        tauxEnvoi: Number(tauxEnvoi.toFixed(1)),
      },
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques:", error);
    return { success: false, error: "Erreur lors de la récupération des statistiques" };
  }
}

/**
 * Récupère l'historique des relances
 */
export async function getRelancesHistory(limit: number = 50) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé" };
    }

    const relances = await prisma.relance.findMany({
      take: limit,
      include: {
        Adherent: {
          select: {
            firstname: true,
            lastname: true,
            User: {
              select: {
                email: true,
              },
            },
          },
        },
        ObligationCotisation: {
          select: {
            type: true,
            montantRestant: true,
            dateEcheance: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      success: true,
      data: relances.map((r) => ({
        id: r.id,
        adherent: `${r.Adherent.firstname} ${r.Adherent.lastname}`,
        email: r.Adherent.User?.email || "",
        type: r.type,
        statut: r.statut,
        montant: Number(r.montantRappele || 0),
        dateEnvoi: r.dateEnvoi,
        dateCreation: r.createdAt,
        typeCotisation: r.ObligationCotisation.type,
      })),
    };
  } catch (error) {
    console.error("Erreur lors de la récupération de l'historique:", error);
    return { success: false, error: "Erreur lors de la récupération de l'historique" };
  }
}

