"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/mail";
import { revalidatePath } from "next/cache";
import { canWrite } from "@/lib/dynamic-permissions";

type AdherentAbsenteismeRow = {
  adherentId: string;
  nom: string;
  email: string | null;
  totalAbsences: number;
  absencesConsecutivesSansJustificatif: number;
  totalExcuses: number;
  totalAbsencesEvenements: number;
  totalAbsencesReunions: number;
  dernieresParticipations: Array<{
    reunionDate: Date | null;
    statut: string;
    justificatifFournit: boolean;
  }>;
  doitEtreRelance: boolean;
  motifRelance: string | null;
};

function getConsecutiveAbsencesSansJustificatif(
  items: Array<{ statut: string; justificatifFournit: boolean }>
): number {
  let count = 0;
  for (const item of items) {
    if (item.statut === "Absent" && !item.justificatifFournit) {
      count += 1;
      continue;
    }
    break;
  }
  return count;
}

function isUnknownFieldError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("Unknown field");
}

export async function getAbsenteismeStats() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }
    const allowed = await canWrite(session.user.id, "updateReunionMensuelle");
    if (!allowed) return { success: false, error: "Permission insuffisante" };

    let reunionsConfirmees: Array<{
      id: string;
      dateReunion: Date | null;
      Participations: Array<{ adherentId: string; statut: string; justificatifFournit?: boolean }>;
    }> = [];
    try {
      reunionsConfirmees = await prisma.reunionMensuelle.findMany({
        where: { statut: "DateConfirmee" },
        select: {
          id: true,
          dateReunion: true,
          Participations: {
            select: {
              adherentId: true,
              statut: true,
              justificatifFournit: true,
            },
          },
        },
        orderBy: [{ dateReunion: "desc" }, { createdAt: "desc" }],
      });
    } catch (error) {
      if (!isUnknownFieldError(error)) throw error;
      // Fallback compatibilité: client Prisma / migration pas encore alignés
      reunionsConfirmees = await prisma.reunionMensuelle.findMany({
        where: { statut: "DateConfirmee" },
        select: {
          id: true,
          dateReunion: true,
          Participations: {
            select: {
              adherentId: true,
              statut: true,
            },
          },
        },
        orderBy: [{ dateReunion: "desc" }, { createdAt: "desc" }],
      });
    }

    const adherents = await prisma.adherent.findMany({
      include: {
        User: { select: { email: true, status: true } },
      },
      orderBy: [{ lastname: "asc" }, { firstname: "asc" }],
    });

    let evenementsObligatoires: Array<{
      id: string;
      dateDebut: Date;
      Inscriptions: Array<{
        adherentId: string | null;
        participationStatut?: string;
        justificatifFournit?: boolean;
        statut: string;
      }>;
    }> = [];
    try {
      evenementsObligatoires = await prisma.evenement.findMany({
        where: {
          obligatoireParticipation: true,
          dateDebut: { lt: new Date() },
          statut: { in: ["Publie", "Archive"] },
        },
        select: {
          id: true,
          dateDebut: true,
          Inscriptions: {
            where: { adherentId: { not: null } },
            select: {
              adherentId: true,
              participationStatut: true,
              justificatifFournit: true,
              statut: true,
            },
          },
        },
        orderBy: { dateDebut: "desc" },
      });
    } catch (error) {
      if (!isUnknownFieldError(error)) throw error;
      // Fallback compatibilité: ancien schéma (pas de champ obligatoireParticipation/participationStatut/justificatif)
      evenementsObligatoires = [];
    }

    const data: AdherentAbsenteismeRow[] = adherents.map((a) => {
      const participationsReunions = reunionsConfirmees
        .map((r) => {
          const p = r.Participations.find((x) => x.adherentId === a.id);
          return {
            reunionDate: r.dateReunion ?? null,
            statut: p?.statut ?? "NonRepondu",
            justificatifFournit: p?.justificatifFournit ?? false,
          };
        });

      const participationsEvenements = evenementsObligatoires.map((e) => {
        const insc = e.Inscriptions.find((i) => i.adherentId === a.id);
        const statut = insc?.participationStatut ?? "Absent";
        const justif = Boolean(insc?.justificatifFournit);
        const normalise =
          statut === "Present" || statut === "Excuse" || statut === "Absent" || statut === "NonRenseigne"
            ? statut
            : "NonRenseigne";
        return {
          reunionDate: e.dateDebut ?? null,
          statut: normalise === "NonRenseigne" ? "Absent" : normalise,
          justificatifFournit: justif,
        };
      });

      const timeline = [...participationsReunions, ...participationsEvenements].sort(
        (x, y) => (y.reunionDate?.getTime() ?? 0) - (x.reunionDate?.getTime() ?? 0)
      );

      const totalAbsencesReunions = participationsReunions.filter((p) => p.statut === "Absent" || p.statut === "NonRepondu").length;
      const totalAbsencesEvenements = participationsEvenements.filter((p) => p.statut === "Absent").length;
      const totalAbsences = totalAbsencesReunions + totalAbsencesEvenements;
      const totalExcuses =
        participationsReunions.filter((p) => p.statut === "Excuse").length +
        participationsEvenements.filter((p) => p.statut === "Excuse").length;
      const absencesConsecutivesSansJustificatif = getConsecutiveAbsencesSansJustificatif(timeline);

      const plusDeTroisAbsences = totalAbsences > 3;
      const troisConsecutivesSansJustif = absencesConsecutivesSansJustificatif >= 3;
      const doitEtreRelance = plusDeTroisAbsences || troisConsecutivesSansJustif;
      const motifRelance = troisConsecutivesSansJustif
        ? "3 absences successives sans justificatif"
        : plusDeTroisAbsences
          ? "Plus de 3 absences"
          : null;

      return {
        adherentId: a.id,
        nom: `${a.firstname} ${a.lastname}`,
        email: a.User?.email ?? null,
        totalAbsences,
        totalAbsencesEvenements,
        totalAbsencesReunions,
        absencesConsecutivesSansJustificatif,
        totalExcuses,
        dernieresParticipations: timeline.slice(0, 6),
        doitEtreRelance,
        motifRelance,
      };
    });

    const relancesRecentes = await prisma.relanceAbsenteisme.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return {
      success: true,
      data: {
        membres: data,
        resume: {
          totalMembres: data.length,
          membresARelancer: data.filter((m) => m.doitEtreRelance).length,
          totalRelances30j: relancesRecentes.length,
        },
      },
    };
  } catch (error) {
    console.error("Erreur getAbsenteismeStats:", error);
    return { success: false, error: "Erreur lors du calcul de l'absentéisme" };
  }
}

