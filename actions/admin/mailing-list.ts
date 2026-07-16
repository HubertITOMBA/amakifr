"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { MailingRecipientStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import jsPDF from "jspdf";
import {
  buildPostalAddressLines,
  formatMailingCivility,
  type MailingListRecipient,
} from "@/lib/mailing-list";
import { sanitizeMailingBodyHtml } from "@/lib/mailing-list-html";
import { buildMailingListPDF } from "@/lib/mailing-list-pdf";
import { buildMailingListDOCX } from "@/lib/mailing-list-docx";

const GenerateMailingListSchema = z.object({
  objet: z.string().min(1, "L'objet est requis").max(500),
  corps: z.string().min(1, "Le corps du courrier est requis").max(50000),
  lieu: z.string().min(1, "Le lieu est requis").max(100),
  adherentIds: z.array(z.string().min(1)).min(1, "Sélectionnez au moins un destinataire"),
  format: z.enum(["pdf", "docx"]),
  campaignId: z.string().min(1).optional(),
});

const UpdateRecipientResponseSchema = z.object({
  recipientId: z.string().min(1),
  reponse: z.string().max(10000),
});

async function assertAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
    return { ok: false as const, error: "Non autorisé" };
  }
  return { ok: true as const, userId: session.user.id };
}

function mapAdherentToRecipient(adherent: {
  id: string;
  civility: import("@prisma/client").Civilities | null;
  firstname: string;
  lastname: string;
  Adresse: Array<{
    label?: string | null;
    streetnum?: string | null;
    street1?: string | null;
    street2?: string | null;
    street?: string | null;
    codepost?: string | null;
    postcode?: string | null;
    city?: string | null;
  }>;
  User?: { email: string | null } | null;
}): MailingListRecipient {
  const adr = adherent.Adresse?.[0];
  const postal = buildPostalAddressLines(adr);

  return {
    adherentId: adherent.id,
    civilite: formatMailingCivility(adherent.civility),
    prenom: adherent.firstname,
    nom: adherent.lastname,
    nomComplet: `${adherent.firstname} ${adherent.lastname}`.trim(),
    adresseLigne1: postal.ligne1,
    adresseLigne2: postal.ligne2,
    codePostal: postal.codePostal,
    ville: postal.ville,
    email: adherent.User?.email ?? undefined,
  };
}

async function loadRecipientsByIds(adherentIds: string[]) {
  const adherents = await db.adherent.findMany({
    where: { id: { in: adherentIds } },
    include: {
      User: { select: { email: true } },
      Adresse: { take: 1, orderBy: { createdAt: "asc" } },
    },
    orderBy: [{ lastname: "asc" }, { firstname: "asc" }],
  });

  const recipients = adherents.map(mapAdherentToRecipient);
  const missingAddress = recipients.filter(
    (r) => !r.adresseLigne1 || !r.codePostal || !r.ville
  );

  return { recipients, missingAddress };
}

async function buildExportFile(
  recipients: MailingListRecipient[],
  objet: string,
  corps: string,
  lieu: string,
  format: "pdf" | "docx"
) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  if (format === "pdf") {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    buildMailingListPDF(doc, recipients, objet, corps, lieu);
    return {
      fileName: `courriers_postaux_${stamp}.pdf`,
      mimeType: "application/pdf",
      data: doc.output("datauristring"),
    };
  }

  const buffer = await buildMailingListDOCX(recipients, objet, corps, lieu);
  const base64 = buffer.toString("base64");
  return {
    fileName: `courriers_postaux_${stamp}.docx`,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    data: `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64}`,
  };
}

/**
 * Liste les adhérents éligibles pour un courrier postal (avec adresse)
 */
export async function getMailingListRecipients() {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    const adherents = await db.adherent.findMany({
      include: {
        User: { select: { email: true, status: true } },
        Adresse: { take: 1, orderBy: { createdAt: "asc" } },
      },
      orderBy: [{ lastname: "asc" }, { firstname: "asc" }],
    });

    const recipients = adherents
      .filter((a) => a.Adresse.length > 0)
      .map((a) => {
        const r = mapAdherentToRecipient(a);
        return {
          adherentId: r.adherentId,
          civilite: r.civilite,
          prenom: r.prenom,
          nom: r.nom,
          nomComplet: r.nomComplet,
          adresseLigne1: r.adresseLigne1,
          codePostal: r.codePostal,
          ville: r.ville,
          email: r.email,
          hasCompleteAddress: Boolean(r.adresseLigne1 && r.codePostal && r.ville),
        };
      });

    return {
      success: true,
      data: recipients,
      count: recipients.length,
    };
  } catch (error) {
    console.error("Erreur getMailingListRecipients:", error);
    return { success: false, error: "Erreur lors du chargement des adhérents" };
  }
}

/**
 * Liste les campagnes de courriers postaux (historique)
 */
