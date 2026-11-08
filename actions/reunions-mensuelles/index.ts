"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { UserRole, StatutReunionMensuelle, TypeLieuReunion, StatutParticipationReunion } from "@prisma/client";
import { logCreation, logModification, logDeletion } from "@/lib/activity-logger";
import { sendEmail } from "@/lib/mail";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  hostWithdrawalLocationPatch,
} from "@/lib/services/reunions/reunion-helpers";
import {
  applyAdminParticipationDeltaItem,
  isParticipationUniqueViolation,
  ParticipationConflictError,
} from "@/lib/services/reunions/admin-apply-participation-delta";
import {
  ReunionParticipationNotWritableError,
  sortParticipationDeltaByAdherentId,
  withReunionParticipationLocks,
  withReunionRowLock,
  type ReunionLockTx,
} from "@/lib/services/reunions/reunion-row-lock";

// Schémas de validation
const CreateReunionMensuelleSchema = z.object({
  annee: z.number().int().min(2020).max(2100),
  mois: z.number().int().min(1).max(12),
  adherentHoteId: z.string().optional(), // Optionnel : si non fourni, utilise l'adhérent connecté
});

const UpdateReunionMensuelleSchema = z.object({
  id: z.string().min(1, "ID requis"),
  annee: z.number().int().min(2020).max(2100).optional(),
  mois: z.number().int().min(1).max(12).optional(),
  adherentHoteId: z.string().optional(),
  dateReunion: z.string().optional(), // ISO string
  typeLieu: z.enum(["Domicile", "Restaurant", "Autre"]).optional(),
  adresse: z.string().optional(),
  nomRestaurant: z.string().optional(),
  commentaires: z.string().optional(),
  statut: z.enum(["EnAttente", "MoisValide", "DateConfirmee", "Annulee"]).optional(),
});

const ConfirmerParticipationSchema = z.object({
  reunionId: z.string().min(1, "ID de réunion requis"),
  statut: z.enum(["Present", "Absent", "Excuse"]),
  commentaire: z.string().optional(),
});

/**
 * État attendu avant mutation admin (comparaison atomique sans version).
 * - `absent` : aucune ligne ParticipationReunion
 * - `row` : ligne présente avec statut + justificatif donnés
 *
 * Limite : ne détecte pas un aller-retour A→B→A sans champ version.
 */
const AdminExpectedParticipationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("absent") }),
  z.object({
    kind: z.literal("row"),
    statut: z.enum(["Present", "Absent", "Excuse", "NonRepondu"]),
    justificatifFournit: z.boolean(),
  }),
]);

const AdminSetParticipationsSchema = z.object({
  reunionId: z.string().min(1, "ID de réunion requis"),
  participations: z.array(
    z.object({
      adherentId: z.string().min(1, "ID adhérent requis"),
      statut: z.enum(["Present", "Absent", "Excuse", "NonRepondu"]),
      justificatifFournit: z.boolean().optional(),
      justificatifNote: z.string().optional(),
      commentaire: z.string().optional(),
      expected: AdminExpectedParticipationSchema,
    })
  ),
});

/**
 * Créer une nouvelle réunion mensuelle (adhérent choisit le mois)
 */
