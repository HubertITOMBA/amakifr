"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { format } from "date-fns";

/**
 * Récupère toutes les données des adhérents pour export
 */
export async function getAdherentsForExport() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const adherents = await prisma.adherent.findMany({
      include: {
        User: {
          select: {
            email: true,
            status: true,
            createdAt: true,
          },
        },
        Adresse: {
          take: 1,
        },
        Telephones: {
          where: { estPrincipal: true },
          take: 1,
        },
        _count: {
          select: {
            ObligationsCotisation: true,
            CotisationsMensuelles: true,
            documents: true,
          },
        },
      },
      orderBy: {
        lastname: "asc",
      },
    });

    const exportData = adherents.map((adh) => ({
      "Civilité": adh.civility || "",
      "Prénom": adh.firstname,
      "Nom": adh.lastname,
      "Email": adh.User?.email || "",
      "Statut": adh.User?.status || "",
      "Date de naissance": adh.dateNaissance ? format(new Date(adh.dateNaissance), "dd/MM/yyyy") : "",
      "Profession": adh.profession || "",
      "Date première adhésion": adh.datePremiereAdhesion ? format(new Date(adh.datePremiereAdhesion), "dd/MM/yyyy") : "",
      "Frais adhésion payés": adh.fraisAdhesionPaye ? "Oui" : "Non",
      "Nombre d'enfants": adh.nombreEnfants,
      "Rue": adh.Adresse[0]?.street1 || "",
      "Code postal": adh.Adresse[0]?.codepost || "",
      "Ville": adh.Adresse[0]?.city || "",
      "Pays": adh.Adresse[0]?.country || "",
      "Téléphone": adh.Telephones[0]?.numero || "",
      "Type téléphone": adh.Telephones[0]?.type || "",
      "Nombre obligations": adh._count.ObligationsCotisation,
      "Nombre cotisations mensuelles": adh._count.CotisationsMensuelles,
      "Nombre documents": adh._count.documents,
      "Date création compte": adh.User?.createdAt ? format(new Date(adh.User.createdAt), "dd/MM/yyyy HH:mm") : "",
    }));

    return { success: true, data: exportData };
  } catch (error) {
    console.error("Erreur lors de la récupération des adhérents:", error);
    return { success: false, error: "Erreur lors de la récupération des données" };
  }
}

/**
 * Récupère l'historique des cotisations pour export
 */
export async function getCotisationsForExport() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const cotisations = await prisma.cotisation.findMany({
      include: {
        Adherent: {
          select: {
            firstname: true,
            lastname: true,
          },
        },
      },
      orderBy: {
        dateCotisation: "desc",
      },
    });

    const exportData = cotisations.map((cot) => ({
      "Date": format(new Date(cot.dateCotisation), "dd/MM/yyyy"),
      "Adhérent": `${cot.Adherent.firstname} ${cot.Adherent.lastname}`,
      "Type": cot.type,
      "Montant": Number(cot.montant).toFixed(2).replace(".", ","),
      "Moyen de paiement": cot.moyenPaiement,
      "Référence": cot.reference || "",
      "Description": cot.description || "",
      "Statut": cot.statut,
      "Date création": format(new Date(cot.createdAt), "dd/MM/yyyy HH:mm"),
    }));

    return { success: true, data: exportData };
  } catch (error) {
    console.error("Erreur lors de la récupération des cotisations:", error);
    return { success: false, error: "Erreur lors de la récupération des données" };
  }
}

/**
 * Récupère l'historique des paiements pour export
 */
export async function getPaiementsForExport() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const paiements = await prisma.paiementCotisation.findMany({
      include: {
        Adherent: {
          select: {
            firstname: true,
            lastname: true,
          },
        },
      },
      orderBy: {
        datePaiement: "desc",
      },
    });

    const exportData = paiements.map((paiement) => ({
      "Date paiement": format(new Date(paiement.datePaiement), "dd/MM/yyyy"),
      "Adhérent": `${paiement.Adherent.firstname} ${paiement.Adherent.lastname}`,
      "Montant": Number(paiement.montant).toFixed(2).replace(".", ","),
      "Moyen de paiement": paiement.moyenPaiement,
      "Référence": paiement.reference || "",
      "Description": paiement.description || "",
      "Statut": paiement.statut,
      "Date création": format(new Date(paiement.createdAt), "dd/MM/yyyy HH:mm"),
    }));

    return { success: true, data: exportData };
  } catch (error) {
    console.error("Erreur lors de la récupération des paiements:", error);
    return { success: false, error: "Erreur lors de la récupération des données" };
  }
}

/**
 * Récupère les événements et inscriptions pour export
 */
export async function getEvenementsForExport() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const evenements = await prisma.evenement.findMany({
      include: {
        _count: {
          select: {
            Inscriptions: true,
          },
        },
        CreatedBy: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        dateDebut: "desc",
      },
    });

    const exportData = evenements.map((event) => ({
      "Titre": event.titre,
      "Description": event.description || "",
      "Date début": format(new Date(event.dateDebut), "dd/MM/yyyy HH:mm"),
      "Date fin": event.dateFin ? format(new Date(event.dateFin), "dd/MM/yyyy HH:mm") : "",
      "Lieu": event.lieu || "",
      "Adresse": event.adresse || "",
      "Catégorie": event.categorie,
      "Statut": event.statut,
      "Prix": event.prix ? Number(event.prix).toFixed(2).replace(".", ",") : "",
      "Places disponibles": event.placesDisponibles || "",
      "Inscription requise": event.inscriptionRequis ? "Oui" : "Non",
      "Nombre inscriptions": event._count.Inscriptions,
      "Créé par": event.CreatedBy?.name || "",
      "Date création": format(new Date(event.createdAt), "dd/MM/yyyy HH:mm"),
    }));

    return { success: true, data: exportData };
  } catch (error) {
    console.error("Erreur lors de la récupération des événements:", error);
    return { success: false, error: "Erreur lors de la récupération des données" };
  }
}

