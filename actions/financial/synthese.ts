"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Récupère la synthèse financière complète de l'association
 * 
 * @returns Un objet avec success (boolean), data (synthèse complète) en cas de succès, ou error (string) en cas d'échec
 */
export async function getFinancialSynthese() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    // 1. RECETTES (Paiements validés)
    const paiementsValides = await prisma.paiementCotisation.findMany({
      where: { statut: "Valide" },
      include: {
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
      },
      orderBy: {
        datePaiement: 'desc'
      }
    });
    const totalRecettes = paiementsValides.reduce((sum, p) => sum + Number(p.montant), 0);

    // 2. DÉPENSES (Dépenses validées)
    const depensesValides = await prisma.depense.findMany({
      where: { statut: "Valide" },
      include: {
        CreatedBy: {
          select: {
            email: true
          }
        },
        TypeDepense: {
          select: {
            titre: true
          }
        }
      },
      orderBy: {
        dateDepense: 'desc'
      }
    });
    const totalDepenses = depensesValides.reduce((sum, d) => sum + Number(d.montant), 0);

    // 3. DETTES INITIALES (montants restants)
    const dettesInitiales = await prisma.detteInitiale.findMany({
      include: {
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
      },
      orderBy: [
        { annee: 'desc' },
        { adherentId: 'asc' }
      ]
    });
    const totalDettesInitiales = dettesInitiales.reduce((sum, d) => sum + Number(d.montantRestant), 0);

    // 4. COTISATIONS MENSUELLES (montants restants)
    const cotisationsMensuelles = await prisma.cotisationMensuelle.findMany({
      where: {
        statut: { in: ["EnAttente", "PartiellementPaye", "EnRetard"] }
      },
      include: {
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
        TypeCotisation: {
          select: {
            nom: true,
            montant: true
          }
        }
      },
      orderBy: [
        { annee: 'desc' },
        { mois: 'desc' },
        { adherentId: 'asc' }
      ]
    });
    const totalCotisationsMensuelles = cotisationsMensuelles.reduce((sum, c) => sum + Number(c.montantRestant), 0);

    // 5. ASSISTANCES (montants restants)
    const assistances = await prisma.assistance.findMany({
      where: {
        statut: { not: "Annule" }
      },
      include: {
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
      },
      orderBy: {
        dateEvenement: 'desc'
      }
    });
    const totalAssistances = assistances.reduce((sum, a) => sum + Number(a.montantRestant), 0);

    // 6. AVOIRS (crédits disponibles)
    const avoirs = await prisma.avoir.findMany({
      where: {
        statut: "Disponible",
        montantRestant: { gt: 0 }
      },
      include: {
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    const totalAvoirs = avoirs.reduce((sum, a) => sum + Number(a.montantRestant), 0);

    // 7. CALCUL DU SOLDE BANCAIRE ESTIMÉ
    // Solde = Recettes - Dépenses - Dettes à recevoir (négatif si on doit de l'argent)
    // Mais en réalité : Solde = Recettes - Dépenses (ce qu'on a vraiment en banque)
    // Les dettes sont ce qu'on doit recevoir, pas ce qu'on a déjà
    const soldeBancaireEstime = totalRecettes - totalDepenses;

    // 8. CRÉANCES (ce qu'on doit recevoir des adhérents)
    const totalCreances = totalDettesInitiales + totalCotisationsMensuelles + totalAssistances - totalAvoirs;

    // 9. SYNTHÈSE PAR ADHÉRENT
    const adherents = await prisma.adherent.findMany({
      include: {
        User: {
          select: {
            email: true,
            status: true
          }
        },
        DettesInitiales: {
          orderBy: { annee: 'desc' }
        },
        CotisationsMensuelles: {
          where: {
            statut: { in: ["EnAttente", "PartiellementPaye", "EnRetard"] }
          },
          orderBy: [
            { annee: 'desc' },
            { mois: 'desc' }
          ],
          include: {
            TypeCotisation: {
              select: {
                nom: true
              }
            }
          }
        },
        Assistances: {
          where: {
            statut: { not: "Annule" }
          },
          orderBy: { dateEvenement: 'desc' }
        },
        Avoirs: {
          where: {
            statut: "Disponible",
            montantRestant: { gt: 0 }
          },
          orderBy: { createdAt: 'desc' }
        },
        Paiements: {
          where: {
            statut: "Valide"
          },
          orderBy: { datePaiement: 'desc' }
        }
      },
      orderBy: [
        { lastname: 'asc' },
        { firstname: 'asc' }
      ]
    });

    const syntheseParAdherent = adherents.map(adherent => {
      // Dettes initiales
      const dettesInitialesAdherent = adherent.DettesInitiales.reduce((sum, d) => sum + Number(d.montantRestant), 0);
      
      // Cotisations mensuelles en cours (du mois actuel)
      const moisCourant = new Date().getMonth() + 1;
      const anneeCourante = new Date().getFullYear();
      const cotisationMoisCourant = adherent.CotisationsMensuelles.find(
        cm => cm.mois === moisCourant && cm.annee === anneeCourante
      );
      const cotisationMoisCourantMontant = cotisationMoisCourant ? Number(cotisationMoisCourant.montantRestant) : 0;
      
      // Toutes les cotisations mensuelles en attente
      const totalCotisationsMensuellesAdherent = adherent.CotisationsMensuelles.reduce(
        (sum, c) => sum + Number(c.montantRestant), 0
      );
      
      // Assistances en attente
      const assistancesAdherent = adherent.Assistances.filter(a => {
        const dateAss = new Date(a.dateEvenement);
        return dateAss.getMonth() + 1 === moisCourant && dateAss.getFullYear() === anneeCourante;
      });
      const totalAssistancesMoisCourant = assistancesAdherent.reduce((sum, a) => sum + Number(a.montantRestant), 0);
      
      // Avoirs disponibles
      const totalAvoirsAdherent = adherent.Avoirs.reduce((sum, a) => sum + Number(a.montantRestant), 0);
      
      // Total payé
      const totalPaye = adherent.Paiements.reduce((sum, p) => sum + Number(p.montant), 0);
      
      // Dette totale
      const detteTotale = dettesInitialesAdherent + totalCotisationsMensuellesAdherent + 
        assistancesAdherent.reduce((sum, a) => sum + Number(a.montantRestant), 0);
      
      // Dette nette (après avoirs)
      const detteNette = Math.max(0, detteTotale - totalAvoirsAdherent);
      
      return {
        id: adherent.id,
        nom: `${adherent.firstname || ''} ${adherent.lastname || ''}`.trim() || 'Non renseigné',
        email: adherent.User?.email || '',
        statut: adherent.User?.status || 'Inactif',
        dettesInitiales: dettesInitialesAdherent,
        cotisationMoisCourant: cotisationMoisCourantMontant,
        assistanceMoisCourant: totalAssistancesMoisCourant,
        totalCotisationsMensuelles: totalCotisationsMensuellesAdherent,
        totalAssistances: assistancesAdherent.reduce((sum, a) => sum + Number(a.montantRestant), 0),
        totalAvoirs: totalAvoirsAdherent,
        totalPaye: totalPaye,
        detteTotale: detteTotale,
        detteNette: detteNette,
        solde: totalPaye - detteTotale + totalAvoirsAdherent // Ce que l'adhérent a payé en trop ou en moins
      };
    });

    // 10. STATISTIQUES GLOBALES
    const stats = {
      totalRecettes: Number(totalRecettes.toFixed(2)),
      totalDepenses: Number(totalDepenses.toFixed(2)),
      totalDettesInitiales: Number(totalDettesInitiales.toFixed(2)),
      totalCotisationsMensuelles: Number(totalCotisationsMensuelles.toFixed(2)),
      totalAssistances: Number(totalAssistances.toFixed(2)),
      totalAvoirs: Number(totalAvoirs.toFixed(2)),
      totalCreances: Number(totalCreances.toFixed(2)),
      soldeBancaireEstime: Number(soldeBancaireEstime.toFixed(2)),
      nombreAdherents: adherents.length,
      nombreAdherentsAvecDette: syntheseParAdherent.filter(a => a.detteNette > 0).length,
      nombreAdherentsAvecAvoir: syntheseParAdherent.filter(a => a.totalAvoirs > 0).length,
      nombrePaiements: paiementsValides.length,
      nombreDepenses: depensesValides.length
    };

    return {
      success: true,
      data: {
        stats,
        syntheseParAdherent,
        paiements: paiementsValides.map(p => ({
          id: p.id,
          date: p.datePaiement.toISOString(),
          adherent: `${p.Adherent?.firstname || ''} ${p.Adherent?.lastname || ''}`.trim() || 'Non renseigné',
          montant: Number(p.montant),
          moyenPaiement: p.moyenPaiement,
          reference: p.reference || ''
        })),
        depenses: depensesValides.map(d => ({
          id: d.id,
          date: d.dateDepense.toISOString(),
          libelle: d.libelle,
          montant: Number(d.montant),
          type: d.TypeDepense?.titre || d.categorie || 'Non spécifié',
          createdBy: d.CreatedBy?.email || ''
        })),
        dateGeneration: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error("Erreur lors de la récupération de la synthèse financière:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