export async function createReunionMensuelle(data: z.infer<typeof CreateReunionMensuelleSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = CreateReunionMensuelleSchema.parse(data);

    // Vérifier qu'il n'existe pas déjà une réunion pour ce mois/année
    const existing = await prisma.reunionMensuelle.findUnique({
      where: {
        annee_mois: {
          annee: validatedData.annee,
          mois: validatedData.mois,
        },
      },
    });

    if (existing) {
      const msg = !existing.adherentHoteId
        ? `Une réunion existe déjà pour ce mois sans hôte. Ouvrez la réunion et désignez un adhérent hôte.`
        : `Une réunion existe déjà pour ${validatedData.mois}/${validatedData.annee}`;
      return { success: false, error: msg };
    }

    let adherentHoteId = validatedData.adherentHoteId;

    if (adherentHoteId) {
      // Création avec hôte désigné : réservé à l'admin (ou permission createReunionMensuelle)
      const { canWrite } = await import("@/lib/dynamic-permissions");
      const hasAccess = await canWrite(session.user.id, "createReunionMensuelle");
      if (!hasAccess) {
        return { success: false, error: "Seul un administrateur peut créer une réunion en désignant l'hôte." };
      }
    } else {
      // Pas d'hôte fourni : l'adhérent connecté choisit le mois et sera l'hôte (rôle MEMBRE requis)
      if (session.user.role !== UserRole.MEMBRE) {
        return { success: false, error: "Seuls les membres peuvent choisir un mois pour être hôte. Un admin peut créer une réunion depuis Admin > Réunions mensuelles en choisissant le mois et l'hôte." };
      }
      const adherentConnecte = await prisma.adherent.findUnique({
        where: { userId: session.user.id },
      });
      if (!adherentConnecte) {
        return { success: false, error: "Adhérent non trouvé pour l'utilisateur connecté" };
      }
      adherentHoteId = adherentConnecte.id;
    }

    // Vérifier que l'adhérent hôte existe et est MEMBRE actif
    const adherentHote = await prisma.adherent.findUnique({
      where: { id: adherentHoteId },
      include: { User: true },
    });

    if (!adherentHote || adherentHote.User.role !== UserRole.MEMBRE || adherentHote.User.status !== "Actif") {
      return { success: false, error: "L'adhérent hôte doit être un membre actif" };
    }

    // Un adhérent ne peut être hôte que d'une réunion par année
    const autreReunionMemeAnnee = await prisma.reunionMensuelle.findFirst({
      where: { adherentHoteId, annee: validatedData.annee },
    });
    if (autreReunionMemeAnnee) {
      return {
        success: false,
        error: "Un adhérent ne peut être hôte que d'une réunion par année. Cet adhérent est déjà hôte d'une réunion cette année.",
      };
    }

    const reunion = await prisma.reunionMensuelle.create({
      data: {
        annee: validatedData.annee,
        mois: validatedData.mois,
        adherentHoteId: adherentHoteId,
        statut: StatutReunionMensuelle.EnAttente,
        createdBy: session.user.id,
      },
      include: {
        AdherentHote: {
          include: {
            User: { select: { email: true, name: true } },
          },
        },
      },
    });

    await logCreation(
      `Réunion mensuelle créée pour ${validatedData.mois}/${validatedData.annee} - Hôte: ${adherentHote.firstname} ${adherentHote.lastname}`,
      "ReunionMensuelle",
      reunion.id
    );

    revalidatePath("/admin/reunions-mensuelles");
    revalidatePath("/reunions-mensuelles");

    return { success: true, data: reunion };
  } catch (error) {
    console.error("Erreur lors de la création de la réunion mensuelle:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: "Erreur interne du serveur" };
  }
}

/**
 * Valider la réunion (admin). L'admin ne peut valider que si l'adhérent hôte a déjà choisi la date.
 *
 * Protocole writers : TX → verrou réunion → relecture statut/date → update via `tx`.
 * Email / log / revalidate **après** commit (aucun appel externe sous verrou).
 */