export async function relancerAbsenteismeAdherent(adherentId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }
    const allowed = await canWrite(session.user.id, "updateReunionMensuelle");
    if (!allowed) return { success: false, error: "Permission insuffisante" };

    const stats = await getAbsenteismeStats();
    if (!stats.success || !stats.data) {
      return { success: false, error: "Impossible de calculer l'absentéisme" };
    }

    const adherent = stats.data.membres.find((m) => m.adherentId === adherentId);
    if (!adherent) {
      return { success: false, error: "Adhérent introuvable" };
    }
    if (!adherent.doitEtreRelance) {
      return { success: false, error: "Cet adhérent ne nécessite pas de relance" };
    }

    const contenu = `Bonjour ${adherent.nom},\n\nSelon nos relevés, votre participation aux réunions/evenements est insuffisante.\nMotif: ${adherent.motifRelance}\nAbsences: ${adherent.totalAbsences}\nAbsences successives sans justificatif: ${adherent.absencesConsecutivesSansJustificatif}\n\nMerci de régulariser votre situation et de fournir vos justificatifs en cas d'absence.\n\nAMAKI France`;

    const relance = await prisma.relanceAbsenteisme.create({
      data: {
        adherentId,
        motif: adherent.motifRelance ?? "Absentéisme",
        totalAbsences: adherent.totalAbsences,
        absencesConsecutives: adherent.absencesConsecutivesSansJustificatif,
        contenu,
        statut: "EnAttente",
        createdBy: session.user.id,
      },
    });

    if (adherent.email) {
      try {
        await sendEmail(
          {
            to: adherent.email,
            subject: "Relance - assiduité réunions et événements",
            html: `
              <p>Bonjour ${adherent.nom},</p>
              <p>Nous constatons un absentéisme important.</p>
              <ul>
                <li>Motif : <strong>${adherent.motifRelance}</strong></li>
                <li>Total absences : <strong>${adherent.totalAbsences}</strong></li>
                <li>Absences successives sans justificatif : <strong>${adherent.absencesConsecutivesSansJustificatif}</strong></li>
              </ul>
              <p>Merci de régulariser votre situation et de transmettre les justificatifs nécessaires.</p>
              <p>Cordialement,<br/>AMAKI France</p>
            `,
          },
          false
        );

        await prisma.relanceAbsenteisme.update({
          where: { id: relance.id },
          data: { statut: "Envoyee", dateEnvoi: new Date() },
        });
      } catch (e) {
        console.error("Erreur email relance absenteisme:", e);
      }
    }

    revalidatePath("/admin/absenteisme");
    revalidatePath("/admin/reunions-mensuelles");

    return { success: true, message: "Relance envoyée." };
  } catch (error) {
    console.error("Erreur relancerAbsenteismeAdherent:", error);
    return { success: false, error: "Erreur lors de la relance absentéisme" };
  }
}
