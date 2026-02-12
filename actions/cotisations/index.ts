// Server Actions pour la gestion des cotisations mensuelles
"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { UserRole, TypeCotisation, MoyenPaiement } from "@prisma/client";
import { logCreation } from "@/lib/activity-logger";

// Schémas de validation
const CreateMonthlyCotisationSchema = z.object({
  mois: z.string().min(1, "Le mois est requis"),
  annee: z.number().min(2020, "Année invalide"),
  montantForfait: z.number().min(0, "Montant forfait invalide"),
  montantOccasionnel: z.number().min(0, "Montant occasionnel invalide"),
  adherentsIds: z.array(z.string()).optional(),
});

const CreateCotisationSchema = z.object({
  adherentId: z.string().min(1, "Adhérent requis"),
  type: z.enum(["Forfait", "Assistance", "Anniversaire", "Adhesion"]),
  montant: z.number().min(0, "Montant invalide"),
  moyenPaiement: z.enum(["Especes", "Cheque", "Virement", "CarteBancaire"]),
  description: z.string().optional(),
  reference: z.string().optional(),
});

const UpdateCotisationSchema = z.object({
  id: z.string().min(1, "ID requis"),
  montant: z.number().min(0, "Montant invalide").optional(),
  statut: z.enum(["Valide", "Annule", "EnAttente"]).optional(),
  description: z.string().optional(),
});

