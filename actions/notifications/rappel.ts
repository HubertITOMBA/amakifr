"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { UserRole, TypeNotification } from "@prisma/client";
import { addDays, subDays, isAfter, isBefore, format, differenceInDays } from "date-fns";
import { sendCustomEmailToUsers } from "@/lib/mail";
import { createNotification } from "@/actions/notifications";

/**
 * Types de rappels disponibles
 */
export type RappelType =
  | "evenement_3j"
  | "evenement_1j"
  | "evenement_jour_j"
  | "election_limite_candidature"
  | "evenement_limite_inscription"
  | "cotisation_7j"
  | "cotisation_jour_j";

/**
 * Exécute tous les rappels automatiques
 */
export async function executeRappelsAutomatiques() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const now = new Date();
    const rappelsEnvoyes = [];

    // 1. Rappels d'événements (3 jours avant, 1 jour avant, jour J)
    const rappelsEvenements = await sendRappelsEvenements(now);
    rappelsEnvoyes.push(...rappelsEvenements);

    // 2. Rappels de date limite de candidature
    const rappelsCandidatures = await sendRappelsLimiteCandidature(now);
    rappelsEnvoyes.push(...rappelsCandidatures);

    // 3. Rappels de date limite d'inscription à un événement
    const rappelsInscriptions = await sendRappelsLimiteInscription(now);
    rappelsEnvoyes.push(...rappelsInscriptions);

    // 4. Rappels d'échéance de cotisation (7 jours avant, jour J)
    const rappelsCotisations = await sendRappelsCotisations(now);
    rappelsEnvoyes.push(...rappelsCotisations);

    return {
      success: true,
      message: `${rappelsEnvoyes.length} rappel(s) envoyé(s)`,
      data: rappelsEnvoyes,
    };
  } catch (error) {
    console.error("Erreur lors de l'exécution des rappels:", error);
    return { success: false, error: "Erreur lors de l'exécution des rappels" };
  }
}

/**
 * Envoie les rappels pour les événements
 */
async function sendRappelsEvenements(now: Date) {
  const rappelsEnvoyes: any[] = [];

  // Événements dans 3 jours
  const date3Jours = addDays(now, 3);
  const evenements3Jours = await prisma.evenement.findMany({
    where: {
      statut: "Publie",
      dateDebut: {
        gte: subDays(date3Jours, 1),
        lte: addDays(date3Jours, 1),
      },
    },
    include: {
      Inscriptions: {
        include: {
          Adherent: {
            include: {
              User: {
                select: {
                  id: true,
                  email: true,
                  status: true,
                },
              },
            },
          },
        },
      },
    },
  });

  for (const evenement of evenements3Jours) {
    const joursRestants = differenceInDays(evenement.dateDebut, now);
    
    if (joursRestants === 3) {
      // Rappel 3 jours avant
      for (const inscription of evenement.Inscriptions) {
        if (inscription.Adherent.User?.status === "Actif" && inscription.Adherent.User.email) {
          await sendRappelEvenement(
            inscription.Adherent.User.id,
            inscription.Adherent.User.email,
            evenement,
            3
          );
          rappelsEnvoyes.push({
            type: "evenement_3j",
            evenement: evenement.titre,
            adherent: `${inscription.Adherent.firstname} ${inscription.Adherent.lastname}`,
          });
        }
      }
    } else if (joursRestants === 1) {
      // Rappel 1 jour avant
      for (const inscription of evenement.Inscriptions) {
        if (inscription.Adherent.User?.status === "Actif" && inscription.Adherent.User.email) {
          await sendRappelEvenement(
            inscription.Adherent.User.id,
            inscription.Adherent.User.email,
            evenement,
            1
          );
          rappelsEnvoyes.push({
            type: "evenement_1j",
            evenement: evenement.titre,
            adherent: `${inscription.Adherent.firstname} ${inscription.Adherent.lastname}`,
          });
        }
      }
    } else if (joursRestants === 0) {
      // Rappel jour J
      for (const inscription of evenement.Inscriptions) {
        if (inscription.Adherent.User?.status === "Actif" && inscription.Adherent.User.email) {
          await sendRappelEvenement(
            inscription.Adherent.User.id,
            inscription.Adherent.User.email,
            evenement,
            0
          );
          rappelsEnvoyes.push({
            type: "evenement_jour_j",
            evenement: evenement.titre,
            adherent: `${inscription.Adherent.firstname} ${inscription.Adherent.lastname}`,
          });
        }
      }
    }
  }

  return rappelsEnvoyes;
}

/**
 * Envoie un rappel d'événement
 */
