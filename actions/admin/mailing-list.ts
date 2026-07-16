"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";
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
});

async function assertAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
    return { ok: false as const, error: "Non autorisé" };
  }
  return { ok: true as const };
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
 * Génère un document PDF ou DOCX de courriers postaux personnalisés
 */
export async function generateMailingListDocument(formData: FormData) {
  try {
    const guard = await assertAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    const rawIds = formData.getAll("adherentIds").map(String);
    const parsed = GenerateMailingListSchema.parse({
      objet: formData.get("objet"),
      corps: formData.get("corps"),
      lieu: formData.get("lieu") || "Paris",
      adherentIds: rawIds,
      format: formData.get("format"),
    });

    const corps = sanitizeMailingBodyHtml(parsed.corps);

    const adherents = await db.adherent.findMany({
      where: { id: { in: parsed.adherentIds } },
      include: {
        User: { select: { email: true } },
        Adresse: { take: 1, orderBy: { createdAt: "asc" } },
      },
      orderBy: [{ lastname: "asc" }, { firstname: "asc" }],
    });

    if (adherents.length === 0) {
      return { success: false, error: "Aucun adhérent trouvé" };
    }

    const recipients = adherents.map(mapAdherentToRecipient);
    const missingAddress = recipients.filter(
      (r) => !r.adresseLigne1 || !r.codePostal || !r.ville
    );
    if (missingAddress.length > 0) {
      return {
        success: false,
        error: `${missingAddress.length} adhérent(s) sans adresse postale complète`,
      };
    }

    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    if (parsed.format === "pdf") {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      buildMailingListPDF(doc, recipients, parsed.objet, corps, parsed.lieu);
      const pdfData = doc.output("datauristring");
      return {
        success: true,
        fileName: `courriers_postaux_${stamp}.pdf`,
        mimeType: "application/pdf",
        data: pdfData,
      };
    }

    const buffer = await buildMailingListDOCX(recipients, parsed.objet, corps, parsed.lieu);
    const base64 = buffer.toString("base64");
    return {
      success: true,
      fileName: `courriers_postaux_${stamp}.docx`,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      data: `data:${"application/vnd.openxmlformats-officedocument.wordprocessingml.document"};base64,${base64}`,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message || "Données invalides" };
    }
    console.error("Erreur generateMailingListDocument:", error);
    return { success: false, error: "Erreur lors de la génération du document" };
  }
}