// Créer les cotisations mensuelles pour tous les adhérents
export async function createMonthlyCotisations(data: z.infer<typeof CreateMonthlyCotisationSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = CreateMonthlyCotisationSchema.parse(data);
    const periode = `${validatedData.annee}-${validatedData.mois.padStart(2, '0')}`;

    // Récupérer tous les adhérents actifs
    const adherents = await prisma.adherent.findMany({
      where: {
        User: {
          status: "Actif"
        }
      },
      include: {
        User: true
      }
    });

    if (adherents.length === 0) {
      return { success: false, error: "Aucun adhérent actif trouvé" };
    }

    const cotisationsCreated = [];

    // Créer les obligations de cotisation pour chaque adhérent
    for (const adherent of adherents) {
      // Cotisation forfait mensuelle
      const obligationForfait = await prisma.obligationCotisation.create({
        data: {
          adherentId: adherent.id,
          type: TypeCotisation.Forfait,
          montantAttendu: validatedData.montantForfait,
          montantPaye: 0,
          montantRestant: validatedData.montantForfait,
          dateEcheance: new Date(validatedData.annee, parseInt(validatedData.mois) - 1, 15), // 15 du mois
          periode: `${periode}-Forfait`,
          statut: "EnAttente",
          description: `Cotisation forfait mensuelle ${periode}`,
        }
      });

      // Cotisation occasionnelle mensuelle
      const obligationOccasionnel = await prisma.obligationCotisation.create({
        data: {
          adherentId: adherent.id,
          type: TypeCotisation.Assistance,
          montantAttendu: validatedData.montantOccasionnel,
          montantPaye: 0,
          montantRestant: validatedData.montantOccasionnel,
          dateEcheance: new Date(validatedData.annee, parseInt(validatedData.mois) - 1, 15),
          periode: `${periode}-Occasionnel`,
          statut: "EnAttente",
          description: `Cotisation occasionnelle mensuelle ${periode}`,
        }
      });

      // Convertir les Decimal en Number pour le retour
      cotisationsCreated.push(
        {
          ...obligationForfait,
          montantAttendu: Number(obligationForfait.montantAttendu),
          montantPaye: Number(obligationForfait.montantPaye),
          montantRestant: Number(obligationForfait.montantRestant)
        },
        {
          ...obligationOccasionnel,
          montantAttendu: Number(obligationOccasionnel.montantAttendu),
          montantPaye: Number(obligationOccasionnel.montantPaye),
          montantRestant: Number(obligationOccasionnel.montantRestant)
        }
      );
    }

    return { 
      success: true, 
      message: `${cotisationsCreated.length} obligations de cotisation créées pour ${adherents.length} adhérents`,
      data: cotisationsCreated.length
    };

  } catch (error) {
    console.error("Erreur lors de la création des cotisations mensuelles:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Créer une cotisation manuelle (pour paiement en espèces)
export async function createManualCotisation(data: z.infer<typeof CreateCotisationSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }
    
    // Autoriser les rôles admin qui ont accès à la gestion des cotisations
    const adminRoles = ['ADMIN', 'PRESID', 'VICEPR', 'SECRET', 'VICESE', 'COMCPT', 'TRESOR', 'VTRESO'];
    const normalizedRole = session.user.role?.toString().trim().toUpperCase();
    if (!normalizedRole || !adminRoles.includes(normalizedRole)) {
      return { success: false, error: "Accès refusé. Vous devez avoir un rôle d'administration." };
    }

    const validatedData = CreateCotisationSchema.parse(data);

    const cotisation = await prisma.cotisation.create({
      data: {
        adherentId: validatedData.adherentId,
        type: validatedData.type as TypeCotisation,
        montant: validatedData.montant,
        moyenPaiement: validatedData.moyenPaiement as MoyenPaiement,
        description: validatedData.description || `Cotisation ${validatedData.type}`,
        reference: validatedData.reference || `MAN-${Date.now()}`,
        statut: "Valide",
      },
      include: {
        Adherent: {
          include: {
            User: true
          }
        }
      }
    });

    // Convertir les Decimal en Number
    const cotisationConverted = {
      ...cotisation,
      montant: Number(cotisation.montant)
    };

    // Logger l'activité
    try {
      await logCreation(
        `Création d'une cotisation manuelle de ${validatedData.montant}€ (${validatedData.type})`,
        "Cotisation",
        cotisation.id,
        {
          type: validatedData.type,
          montant: validatedData.montant,
          moyenPaiement: validatedData.moyenPaiement,
          adherentId: validatedData.adherentId,
        }
      );
    } catch (logError) {
      console.error("Erreur lors du logging de l'activité:", logError);
      // Ne pas bloquer la création si le logging échoue
    }

    let messageAvoirSurDette = "";
    // Mettre à jour l'obligation correspondante si elle existe
    const obligation = await prisma.obligationCotisation.findFirst({
      where: {
        adherentId: validatedData.adherentId,
        type: validatedData.type as TypeCotisation,
        statut: { in: ["EnAttente", "PartiellementPaye"] }
      }
    });

    if (obligation) {
      // Importer la fonction appliquerAvoirs depuis paiements
      const { appliquerAvoirs } = await import("@/actions/paiements/index");
      const Decimal = (await import("@prisma/client/runtime/library")).Decimal;
      
      // Appliquer d'abord les avoirs disponibles
      const montantApresAvoirs = await appliquerAvoirs(
        validatedData.adherentId,
        new Decimal(obligation.montantRestant),
        'obligationCotisation',
        obligation.id
      );

      // Calculer le montant réellement payé
      const montantPaiement = new Decimal(validatedData.montant);
      const montantEffectivementPaye = Decimal.min(montantPaiement, montantApresAvoirs);
      const nouveauMontantPaye = new Decimal(obligation.montantPaye).plus(montantEffectivementPaye);
      const nouveauMontantRestant = montantApresAvoirs.minus(montantEffectivementPaye);
      const excédent = montantPaiement.minus(montantEffectivementPaye);
      
      let nouveauStatut = "PartiellementPaye";
      if (nouveauMontantRestant.lte(0)) {
        nouveauStatut = "Paye";
      }

      // S'assurer que montantRestant n'est pas négatif
      const montantRestantFinal = nouveauMontantRestant.gte(0) ? nouveauMontantRestant : new Decimal(0);

      await prisma.obligationCotisation.update({
        where: { id: obligation.id },
        data: {
          montantPaye: nouveauMontantPaye,
          montantRestant: montantRestantFinal,
          statut: nouveauStatut,
        }
      });

      // Si il y a un excédent, créer un avoir puis l'appliquer sur les dettes initiales si possible
      if (excédent.gt(0)) {
        await prisma.avoir.create({
          data: {
            adherentId: validatedData.adherentId,
            montant: excédent,
            montantUtilise: new Decimal(0),
            montantRestant: excédent,
            description: `Avoir créé suite à un excédent de paiement de ${excédent.toFixed(2)}€ (cotisation manuelle)`,
            statut: "Disponible",
          },
        });
        const { appliquerAvoirSurDettesInitiales } = await import("@/actions/paiements/index");
        const { montantApplique } = await appliquerAvoirSurDettesInitiales(validatedData.adherentId);
        messageAvoirSurDette = montantApplique.gt(0)
          ? ` L'avoir a été appliqué sur la dette initiale (${montantApplique.toFixed(2)} €).`
          : "";
      }
    }

    const message = messageAvoirSurDette
      ? `Cotisation enregistrée avec succès.${messageAvoirSurDette}`
      : undefined;
    return { success: true, data: cotisationConverted, ...(message ? { message } : {}) };

  } catch (error) {
    console.error("Erreur lors de la création de la cotisation manuelle:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Obtenir la liste des adhérents avec leurs cotisations
export async function getAdherentsWithCotisations() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }
    
    // Autoriser les rôles admin qui ont accès à la gestion des cotisations
    const adminRoles = ['ADMIN', 'PRESID', 'VICEPR', 'SECRET', 'VICESE', 'COMCPT', 'TRESOR', 'VTRESO'];
    const normalizedRole = session.user.role?.toString().trim().toUpperCase();
    if (!normalizedRole || !adminRoles.includes(normalizedRole)) {
      return { success: false, error: "Accès refusé. Vous devez avoir un rôle d'administration." };
    }

    // Dates pour le mois en cours
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const periodeCourante = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const startOfCurrentMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfCurrentMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);

    // Récupérer toutes les assistances du mois en cours
    const toutesAssistancesMoisCourant = await prisma.assistance.findMany({
      where: {
        dateEvenement: {
          gte: startOfCurrentMonth,
          lte: endOfCurrentMonth
        },
        statut: { not: "Annule" }
      },
      include: {
        Adherent: {
          select: {
            id: true,
            firstname: true,
            lastname: true
          }
        }
      }
    });

    // Trouver le type Forfait Mensuel (categorie ForfaitMensuel)
    const typeForfait = await prisma.typeCotisationMensuelle.findFirst({
      where: {
        actif: true,
        OR: [
          { categorie: "ForfaitMensuel" },
          { nom: { contains: "Forfait", mode: "insensitive" } }
        ]
      }
    });

    const montantForfait = typeForfait ? Number(typeForfait.montant) : 15;

    const adherents = await prisma.adherent.findMany({
      include: {
        User: {
          select: {
            id: true,
            email: true,
            status: true,
            lastLogin: true,
          }
        },
        ObligationsCotisation: {
          where: {
            statut: { in: ["EnAttente", "PartiellementPaye", "EnRetard"] }
          },
          orderBy: {
            dateEcheance: 'desc'
          }
        },
        DettesInitiales: {
          where: {
            montantRestant: { gt: 0 }
          },
          orderBy: {
            annee: 'desc'
          }
        },
        Avoirs: {
          where: {
            statut: "Disponible",
            montantRestant: { gt: 0 }
          },
          orderBy: {
            createdAt: 'asc'
          }
        },
        CotisationsMensuelles: {
          where: {
            periode: periodeCourante
          },
          include: {
            TypeCotisation: true
          }
        },
        Assistances: {
          where: {
            dateEvenement: {
              gte: startOfCurrentMonth,
              lte: endOfCurrentMonth
            },
            statut: { not: "Annule" }
          }
        },
        Cotisations: {
          orderBy: {
            dateCotisation: 'desc'
          },
          take: 5 // Dernières 5 cotisations
        },
        _count: {
          select: {
            ObligationsCotisation: {
              where: {
                statut: { in: ["EnAttente", "PartiellementPaye", "EnRetard"] }
              }
            },
            Cotisations: true
          }
        }
      },
      orderBy: {
        User: {
          email: 'asc'
        }
      }
    });

    // Calculer les dettes pour chaque adhérent (relations optionnelles après purge ou tables vides)
    const adherentsWithDebt = adherents.map(adherent => {
      const obligations = adherent.ObligationsCotisation ?? [];
      const dettesInitiales = adherent.DettesInitiales ?? [];
      const avoirs = adherent.Avoirs ?? [];
      const cotisations = adherent.Cotisations ?? [];
      const cotisationsMensuelles = adherent.CotisationsMensuelles ?? [];
      const assistances = adherent.Assistances ?? [];

      // Dette des obligations de cotisation
      const detteObligations = obligations.reduce((sum, obligation) => {
        return sum + Number(obligation.montantRestant);
      }, 0);

      // Dette initiale (somme des montants restants de toutes les dettes initiales)
      const detteInitiale = dettesInitiales.reduce((sum, dette) => {
        return sum + Number(dette.montantRestant);
      }, 0);

      // Total des avoirs disponibles
      const totalAvoirs = avoirs.reduce((sum, avoir) => {
        return sum + Number(avoir.montantRestant);
      }, 0);

      // Total de la dette brute = obligations + dettes initiales
      const totalDetteBrute = detteObligations + detteInitiale;
      
      // Dette nette = dette brute - avoirs disponibles (minimum 0)
      const totalDette = Math.max(0, totalDetteBrute - totalAvoirs);

      // Calculer le forfait du mois en cours
      // IMPORTANT: Ne calculer le forfait que si une cotisation mensuelle existe
      // Si aucune cotisation n'a été créée, le forfait ne doit pas être inclus dans le calcul
      const cotisationMensuelleCourante = cotisationsMensuelles.find(
        (cm: { periode: string }) => cm.periode === periodeCourante
      );
      let forfaitMoisCourant = 0;
      let assistanceMoisCourant = 0;
      
      if (cotisationMensuelleCourante) {
        // Si une cotisation mensuelle existe, extraire le forfait et les assistances
        const description = cotisationMensuelleCourante.description || '';
        // Le forfait est toujours présent dans une cotisation existante
        forfaitMoisCourant = montantForfait;
        
        // Vérifier si l'adhérent est bénéficiaire
        const isBeneficiaire = description.includes('Bénéficiaire de:');
        
        if (!isBeneficiaire && description.includes('+ Assistances:')) {
          // Calculer le montant des assistances du mois
          const assistancesMois = toutesAssistancesMoisCourant.filter(
            ass => ass.adherentId !== adherent.id
          );
          assistanceMoisCourant = assistancesMois.reduce((sum, ass) => {
            return sum + Number(ass.montantRestant > 0 ? ass.montantRestant : ass.montant);
          }, 0);
        }
      } else {
        // Pas de cotisation mensuelle créée : ne pas inclure le forfait dans le calcul
        // Le forfait sera inclus uniquement quand la cotisation mensuelle sera créée
        forfaitMoisCourant = 0;
        assistanceMoisCourant = 0;
      }

      // Montant à payer pour annuler la dette = dette initiale + forfait mois en cours (si cotisation créée) + assistance mois en cours (si cotisation créée)
      // IMPORTANT: Soustraire les avoirs disponibles car ils seront automatiquement appliqués
      const montantBrutAPayer = detteInitiale + forfaitMoisCourant + assistanceMoisCourant;
      const montantAPayerPourAnnulerDette = Math.max(0, montantBrutAPayer - totalAvoirs);

      const cotisationMensuelle = montantForfait + 50 || 1; // Forfait + assistance moyenne (éviter division par 0)
      const moisDeRetard = cotisationMensuelle > 0 ? Math.floor(totalDette / cotisationMensuelle) : 0;

      return {
        ...adherent,
        ObligationsCotisation: obligations.map((obligation: any) => ({
          ...obligation,
          montantAttendu: Number(obligation.montantAttendu),
          montantPaye: Number(obligation.montantPaye),
          montantRestant: Number(obligation.montantRestant)
        })),
        DettesInitiales: dettesInitiales.map((dette: any) => ({
          ...dette,
          montant: Number(dette.montant),
          montantPaye: Number(dette.montantPaye),
          montantRestant: Number(dette.montantRestant)
        })),
        Cotisations: cotisations.map((cotisation: any) => ({
          ...cotisation,
          montant: Number(cotisation.montant)
        })),
        CotisationsMensuelles: cotisationsMensuelles.map((cotisation: any) => ({
          ...cotisation,
          montantAttendu: Number(cotisation.montantAttendu),
          montantPaye: Number(cotisation.montantPaye),
          montantRestant: Number(cotisation.montantRestant),
          TypeCotisation: cotisation.TypeCotisation ? {
            ...cotisation.TypeCotisation,
            montant: Number(cotisation.TypeCotisation.montant)
          } : null
        })),
        Assistances: assistances.map((assistance: any) => ({
          ...assistance,
          montant: Number(assistance.montant),
          montantPaye: Number(assistance.montantPaye),
          montantRestant: Number(assistance.montantRestant)
        })),
        Avoirs: avoirs.map((avoir: any) => ({
          ...avoir,
          montant: Number(avoir.montant),
          montantUtilise: Number(avoir.montantUtilise),
          montantRestant: Number(avoir.montantRestant)
        })),
        totalDette: Number(totalDette.toFixed(2)),
        moisDeRetard,
        enRetard: moisDeRetard >= 3,
        montantForfait: Number(obligations.find((o: any) => o.type === "Forfait")?.montantRestant || 0),
        montantOccasionnel: Number(obligations.find((o: any) => o.type === "Assistance")?.montantRestant || 0),
        forfaitMoisCourant: Number(forfaitMoisCourant.toFixed(2)),
        assistanceMoisCourant: Number(assistanceMoisCourant.toFixed(2)),
        periodeMoisCourant: cotisationMensuelleCourante ? periodeCourante : undefined,
        montantAPayerPourAnnulerDette: Number(montantAPayerPourAnnulerDette.toFixed(2)),
        totalAvoirs: Number(totalAvoirs.toFixed(2)),
      };
    });

    return { success: true, data: adherentsWithDebt };

  } catch (error) {
    console.error("Erreur lors de la récupération des adhérents:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Mettre à jour une cotisation
export async function updateCotisation(data: z.infer<typeof UpdateCotisationSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }
    
    // Autoriser les rôles admin qui ont accès à la gestion des cotisations
    const adminRoles = ['ADMIN', 'PRESID', 'VICEPR', 'SECRET', 'VICESE', 'COMCPT', 'TRESOR', 'VTRESO'];
    const normalizedRole = session.user.role?.toString().trim().toUpperCase();
    if (!normalizedRole || !adminRoles.includes(normalizedRole)) {
      return { success: false, error: "Accès refusé. Vous devez avoir un rôle d'administration." };
    }

    const validatedData = UpdateCotisationSchema.parse(data);

    const cotisation = await prisma.cotisation.update({
      where: { id: validatedData.id },
      data: {
        montant: validatedData.montant,
        statut: validatedData.statut,
        description: validatedData.description,
      },
      include: {
        Adherent: {
          include: {
            User: true
          }
        }
      }
    });

    // Convertir les Decimal en Number
    const cotisationConverted = {
      ...cotisation,
      montant: Number(cotisation.montant)
    };

    return { success: true, data: cotisationConverted };

  } catch (error) {
    console.error("Erreur lors de la mise à jour de la cotisation:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Obtenir les statistiques des cotisations
export async function getCotisationStats() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé" };
    }

    const [
      totalAdherents,
      adherentsEnRetard,
      totalCotisationsMois,
      totalDettes,
      cotisationsValidees
    ] = await Promise.all([
      prisma.adherent.count({
        where: {
          User: { status: "Actif" }
        }
      }),
      prisma.adherent.count({
        where: {
          ObligationsCotisation: {
            some: {
              statut: "EnRetard"
            }
          }
        }
      }),
      prisma.cotisation.count({
        where: {
          dateCotisation: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      prisma.obligationCotisation.aggregate({
        where: {
          statut: { in: ["EnAttente", "PartiellementPaye", "EnRetard"] }
        },
        _sum: {
          montantRestant: true
        }
      }),
      prisma.cotisation.count({
        where: {
          statut: "Valide",
          dateCotisation: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      })
    ]);

    return {
      success: true,
      data: {
        totalAdherents,
        adherentsEnRetard,
        totalCotisationsMois,
        totalDettes: Number(totalDettes._sum.montantRestant || 0),
        cotisationsValidees,
        tauxRecouvrement: totalCotisationsMois > 0 ? (cotisationsValidees / totalCotisationsMois * 100).toFixed(1) : 0
      }
    };

  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Envoyer des relances automatiques
export async function sendAutomaticReminders() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return { success: false, error: "Non autorisé" };
    }

    // Trouver les adhérents avec une dette >= 3 mois
    const adherentsEnRetard = await prisma.adherent.findMany({
      where: {
        ObligationsCotisation: {
          some: {
            statut: "EnRetard"
          }
        }
      },
      include: {
        User: true,
        ObligationsCotisation: {
          where: {
            statut: "EnRetard"
          }
        }
      }
    });

    const relancesEnvoyees = [];

    for (const adherent of adherentsEnRetard) {
      const totalDette = adherent.ObligationsCotisation.reduce((sum, obligation) => {
        return sum + Number(obligation.montantRestant);
      }, 0);

      const cotisationMensuelle = 15 + 50;
      const moisDeRetard = Math.floor(totalDette / cotisationMensuelle);

      if (moisDeRetard >= 3) {
        // Créer une relance
        for (const obligation of adherent.ObligationsCotisation) {
          const relance = await prisma.relance.create({
            data: {
              adherentId: adherent.id,
              obligationCotisationId: obligation.id,
              type: "Email",
              statut: "EnAttente",
              contenu: `Bonjour ${adherent.firstname},\n\nVotre cotisation de ${Number(obligation.montantRestant).toFixed(2).replace('.', ',')} € est en retard de ${moisDeRetard} mois.\n\nVeuillez régulariser votre situation.\n\nCordialement,\nL'équipe AMAKI`,
              montantRappele: obligation.montantRestant,
            }
          });
          relancesEnvoyees.push(relance);
        }
      }
    }

    return { 
      success: true, 
      message: `${relancesEnvoyees.length} relances créées`,
      data: relancesEnvoyees.length
    };

  } catch (error) {
    console.error("Erreur lors de l'envoi des relances:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}