async function sendRappelEvenement(
  userId: string,
  email: string,
  evenement: any,
  joursRestants: number
) {
  const message = joursRestants === 0
    ? `L'événement "${evenement.titre}" a lieu aujourd'hui !`
    : `Rappel : L'événement "${evenement.titre}" a lieu dans ${joursRestants} jour(s).`;

  const sujet = joursRestants === 0
    ? `🎉 ${evenement.titre} - Aujourd'hui !`
    : `📅 Rappel : ${evenement.titre} dans ${joursRestants} jour(s)`;

  const contenuEmail = `
Bonjour,

${message}

Date : ${format(new Date(evenement.dateDebut), "dd MMMM yyyy à HH:mm")}
${evenement.lieu ? `Lieu : ${evenement.lieu}` : ""}
${evenement.adresse ? `Adresse : ${evenement.adresse}` : ""}

${evenement.description ? `\n${evenement.description}` : ""}

Nous espérons vous voir nombreux !

Cordialement,
L'équipe AMAKI France
  `.trim();

  // Créer la notification
  await createNotification({
    userId,
    type: TypeNotification.Evenement,
    titre: sujet,
    message: contenuEmail,
    lien: `/evenements/${evenement.id}`,
  });

  // Envoyer l'email
  try {
    await sendCustomEmailToUsers(
      email,
      "Membre AMAKI",
      sujet,
      contenuEmail
    );
  } catch (error) {
    console.error(`Erreur lors de l'envoi de l'email à ${email}:`, error);
  }
}

/**
 * Envoie les rappels pour les dates limites de candidature
 */