export async function getMailingCampaigns() {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    const campaigns = await db.mailingCampaign.findMany({
      include: {
        CreatedBy: { select: { name: true, email: true } },
        recipients: {
          select: {
            id: true,
            statut: true,
            sendCount: true,
            reponse: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const data = campaigns.map((c) => {
      const total = c.recipients.length;
      const reponses = c.recipients.filter((r) => r.statut === MailingRecipientStatus.Repondu).length;
      const relances = c.recipients.filter((r) => r.statut === MailingRecipientStatus.Relance).length;
      const envois = c.recipients.reduce((sum, r) => sum + r.sendCount, 0);

      return {
        id: c.id,
        objet: c.objet,
        lieu: c.lieu,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        createdByName: c.CreatedBy.name || c.CreatedBy.email || "Admin",
        totalRecipients: total,
        reponsesCount: reponses,
        relancesCount: relances,
        totalEnvois: envois,
      };
    });

    return { success: true, data };
  } catch (error) {
    console.error("Erreur getMailingCampaigns:", error);
    return { success: false, error: "Erreur lors du chargement de l'historique" };
  }
}

/**
 * Détail d'une campagne avec ses destinataires
 */
export async function getMailingCampaignById(campaignId: string) {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    const campaign = await db.mailingCampaign.findUnique({
      where: { id: campaignId },
      include: {
        CreatedBy: { select: { name: true, email: true } },
        recipients: {
          orderBy: [{ nom: "asc" }, { prenom: "asc" }],
        },
      },
    });

    if (!campaign) {
      return { success: false, error: "Campagne introuvable" };
    }

    return {
      success: true,
      data: {
        id: campaign.id,
        objet: campaign.objet,
        corps: campaign.corps,
        lieu: campaign.lieu,
        createdAt: campaign.createdAt.toISOString(),
        updatedAt: campaign.updatedAt.toISOString(),
        createdByName: campaign.CreatedBy.name || campaign.CreatedBy.email || "Admin",
        recipients: campaign.recipients.map((r) => ({
          id: r.id,
          adherentId: r.adherentId,
          civilite: r.civilite,
          prenom: r.prenom,
          nom: r.nom,
          nomComplet: `${r.prenom} ${r.nom}`.trim(),
          adresseLigne1: r.adresseLigne1,
          adresseLigne2: r.adresseLigne2,
          codePostal: r.codePostal,
          ville: r.ville,
          format: r.format,
          statut: r.statut,
          sentAt: r.sentAt.toISOString(),
          lastSentAt: r.lastSentAt.toISOString(),
          sendCount: r.sendCount,
          reponse: r.reponse,
          reponseAt: r.reponseAt?.toISOString() ?? null,
        })),
      },
    };
  } catch (error) {
    console.error("Erreur getMailingCampaignById:", error);
    return { success: false, error: "Erreur lors du chargement de la campagne" };
  }
}

type GenerateMailingResult =
  | {
      success: true;
      fileName: string;
      mimeType: string;
      data: string;
      campaignId: string;
      addedCount: number;
      relaunchedCount: number;
      message: string;
    }
  | { success: false; error: string };

/**
 * Génère un document PDF/DOCX et historise la campagne (création ou ajout/relance)
 */
export async function generateMailingListDocument(
  formData: FormData
): Promise<GenerateMailingResult> {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    const rawIds = formData.getAll("adherentIds").map(String);
    const campaignIdRaw = formData.get("campaignId");
    const parsed = GenerateMailingListSchema.parse({
      objet: formData.get("objet"),
      corps: formData.get("corps"),
      lieu: formData.get("lieu") || "Paris",
      adherentIds: rawIds,
      format: formData.get("format"),
      campaignId:
        typeof campaignIdRaw === "string" && campaignIdRaw.trim()
          ? campaignIdRaw.trim()
          : undefined,
    });

    const corps = sanitizeMailingBodyHtml(parsed.corps);
    const { recipients, missingAddress } = await loadRecipientsByIds(parsed.adherentIds);

    if (recipients.length === 0) {
      return { success: false, error: "Aucun adhérent trouvé" };
    }
    if (missingAddress.length > 0) {
      return {
        success: false,
        error: `${missingAddress.length} adhérent(s) sans adresse postale complète`,
      };
    }

    let campaignId = parsed.campaignId;
    let addedCount = 0;
    let relaunchedCount = 0;

    if (campaignId) {
      const existing = await db.mailingCampaign.findUnique({
        where: { id: campaignId },
        include: { recipients: { select: { adherentId: true } } },
      });
      if (!existing) {
        return { success: false, error: "Campagne introuvable" };
      }

      await db.mailingCampaign.update({
        where: { id: campaignId },
        data: {
          objet: parsed.objet,
          corps,
          lieu: parsed.lieu,
        },
      });

      const existingIds = new Set(existing.recipients.map((r) => r.adherentId));
      const now = new Date();

      for (const recipient of recipients) {
        if (existingIds.has(recipient.adherentId)) {
          await db.mailingCampaignRecipient.update({
            where: {
              campaignId_adherentId: {
                campaignId,
                adherentId: recipient.adherentId,
              },
            },
            data: {
              civilite: recipient.civilite,
              prenom: recipient.prenom,
              nom: recipient.nom,
              adresseLigne1: recipient.adresseLigne1,
              adresseLigne2: recipient.adresseLigne2 || null,
              codePostal: recipient.codePostal,
              ville: recipient.ville,
              format: parsed.format,
              statut: MailingRecipientStatus.Relance,
              lastSentAt: now,
              sendCount: { increment: 1 },
            },
          });
          relaunchedCount += 1;
        } else {
          await db.mailingCampaignRecipient.create({
            data: {
              campaignId,
              adherentId: recipient.adherentId,
              civilite: recipient.civilite,
              prenom: recipient.prenom,
              nom: recipient.nom,
              adresseLigne1: recipient.adresseLigne1,
              adresseLigne2: recipient.adresseLigne2 || null,
              codePostal: recipient.codePostal,
              ville: recipient.ville,
              format: parsed.format,
              statut: MailingRecipientStatus.Envoye,
              sentAt: now,
              lastSentAt: now,
              sendCount: 1,
            },
          });
          addedCount += 1;
        }
      }
    } else {
      const campaign = await db.mailingCampaign.create({
        data: {
          objet: parsed.objet,
          corps,
          lieu: parsed.lieu,
          createdBy: guard.userId,
          recipients: {
            create: recipients.map((r) => ({
              adherentId: r.adherentId,
              civilite: r.civilite,
              prenom: r.prenom,
              nom: r.nom,
              adresseLigne1: r.adresseLigne1,
              adresseLigne2: r.adresseLigne2 || null,
              codePostal: r.codePostal,
              ville: r.ville,
              format: parsed.format,
              statut: MailingRecipientStatus.Envoye,
            })),
          },
        },
      });
      campaignId = campaign.id;
      addedCount = recipients.length;
    }

    if (!campaignId) {
      return { success: false, error: "Campagne non créée" };
    }

    const file = await buildExportFile(
      recipients,
      parsed.objet,
      corps,
      parsed.lieu,
      parsed.format
    );

    return {
      success: true,
      ...file,
      campaignId,
      addedCount,
      relaunchedCount,
      message:
        relaunchedCount > 0 || (parsed.campaignId && addedCount > 0)
          ? `Document généré (${addedCount} ajouté(s), ${relaunchedCount} relancé(s))`
          : `Campagne créée et document généré (${recipients.length} destinataire(s))`,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message || "Données invalides" };
    }
    console.error("Erreur generateMailingListDocument:", error);
    return { success: false, error: "Erreur lors de la génération du document" };
  } finally {
    revalidatePath("/admin/mailing-list");
  }
}

/**
 * Enregistre ou met à jour la réponse d'un destinataire
 */
export async function updateMailingRecipientResponse(formData: FormData) {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    const parsed = UpdateRecipientResponseSchema.parse({
      recipientId: formData.get("recipientId"),
      reponse: formData.get("reponse") ?? "",
    });

    const recipient = await db.mailingCampaignRecipient.findUnique({
      where: { id: parsed.recipientId },
    });
    if (!recipient) {
      return { success: false, error: "Destinataire introuvable" };
    }

    const trimmed = parsed.reponse.trim();
    const updated = await db.mailingCampaignRecipient.update({
      where: { id: parsed.recipientId },
      data: trimmed
        ? {
            reponse: trimmed,
            reponseAt: new Date(),
            statut: MailingRecipientStatus.Repondu,
          }
        : {
            reponse: null,
            reponseAt: null,
            statut:
              recipient.sendCount > 1
                ? MailingRecipientStatus.Relance
                : MailingRecipientStatus.Envoye,
          },
    });

    return {
      success: true,
      message: trimmed ? "Réponse enregistrée" : "Réponse effacée",
      data: {
        id: updated.id,
        reponse: updated.reponse,
        reponseAt: updated.reponseAt?.toISOString() ?? null,
        statut: updated.statut,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message || "Données invalides" };
    }
    console.error("Erreur updateMailingRecipientResponse:", error);
    return { success: false, error: "Erreur lors de l'enregistrement de la réponse" };
  } finally {
    revalidatePath("/admin/mailing-list");
  }
}

/**
 * Supprime une campagne et ses destinataires
 */
export async function deleteMailingCampaign(campaignId: string) {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    await db.mailingCampaign.delete({ where: { id: campaignId } });
    return { success: true, message: "Campagne supprimée" };
  } catch (error) {
    console.error("Erreur deleteMailingCampaign:", error);
    return { success: false, error: "Erreur lors de la suppression" };
  } finally {
    revalidatePath("/admin/mailing-list");
  }
}