/**
 * Récupère les inscriptions aux événements pour export
 */
export async function getInscriptionsEvenementsForExport() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const inscriptions = await prisma.inscriptionEvenement.findMany({
      include: {
        Evenement: {
          select: {
            titre: true,
            dateDebut: true,
          },
        },
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
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const exportData = inscriptions.map((inscription) => ({
      "Événement": inscription.Evenement.titre,
      "Date événement": format(new Date(inscription.Evenement.dateDebut), "dd/MM/yyyy HH:mm"),
      "Adhérent": `${inscription.Adherent.firstname} ${inscription.Adherent.lastname}`,
      "Email": inscription.Adherent.User?.email || "",
      "Nombre de personnes": inscription.nombrePersonnes,
      "Commentaires": inscription.commentaires || "",
      "Date inscription": format(new Date(inscription.createdAt), "dd/MM/yyyy HH:mm"),
    }));

    return { success: true, data: exportData };
  } catch (error) {
    console.error("Erreur lors de la récupération des inscriptions:", error);
    return { success: false, error: "Erreur lors de la récupération des données" };
  }
}

/**
 * Récupère les résultats des élections pour export
 */
export async function getElectionsResultsForExport() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const elections = await prisma.election.findMany({
      include: {
        Positions: {
          include: {
            Candidacies: {
              include: {
                Adherent: {
                  select: {
                    firstname: true,
                    lastname: true,
                  },
                },
                _count: {
                  select: {
                    Votes: true,
                  },
                },
              },
            },
            PosteTemplate: {
              select: {
                libelle: true,
              },
            },
          },
        },
      },
      orderBy: {
        dateDebut: "desc",
      },
    });

    const exportData: any[] = [];

    elections.forEach((election) => {
      election.Positions.forEach((position) => {
        position.Candidacies.forEach((candidacy) => {
          exportData.push({
            "Élection": election.titre,
            "Date élection": format(new Date(election.dateDebut), "dd/MM/yyyy"),
            "Poste": position.PosteTemplate?.libelle || "",
            "Candidat": `${candidacy.Adherent.firstname} ${candidacy.Adherent.lastname}`,
            "Statut candidature": candidacy.statut,
            "Nombre de votes": candidacy._count.Votes,
            "Date candidature": format(new Date(candidacy.createdAt), "dd/MM/yyyy HH:mm"),
          });
        });
      });
    });

    return { success: true, data: exportData };
  } catch (error) {
    console.error("Erreur lors de la récupération des résultats:", error);
    return { success: false, error: "Erreur lors de la récupération des données" };
  }
}

/**
 * Récupère les documents par adhérent pour export
 */
export async function getDocumentsForExport() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const documents = await prisma.document.findMany({
      include: {
        User: {
          select: {
            adherent: {
              select: {
                firstname: true,
                lastname: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const exportData = documents.map((doc) => ({
      "Adhérent": doc.User?.adherent
        ? `${doc.User.adherent.firstname} ${doc.User.adherent.lastname}`
        : "",
      "Nom du fichier": doc.nomFichier,
      "Type": doc.type,
      "Catégorie": doc.categorie || "",
      "Taille (Ko)": doc.taille ? (doc.taille / 1024).toFixed(2) : "",
      "Date upload": format(new Date(doc.createdAt), "dd/MM/yyyy HH:mm"),
    }));

    return { success: true, data: exportData };
  } catch (error) {
    console.error("Erreur lors de la récupération des documents:", error);
    return { success: false, error: "Erreur lors de la récupération des données" };
  }
}

/**
 * Récupère les relances envoyées pour export
 */
export async function getRelancesForExport() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const relances = await prisma.relance.findMany({
      include: {
        Adherent: {
          select: {
            firstname: true,
            lastname: true,
          },
        },
        ObligationCotisation: {
          select: {
            type: true,
            montantRestant: true,
          },
        },
      },
      orderBy: {
        dateEnvoi: "desc",
      },
    });

    const exportData = relances.map((relance) => ({
      "Date envoi": relance.dateEnvoi ? format(new Date(relance.dateEnvoi), "dd/MM/yyyy HH:mm") : "",
      "Adhérent": `${relance.Adherent.firstname} ${relance.Adherent.lastname}`,
      "Type": relance.ObligationCotisation?.type || "",
      "Montant restant": relance.ObligationCotisation?.montantRestant
        ? Number(relance.ObligationCotisation.montantRestant).toFixed(2).replace(".", ",")
        : "",
      "Type relance": relance.type,
      "Statut": relance.statut,
      "Date création": format(new Date(relance.createdAt), "dd/MM/yyyy HH:mm"),
    }));

    return { success: true, data: exportData };
  } catch (error) {
    console.error("Erreur lors de la récupération des relances:", error);
    return { success: false, error: "Erreur lors de la récupération des données" };
  }
}