export async function validerMoisReunion(reunionId: string) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return { success: false, error: "Non autorisé" };
    }

    const { canWrite } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canWrite(userId, "validerMoisReunion");
    if (!hasAccess) {
      return { success: false, error: "Non autorisé" };
    }

    type ValiderUpdated = {
      mois: number;
      annee: number;
      dateReunion: Date | null;
      AdherentHote: {
        firstname: string | null;
        lastname: string | null;
        User: { email: string | null; name: string | null } | null;
      } | null;
    };
    type ValiderResult =
      | { ok: false; error: string }
      | { ok: true; updated: ValiderUpdated };

    const txResult = await prisma.$transaction(async (tx) => {
      return withReunionRowLock(
        tx as unknown as ReunionLockTx,
        reunionId,
        async (): Promise<ValiderResult> => {
          const reunion = await tx.reunionMensuelle.findUnique({
            where: { id: reunionId },
            include: {
              AdherentHote: {
                include: {
                  User: { select: { email: true, name: true } },
                },
              },
            },
          });

          if (!reunion) {
            return { ok: false, error: "Réunion non trouvée" };
          }

          if (reunion.statut !== StatutReunionMensuelle.EnAttente) {
            return {
              ok: false,
              error: "Cette réunion est déjà validée ou annulée",
            };
          }

          if (!reunion.dateReunion) {
            return {
              ok: false,
              error:
                "L'adhérent hôte doit d'abord choisir la date de la réunion (samedi du mois) avant que l'admin puisse valider.",
            };
          }

          const updated = (await tx.reunionMensuelle.update({
            where: { id: reunionId },
            data: {
              statut: StatutReunionMensuelle.DateConfirmee,
              updatedBy: userId,
            },
            include: {
              AdherentHote: {
                include: {
                  User: { select: { email: true, name: true } },
                },
              },
            },
          })) as ValiderUpdated;

          return { ok: true, updated };
        }
      );
    });

    if (!txResult.ok) {
      return { success: false, error: txResult.error };
    }

    const { updated } = txResult;

    await logModification(
      `Mois validé pour la réunion ${updated.mois}/${updated.annee}`,
      "ReunionMensuelle",
      reunionId
    );

    if (updated.AdherentHote?.User?.email && updated.dateReunion) {
      const moisLabel = [
        "janvier", "février", "mars", "avril", "mai", "juin",
        "juillet", "août", "septembre", "octobre", "novembre", "décembre"
      ][updated.mois - 1];
      const dateFormatee = format(new Date(updated.dateReunion), "EEEE d MMMM yyyy", { locale: fr });
      try {
        await sendEmail({
          to: updated.AdherentHote.User.email,
          subject: `Réunion mensuelle ${moisLabel} ${updated.annee} - Validée`,
          html: `
            <p>Bonjour ${updated.AdherentHote.firstname || ""} ${updated.AdherentHote.lastname || ""},</p>
            <p>La réunion mensuelle du <strong>${dateFormatee}</strong> a été validée par l'administrateur.</p>
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/reunions-mensuelles" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Voir la réunion</a></p>
            <p>Cordialement,<br>L'équipe AMAKI France</p>
          `,
        }, false);
      } catch (error) {
        console.error("Erreur lors de l'envoi de l'email à l'hôte:", error);
      }
    }

    revalidatePath("/admin/reunions-mensuelles");
    revalidatePath("/reunions-mensuelles");

    return { success: true, data: updated };
  } catch (error) {
    if (error instanceof Error && error.name === "ReunionNotFoundError") {
      return { success: false, error: "Réunion non trouvée" };
    }
    console.error("Erreur lors de la validation du mois:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

/**
 * Se désister comme hôte (uniquement si la date de la réunion est à 28 jours ou plus).
 * Libère l'hôte pour qu'un autre adhérent puisse prendre la réunion (mois conservé, statut EnAttente).
 *
 * Protocole writers : TX → verrou réunion → relecture → update via `tx`
 * (statut EnAttente, date null). Log / revalidate après commit.
 */
export async function desisterReunionMensuelle(reunionId: string) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return { success: false, error: "Non autorisé" };
    }

    type DesisterResult =
      | { ok: false; error: string }
      | { ok: true; mois: number; annee: number; nomHote: string };

    const txResult = await prisma.$transaction(async (tx) => {
      return withReunionRowLock(
        tx as unknown as ReunionLockTx,
        reunionId,
        async (): Promise<DesisterResult> => {
          const reunion = await tx.reunionMensuelle.findUnique({
            where: { id: reunionId },
            include: { AdherentHote: { include: { User: true } } },
          });

          if (!reunion) {
            return { ok: false, error: "Réunion non trouvée" };
          }

          if (!reunion.AdherentHote) {
            return {
              ok: false,
              error: "Cette réunion n'a pas d'hôte assigné.",
            };
          }

          if (reunion.AdherentHote.userId !== userId) {
            return {
              ok: false,
              error: "Seul l'hôte de la réunion peut se désister.",
            };
          }

          const now = new Date();
          now.setHours(0, 0, 0, 0);
          const dans28Jours = new Date(now);
          dans28Jours.setDate(dans28Jours.getDate() + 28);

          if (reunion.dateReunion) {
            const dateReunion = new Date(reunion.dateReunion);
            dateReunion.setHours(0, 0, 0, 0);
            if (dateReunion.getTime() < dans28Jours.getTime()) {
              return {
                ok: false,
                error:
                  "Vous ne pouvez vous désister que si la réunion a lieu dans 28 jours ou plus. La date actuelle est à moins de 28 jours.",
              };
            }
          }

          const nomHote = `${reunion.AdherentHote.firstname} ${reunion.AdherentHote.lastname}`;

          await tx.reunionMensuelle.update({
            where: { id: reunionId },
            data: {
              adherentHoteId: null,
              statut: StatutReunionMensuelle.EnAttente,
              dateReunion: null,
              updatedBy: userId,
              ...hostWithdrawalLocationPatch(reunion.typeLieu),
            },
          });

          return {
            ok: true,
            mois: reunion.mois,
            annee: reunion.annee,
            nomHote,
          };
        }
      );
    });

    if (!txResult.ok) {
      return { success: false, error: txResult.error };
    }

    await logModification(
      `Réunion mensuelle ${txResult.mois}/${txResult.annee} : désistement de l'hôte (${txResult.nomHote}). Un nouvel hôte peut être désigné.`,
      "ReunionMensuelle",
      reunionId
    );

    revalidatePath("/admin/reunions-mensuelles");
    revalidatePath("/reunions-mensuelles");

    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.name === "ReunionNotFoundError") {
      return { success: false, error: "Réunion non trouvée" };
    }
    console.error("Erreur lors du désistement:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

/**
 * Mettre à jour une réunion mensuelle (admin ou hôte si mois validé).
 *
 * Protocole writers : TX → verrou réunion → relecture statut/date → update via `tx`.
 * Unicité croisée : lectures sans FOR UPDATE sur d'autres réunions (évite deadlock).
 * Emails / log / revalidate **après** commit.
 */
export async function updateReunionMensuelle(data: z.infer<typeof UpdateReunionMensuelleSchema>) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = UpdateReunionMensuelleSchema.parse(data);
    const isAdmin = session.user?.role === UserRole.ADMIN;

    // Type large : include Prisma non inféré proprement après update sous TX
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type UpdatedReunion = any;
    type UpdateTxResult =
      | { ok: false; error: string }
      | {
          ok: true;
          previousStatut: StatutReunionMensuelle;
          previousMois: number;
          previousAnnee: number;
          updated: UpdatedReunion;
        };

    const txResult = await prisma.$transaction(async (tx) => {
      return withReunionRowLock(
        tx as unknown as ReunionLockTx,
        validatedData.id,
        async (): Promise<UpdateTxResult> => {
          const reunion = await tx.reunionMensuelle.findUnique({
            where: { id: validatedData.id },
            include: {
              AdherentHote: { include: { User: true } },
            },
          });

          if (!reunion) {
            return { ok: false, error: "Réunion non trouvée" };
          }

          const isHote = Boolean(
            reunion.AdherentHote?.userId &&
              reunion.AdherentHote.userId === userId
          );
          const peutModifierHote =
            reunion.statut === StatutReunionMensuelle.MoisValide ||
            reunion.statut === StatutReunionMensuelle.DateConfirmee ||
            reunion.statut === StatutReunionMensuelle.EnAttente;

          if (!reunion.AdherentHote) {
            if (!isAdmin) {
              return {
                ok: false,
                error:
                  "Cette réunion est en attente d'un nouvel hôte. Seul un administrateur peut en désigner un.",
              };
            }
            if (!validatedData.adherentHoteId) {
              return {
                ok: false,
                error: "Veuillez sélectionner un adhérent comme nouvel hôte.",
              };
            }
          } else {
            if (!isAdmin && (!isHote || !peutModifierHote)) {
              return {
                ok: false,
                error: "Vous ne pouvez pas modifier cette réunion.",
              };
            }
            if (
              validatedData.adherentHoteId &&
              validatedData.adherentHoteId !== reunion.adherentHoteId &&
              !isAdmin
            ) {
              return {
                ok: false,
                error: "Seul un administrateur peut changer l'hôte de la réunion",
              };
            }
          }

          const effectiveAnnee = validatedData.annee ?? reunion.annee;
          const effectiveMois = validatedData.mois ?? reunion.mois;
          if (
            validatedData.adherentHoteId &&
            validatedData.adherentHoteId !== reunion.adherentHoteId
          ) {
            const autreReunionMemeAnnee = await tx.reunionMensuelle.findFirst({
              where: {
                adherentHoteId: validatedData.adherentHoteId,
                annee: effectiveAnnee,
                id: { not: reunion.id },
              },
            });
            if (autreReunionMemeAnnee) {
              return {
                ok: false,
                error:
                  "Un adhérent ne peut être hôte que d'une réunion par année. Cet adhérent est déjà hôte d'une réunion cette année.",
              };
            }
          }

          if (
            isAdmin &&
            (validatedData.annee !== undefined || validatedData.mois !== undefined)
          ) {
            const newAnnee = validatedData.annee ?? reunion.annee;
            const newMois = validatedData.mois ?? reunion.mois;
            if (newAnnee !== reunion.annee || newMois !== reunion.mois) {
              const autreReunionMemeMois = await tx.reunionMensuelle.findUnique({
                where: { annee_mois: { annee: newAnnee, mois: newMois } },
              });
              if (autreReunionMemeMois && autreReunionMemeMois.id !== reunion.id) {
                return {
                  ok: false,
                  error: `Une réunion existe déjà pour le mois ${newMois}/${newAnnee}.`,
                };
              }
            }
          }

          let parsedDateReunion: Date | undefined;
          if (validatedData.dateReunion) {
            const d = new Date(validatedData.dateReunion);
            if (Number.isNaN(d.getTime())) {
              return { ok: false, error: "Date de réunion invalide" };
            }
            if (d.getUTCDay() !== 6) {
              return {
                ok: false,
                error: "La réunion ne peut avoir lieu qu'un samedi.",
              };
            }
            if (
              d.getUTCFullYear() !== effectiveAnnee ||
              d.getUTCMonth() + 1 !== effectiveMois
            ) {
              return {
                ok: false,
                error: "La date choisie doit être dans le mois de la réunion.",
              };
            }
            if (isHote && !isAdmin) {
              const now = new Date();
              const septJoursPlusTard = new Date(now);
              septJoursPlusTard.setDate(septJoursPlusTard.getDate() + 7);
              if (d < septJoursPlusTard) {
                return {
                  ok: false,
                  error:
                    "La date de la réunion doit être au moins 7 jours à l'avance.",
                };
              }
              if (reunion.dateReunion) {
                const dateActuelle = new Date(reunion.dateReunion);
                if (dateActuelle <= septJoursPlusTard) {
                  return {
                    ok: false,
                    error:
                      "Vous ne pouvez plus modifier la date : la réunion a lieu dans moins de 7 jours.",
                  };
                }
              }
            }
            parsedDateReunion = d;
          }

          const updateData: Record<string, unknown> = {};
          if (validatedData.annee !== undefined) updateData.annee = validatedData.annee;
          if (validatedData.mois !== undefined) updateData.mois = validatedData.mois;
          if (validatedData.adherentHoteId)
            updateData.adherentHoteId = validatedData.adherentHoteId;
          if (parsedDateReunion) updateData.dateReunion = parsedDateReunion;
          if (validatedData.typeLieu) updateData.typeLieu = validatedData.typeLieu;
          if (validatedData.adresse !== undefined)
            updateData.adresse = validatedData.adresse;
          if (validatedData.nomRestaurant !== undefined)
            updateData.nomRestaurant = validatedData.nomRestaurant;
          if (validatedData.commentaires !== undefined)
            updateData.commentaires = validatedData.commentaires;
          if (validatedData.statut) updateData.statut = validatedData.statut;
          updateData.updatedBy = userId;

          if (
            isAdmin &&
            (validatedData.annee !== undefined || validatedData.mois !== undefined) &&
            reunion.dateReunion &&
            !parsedDateReunion
          ) {
            const newAnnee = validatedData.annee ?? reunion.annee;
            const newMois = validatedData.mois ?? reunion.mois;
            const dr = new Date(reunion.dateReunion);
            if (
              dr.getUTCFullYear() !== newAnnee ||
              dr.getUTCMonth() + 1 !== newMois
            ) {
              updateData.dateReunion = null;
            }
          }

          if (
            validatedData.dateReunion &&
            reunion.statut === StatutReunionMensuelle.MoisValide
          ) {
            updateData.statut = StatutReunionMensuelle.DateConfirmee;
          }

          const updated = await tx.reunionMensuelle.update({
            where: { id: validatedData.id },
            data: updateData,
            include: {
              AdherentHote: {
                include: {
                  User: { select: { email: true, name: true } },
                  Telephones: true,
                },
              },
              Participations: {
                include: {
                  Adherent: {
                    include: {
                      User: { select: { id: true, email: true } },
                    },
                  },
                },
              },
            },
          });

          return {
            ok: true,
            previousStatut: reunion.statut,
            previousMois: reunion.mois,
            previousAnnee: reunion.annee,
            updated,
          };
        }
      );
    });

    if (!txResult.ok) {
      return { success: false, error: txResult.error };
    }

    const { updated, previousStatut, previousMois, previousAnnee } = txResult;

    await logModification(
      `Réunion mensuelle ${previousMois}/${previousAnnee} mise à jour`,
      "ReunionMensuelle",
      validatedData.id
    );

    if (
      updated.statut === StatutReunionMensuelle.DateConfirmee &&
      updated.dateReunion &&
      previousStatut !== StatutReunionMensuelle.DateConfirmee
    ) {
      const membres = await prisma.adherent.findMany({
        where: {
          User: {
            status: "Actif",
            role: UserRole.MEMBRE,
          },
        },
        include: {
          User: { select: { email: true, name: true } },
        },
      });

      const moisLabel = [
        "janvier", "février", "mars", "avril", "mai", "juin",
        "juillet", "août", "septembre", "octobre", "novembre", "décembre"
      ][previousMois - 1];

      const dateFormatee = format(
        new Date(updated.dateReunion),
        "EEEE d MMMM yyyy",
        { locale: fr }
      );

      let lieuTexte = "";
      if (updated.typeLieu === "Domicile") {
        lieuTexte = `Chez ${updated.AdherentHote?.firstname || ""} ${updated.AdherentHote?.lastname || ""}`;
        if (updated.AdherentHote?.address) {
          lieuTexte += ` - ${updated.AdherentHote.address}`;
        }
      } else if (updated.typeLieu === "Restaurant") {
        lieuTexte = updated.nomRestaurant || "Restaurant";
        if (updated.adresse) {
          lieuTexte += ` - ${updated.adresse}`;
        }
      } else {
        lieuTexte = updated.adresse || "Lieu à confirmer";
      }

      for (const membre of membres) {
        if (membre.User?.email && membre.id !== updated.adherentHoteId) {
          try {
            await sendEmail({
              to: membre.User.email,
              subject: `Réunion mensuelle ${moisLabel} ${previousAnnee} - Date confirmée`,
              html: `
                <p>Bonjour ${membre.firstname || ""} ${membre.lastname || ""},</p>
                <p>La date de la réunion mensuelle de <strong>${moisLabel} ${previousAnnee}</strong> a été confirmée.</p>
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 15px 0;">
                  <p><strong>📅 Date :</strong> ${dateFormatee}</p>
                  <p><strong>📍 Lieu :</strong> ${lieuTexte}</p>
                  <p><strong>👤 Hôte :</strong> ${updated.AdherentHote?.firstname || ""} ${updated.AdherentHote?.lastname || ""}</p>
                  ${updated.commentaires ? `<p><strong>💬 Commentaires :</strong> ${updated.commentaires}</p>` : ""}
                </div>
                <p>Merci de confirmer votre présence à l'avance en vous connectant sur la plateforme.</p>
                <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/reunions-mensuelles" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Confirmer ma présence</a></p>
                <p>Cordialement,<br>L'équipe AMAKI France</p>
              `,
            }, false);
          } catch (error) {
            console.error(`Erreur lors de l'envoi de l'email à ${membre.User.email}:`, error);
          }
        }
      }
    }

    revalidatePath("/admin/reunions-mensuelles");
    revalidatePath("/reunions-mensuelles");

    return { success: true, data: updated };
  } catch (error) {
    if (error instanceof Error && error.name === "ReunionNotFoundError") {
      return { success: false, error: "Réunion non trouvée" };
    }
    console.error("Erreur lors de la mise à jour de la réunion:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: "Erreur interne du serveur" };
  }
}