async function sendRappelsLimiteCandidature(now: Date) {
  const rappelsEnvoyes: any[] = [];
  const dateLimite = addDays(now, 7); // 7 jours avant la date limite

  const elections = await prisma.election.findMany({
    where: {
      status: "Ouverte",
      dateClotureCandidature: {
        gte: now,
        lte: dateLimite,
      },
    },
    include: {
      candidacies: {
        include: {
          Adherent: {
            include: {
              User: {
                select: {
                  id: true,
                  email: true,
                  status: true,
                },
              },
            },
          },
        },
      },
    },
  });

  for (const election of elections) {
    const joursRestants = differenceInDays(election.dateClotureCandidature, now);

    // Envoyer aux adhérents actifs qui n'ont pas encore candidaté
    const adherentsActifs = await prisma.adherent.findMany({
      where: {
        User: {
          status: "Actif",
        },
        Candidacies: {
          none: {
            electionId: election.id,
          },
        },
      },
      include: {
        User: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    for (const adherent of adherentsActifs) {
      if (adherent.User?.email) {
        const sujet = `🗳️ Date limite de candidature : ${election.titre}`;
        const message = `La date limite pour candidater à "${election.titre}" est dans ${joursRestants} jour(s) (${format(election.dateLimiteCandidature, "dd MMMM yyyy")}).`;

        await createNotification({
          userId: adherent.User.id,
          type: TypeNotification.Election,
          titre: sujet,
          message,
          lien: `/candidatures`,
        });

        try {
          await sendCustomEmailToUsers(
            adherent.User.email,
            `${adherent.firstname} ${adherent.lastname}`,
            sujet,
            message
          );
        } catch (error) {
          console.error(`Erreur lors de l'envoi de l'email:`, error);
        }

        rappelsEnvoyes.push({
          type: "election_limite_candidature",
          election: election.titre,
          adherent: `${adherent.firstname} ${adherent.lastname}`,
        });
      }
    }
  }

  return rappelsEnvoyes;
}

/**
 * Envoie les rappels pour les dates limites d'inscription
 */
async function sendRappelsLimiteInscription(now: Date) {
  const rappelsEnvoyes: any[] = [];

  const evenements = await prisma.evenement.findMany({
    where: {
      statut: "Publie",
      inscriptionRequis: true,
      dateLimiteInscription: {
        gte: now,
        lte: addDays(now, 3), // 3 jours avant la date limite
      },
    },
  });

  for (const evenement of evenements) {
    if (!evenement.dateLimiteInscription) continue;

    const joursRestants = differenceInDays(evenement.dateLimiteInscription, now);

    // Récupérer les adhérents actifs non inscrits
    const adherentsActifs = await prisma.adherent.findMany({
      where: {
        User: {
          status: "Actif",
        },
        InscriptionsEvenements: {
          none: {
            evenementId: evenement.id,
          },
        },
      },
      include: {
        User: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    for (const adherent of adherentsActifs) {
      if (adherent.User?.email) {
        const sujet = `📝 Date limite d'inscription : ${evenement.titre}`;
        const message = `La date limite pour s'inscrire à "${evenement.titre}" est dans ${joursRestants} jour(s) (${format(evenement.dateLimiteInscription, "dd MMMM yyyy")}).`;

        await createNotification({
          userId: adherent.User.id,
          type: TypeNotification.Evenement,
          titre: sujet,
          message,
          lien: `/evenements/${evenement.id}`,
        });

        try {
          await sendCustomEmailToUsers(
            adherent.User.email,
            `${adherent.firstname} ${adherent.lastname}`,
            sujet,
            message
          );
        } catch (error) {
          console.error(`Erreur lors de l'envoi de l'email:`, error);
        }

        rappelsEnvoyes.push({
          type: "evenement_limite_inscription",
          evenement: evenement.titre,
          adherent: `${adherent.firstname} ${adherent.lastname}`,
        });
      }
    }
  }

  return rappelsEnvoyes;
}

/**
 * Envoie les rappels pour les échéances de cotisation
 */
async function sendRappelsCotisations(now: Date) {
  const rappelsEnvoyes: any[] = [];

  // Cotisations échéant dans 7 jours
  const date7Jours = addDays(now, 7);
  const obligations = await prisma.obligationCotisation.findMany({
    where: {
      statut: { in: ["EnAttente", "PartiellementPaye"] },
      dateEcheance: {
        gte: now,
        lte: date7Jours,
      },
    },
    include: {
      Adherent: {
        include: {
          User: {
            select: {
              id: true,
              email: true,
              status: true,
            },
          },
        },
      },
    },
  });

  for (const obligation of obligations) {
    if (!obligation.Adherent.User || obligation.Adherent.User.status !== "Actif") continue;

    const joursRestants = differenceInDays(obligation.dateEcheance, now);
    const email = obligation.Adherent.User.email;

    if (!email) continue;

    if (joursRestants === 7) {
      // Rappel 7 jours avant
      const sujet = `💰 Rappel : Échéance de cotisation dans 7 jours`;
      const message = `Votre cotisation de ${Number(obligation.montantRestant).toFixed(2).replace(".", ",")} € arrive à échéance le ${format(obligation.dateEcheance, "dd MMMM yyyy")}.`;

      await createNotification({
        userId: obligation.Adherent.User.id,
        type: TypeNotification.Cotisation,
        titre: sujet,
        message,
        lien: `/user/profile`,
      });

      try {
        await sendCustomEmailToUsers(email, `${obligation.Adherent.firstname} ${obligation.Adherent.lastname}`, sujet, message);
      } catch (error) {
        console.error(`Erreur lors de l'envoi de l'email:`, error);
      }

      rappelsEnvoyes.push({
        type: "cotisation_7j",
        adherent: `${obligation.Adherent.firstname} ${obligation.Adherent.lastname}`,
        montant: Number(obligation.montantRestant),
      });
    } else if (joursRestants === 0) {
      // Rappel jour J
      const sujet = `💰 Échéance de cotisation aujourd'hui`;
      const message = `Votre cotisation de ${Number(obligation.montantRestant).toFixed(2).replace(".", ",")} € arrive à échéance aujourd'hui.`;

      await createNotification({
        userId: obligation.Adherent.User.id,
        type: TypeNotification.Cotisation,
        titre: sujet,
        message,
        lien: `/user/profile`,
      });

      try {
        await sendCustomEmailToUsers(email, `${obligation.Adherent.firstname} ${obligation.Adherent.lastname}`, sujet, message);
      } catch (error) {
        console.error(`Erreur lors de l'envoi de l'email:`, error);
      }

      rappelsEnvoyes.push({
        type: "cotisation_jour_j",
        adherent: `${obligation.Adherent.firstname} ${obligation.Adherent.lastname}`,
        montant: Number(obligation.montantRestant),
      });
    }
  }

  return rappelsEnvoyes;
}

/**
 * Récupère les statistiques des rappels
 */
export async function getRappelsStats() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.Admin) {
      return { success: false, error: "Non autorisé" };
    }

    const now = new Date();
    const date7Jours = addDays(now, 7);
    const date3Jours = addDays(now, 3);

    const [
      evenementsProchains,
      electionsLimite,
      evenementsLimiteInscription,
      cotisationsEcheance,
    ] = await Promise.all([
      prisma.evenement.count({
        where: {
          statut: "Publie",
          dateDebut: {
            gte: now,
            lte: date3Jours,
          },
        },
      }),
      prisma.election.count({
        where: {
          status: "Ouverte",
          dateClotureCandidature: {
            gte: now,
            lte: date7Jours,
          },
        },
      }),
      prisma.evenement.count({
        where: {
          statut: "Publie",
          inscriptionRequis: true,
          dateLimiteInscription: {
            gte: now,
            lte: date3Jours,
          },
        },
      }),
      prisma.obligationCotisation.count({
        where: {
          statut: { in: ["EnAttente", "PartiellementPaye"] },
          dateEcheance: {
            gte: now,
            lte: date7Jours,
          },
        },
      }),
    ]);

    return {
      success: true,
      data: {
        evenementsProchains,
        electionsLimite,
        evenementsLimiteInscription,
        cotisationsEcheance,
      },
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques:", error);
    return { success: false, error: "Erreur lors de la récupération des statistiques" };
  }
}