/**
 * Obtenir toutes les réunions mensuelles
 */
export async function getAllReunionsMensuelles() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const reunions = await prisma.reunionMensuelle.findMany({
      include: {
        AdherentHote: {
          include: {
            User: { select: { email: true, name: true } },
            Telephones: true,
          },
        },
        Participations: {
          include: {
            Adherent: {
              include: {
                User: { select: { id: true, email: true, role: true, status: true } },
              },
            },
          },
        },
        Rapport: {
          select: {
            id: true,
            titre: true,
            dateReunion: true,
            statut: true,
            publishedAt: true,
          },
        },
        CreatedBy: { select: { name: true, email: true } },
        UpdatedBy: { select: { name: true, email: true } },
      },
      orderBy: [
        { annee: "desc" },
        { mois: "desc" },
      ],
    });

    return { success: true, data: reunions };
  } catch (error) {
    console.error("Erreur lors de la récupération des réunions:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

/**
 * Obtenir une réunion par ID
 */
export async function getReunionMensuelleById(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const reunion = await prisma.reunionMensuelle.findUnique({
      where: { id },
      include: {
        AdherentHote: {
          include: {
            User: { select: { email: true, name: true } },
            Telephones: true,
          },
        },
        Participations: {
          include: {
            Adherent: {
              include: {
                User: {
                  select: { id: true, email: true, role: true, status: true },
                },
              },
            },
          },
        },
        Rapport: {
          select: {
            id: true,
            titre: true,
            dateReunion: true,
            statut: true,
            publishedAt: true,
          },
        },
        CreatedBy: { select: { name: true, email: true } },
        UpdatedBy: { select: { name: true, email: true } },
      },
    });

    if (!reunion) {
      return { success: false, error: "Réunion non trouvée" };
    }

    return { success: true, data: reunion };
  } catch (error) {
    console.error("Erreur lors de la récupération de la réunion:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

/**
 * Confirmer sa participation à une réunion (adhérent).
 *
 * Protocole : TX → verrou réunion → relecture → assert → verrou participation → upsert `tx`.
 */
export async function confirmerParticipationReunion(data: z.infer<typeof ConfirmerParticipationSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const validatedData = ConfirmerParticipationSchema.parse(data);

    const adherent = await prisma.adherent.findUnique({
      where: { userId: session.user.id },
    });

    if (!adherent) {
      return { success: false, error: "Adhérent non trouvé" };
    }

    const participation = await prisma.$transaction(async (tx) => {
      return withReunionParticipationLocks(
        tx as unknown as ReunionLockTx,
        validatedData.reunionId,
        [adherent.id],
        async () => {
          return tx.participationReunion.upsert({
            where: {
              reunionId_adherentId: {
                reunionId: validatedData.reunionId,
                adherentId: adherent.id,
              },
            },
            create: {
              reunionId: validatedData.reunionId,
              adherentId: adherent.id,
              statut: validatedData.statut as StatutParticipationReunion,
              commentaire: validatedData.commentaire,
            },
            update: {
              statut: validatedData.statut as StatutParticipationReunion,
              commentaire: validatedData.commentaire,
            },
          });
        }
      );
    });

    revalidatePath("/reunions-mensuelles");
    revalidatePath("/admin/reunions-mensuelles");

    return { success: true, data: participation };
  } catch (error) {
    if (error instanceof ReunionParticipationNotWritableError) {
      if (error.message === "Réunion non trouvée") {
        return { success: false, error: "Réunion non trouvée" };
      }
      return { success: false, error: error.message };
    }
    console.error("Erreur lors de la confirmation de participation:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: "Erreur interne du serveur" };
  }
}

/**
 * Retirer sa propre participation (web) — canonique : suppression de ligne.
 *
 * Protocole : TX → verrou réunion → relecture → assert → verrou participation → deleteMany `tx`.
 *
 * @param reunionId - Identifiant de la réunion
 * @returns success + alreadyClear si aucune ligne n'existait
 */
export async function retirerParticipationReunion(reunionId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const adherent = await prisma.adherent.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!adherent) {
      return { success: false, error: "Adhérent non trouvé" };
    }

    const deleted = await prisma.$transaction(async (tx) => {
      return withReunionParticipationLocks(
        tx as unknown as ReunionLockTx,
        reunionId,
        [adherent.id],
        async () => {
          return tx.participationReunion.deleteMany({
            where: { reunionId, adherentId: adherent.id },
          });
        }
      );
    });

    revalidatePath("/reunions-mensuelles");
    revalidatePath("/admin/reunions-mensuelles");

    return {
      success: true,
      alreadyClear: deleted.count === 0,
      participationStatus: null as null,
    };
  } catch (error) {
    if (error instanceof ReunionParticipationNotWritableError) {
      if (error.message === "Réunion non trouvée") {
        return { success: false, error: "Réunion non trouvée" };
      }
      return { success: false, error: error.message };
    }
    console.error("Erreur lors du retrait de participation:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

/**
 * Adhérents éligibles pour le dialogue participants admin.
 * Inclut les comptes Actifs avec fiche Adherent **quel que soit le rôle bureau**
 * (MEMBRE, ADMIN, PRESID, …). Les inactifs avec réponse historique sont
 * ajoutés côté client via l'union des participations (marqueur Inactif).
 *
 * @returns Liste { id, firstname, lastname, email, role, userStatus }
 */
export async function getAdherentsPourReunionParticipants() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, adherents: [], error: "Non autorisé" };
    }

    const { canWrite } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canWrite(session.user.id, "updateReunionMensuelle");
    if (!hasAccess) {
      return { success: false, adherents: [], error: "Non autorisé" };
    }

    const adherents = await prisma.adherent.findMany({
      where: {
        User: {
          status: "Actif",
        },
      },
      select: {
        id: true,
        firstname: true,
        lastname: true,
        User: { select: { email: true, role: true, status: true } },
      },
      orderBy: [{ lastname: "asc" }, { firstname: "asc" }],
    });

    return {
      success: true,
      adherents: adherents.map((a) => ({
        id: a.id,
        firstname: a.firstname ?? "",
        lastname: a.lastname ?? "",
        email: a.User?.email ?? "",
        role: a.User?.role ?? null,
        userStatus: (a.User?.status === "Inactif" ? "Inactif" : "Actif") as
          | "Actif"
          | "Inactif",
      })),
    };
  } catch (error) {
    console.error("Erreur getAdherentsPourReunionParticipants:", error);
    return {
      success: false,
      adherents: [],
      error: "Erreur lors du chargement des adhérents",
    };
  }
}

/**
 * Enregistrer les participations d'une réunion (admin).
 *
 * Protocole : TX → verrou réunion → relecture DateConfirmee/jour Paris →
 * verrous participation (adherentId ASC) → delta trié → écritures conditionnelles.
 *
 * - expected row → updateMany / deleteMany (count ≠ 1 → CONFLICT) ;
 * - expected absent + réponse → create (P2002 → CONFLICT) ;
 * - expected absent + NonRepondu → findUnique sous verrou : absence = no-op,
 *   ligne apparue = CONFLICT (aucun create/delete).
 *
 * Annulation/date sous verrou avant le geste → refus (pas CONFLICT).
 * Conflit delta → rollback intégral. Autres SQL non masquées.
 * Limite A→B→A sans version conservée.
 */
export async function adminSetParticipationsReunion(data: z.infer<typeof AdminSetParticipationsSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const { canWrite } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canWrite(session.user.id, "updateReunionMensuelle");
    if (!hasAccess) {
      return { success: false, error: "Réservé aux administrateurs" };
    }

    const validatedData = AdminSetParticipationsSchema.parse(data);

    if (validatedData.participations.length === 0) {
      return { success: false, error: "Aucune participation à enregistrer" };
    }

    const ordered = sortParticipationDeltaByAdherentId(
      validatedData.participations
    );

    try {
      await prisma.$transaction(async (tx) => {
        await withReunionParticipationLocks(
          tx as unknown as ReunionLockTx,
          validatedData.reunionId,
          ordered.map((p) => p.adherentId),
          async () => {
            for (const p of ordered) {
              await applyAdminParticipationDeltaItem(
                tx as Parameters<typeof applyAdminParticipationDeltaItem>[0],
                validatedData.reunionId,
                p
              );
            }
          }
        );
      });
    } catch (txError) {
      if (txError instanceof ReunionParticipationNotWritableError) {
        if (txError.message === "Réunion non trouvée") {
          return { success: false, error: "Réunion non trouvée" };
        }
        return { success: false, error: txError.message };
      }
      if (
        txError instanceof ParticipationConflictError ||
        (txError instanceof Error && txError.message === "PARTICIPATION_CONFLICT") ||
        // Filet : P2002 participation non encore classé (ex. instanceof Prisma cassé)
        isParticipationUniqueViolation(txError)
      ) {
        return {
          success: false,
          code: "CONFLICT" as const,
          error:
            "Des réponses ont changé depuis l'ouverture du dialogue. Rechargez puis réessayez.",
        };
      }
      throw txError;
    }

    await logModification(
      `Participations enregistrées pour la réunion ${validatedData.reunionId}`,
      "ParticipationReunion",
      validatedData.reunionId
    );

    revalidatePath("/admin/reunions-mensuelles");
    revalidatePath("/reunions-mensuelles");

    return { success: true };
  } catch (error) {
    console.error("Erreur lors de l'enregistrement des participations (admin):", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: "Erreur interne du serveur" };
  }
}

/**
 * Supprimer une réunion mensuelle (admin uniquement)
 */
export async function deleteReunionMensuelle(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const { canDelete } = await import("@/lib/dynamic-permissions");
    const hasAccess = await canDelete(session.user.id, "deleteReunionMensuelle");
    if (!hasAccess) {
      return { success: false, error: "Non autorisé" };
    }

    const reunion = await prisma.reunionMensuelle.findUnique({
      where: { id },
    });

    if (!reunion) {
      return { success: false, error: "Réunion non trouvée" };
    }

    await prisma.reunionMensuelle.delete({
      where: { id },
    });

    await logDeletion(`Réunion mensuelle ${reunion.mois}/${reunion.annee} supprimée`, "ReunionMensuelle", id);

    revalidatePath("/admin/reunions-mensuelles");
    revalidatePath("/reunions-mensuelles");

    return { success: true };
  } catch (error) {
    console.error("Erreur lors de la suppression de la réunion:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}
