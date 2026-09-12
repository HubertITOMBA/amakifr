"use server";

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/mail";
import { normalizeEmail } from "@/lib/utils";
import { z } from "zod";

/**
 * Schéma de validation pour les demandes publiques de suppression de données.
 * Ne déclenche jamais une suppression automatique.
 */
const DataDeletionRequestSchema = z.object({
  email: z.string().email("L'adresse email n'est pas valide"),
  message: z
    .string()
    .max(2000, "Le message ne peut pas dépasser 2000 caractères")
    .optional()
    .nullable(),
});

const GENERIC_SUCCESS_MESSAGE =
  "Si un compte correspondant à cette adresse existe, votre demande a été prise en compte. Vous recevrez un e-mail de confirmation. Aucune suppression n'est effectuée immédiatement : une vérification d'identité par l'équipe AMAKI est obligatoire.";

/**
 * Enregistre une demande de suppression (statut EnAttente) pour un e-mail donné.
 * - Accès public (Play Store / RGPD)
 * - N'efface aucune donnée
 * - Réponse générique (anti-énumération de comptes)
 * - Vérification d'identité = e-mail de confirmation + traitement admin
 *
 * @param formData - email (requis) + message (optionnel)
 */
export async function submitDataDeletionRequest(formData: FormData) {
  try {
    const rawData = {
      email: formData.get("email") as string,
      message: (formData.get("message") as string | null) || null,
    };

    const validatedData = DataDeletionRequestSchema.parse(rawData);
    const email = normalizeEmail(validatedData.email);
    const message = validatedData.message?.trim() || null;

    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        adherent: {
          select: { firstname: true, lastname: true },
        },
      },
    });

    // Compte inconnu : succès générique, aucune écriture (anti-énumération).
    if (!user?.email) {
      return {
        success: true,
        message: GENERIC_SUCCESS_MESSAGE,
        deleted: false as const,
      };
    }

    const existingRequest = await db.dataDeletionRequest.findFirst({
      where: {
        userId: user.id,
        statut: {
          in: ["EnAttente", "EnVerification", "Approuvee"],
        },
      },
      select: { id: true },
    });

    if (existingRequest) {
      return {
        success: true,
        message: GENERIC_SUCCESS_MESSAGE,
        deleted: false as const,
      };
    }

    const userName =
      user.name ||
      (user.adherent
        ? `${user.adherent.firstname} ${user.adherent.lastname}`
        : null);

    const deletionRequest = await db.dataDeletionRequest.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        userName,
        message,
        statut: "EnAttente",
      },
      select: { id: true },
    });

    try {
      await sendEmail({
        to: user.email,
        subject: "Demande de suppression de données - AMAKI France",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e40af;">Demande de suppression de données reçue</h2>
            <p>Bonjour,</p>
            <p>Nous avons bien reçu une demande de suppression des données personnelles associées à un compte AMAKI (site et application mobile).</p>
            <p><strong>Important :</strong> aucune donnée n'a été supprimée pour l'instant. Une vérification d'identité est requise avant toute suppression.</p>
            <h3 style="color: #1e40af; margin-top: 30px;">Prochaines étapes :</h3>
            <ol>
              <li>Vérification d'identité par l'équipe AMAKI (sous 48 heures indicatives)</li>
              <li>Validation administrative de la demande</li>
              <li>Suppression des données éligibles (sous 30 jours après validation)</li>
              <li>Notification une fois le traitement terminé</li>
            </ol>
            <p style="margin-top: 30px; padding: 15px; background-color: #fef3c7; border-left: 4px solid #f59e0b;">
              <strong>Important :</strong> certaines données peuvent être conservées plus longtemps si la loi l'exige
              (notamment données financières / comptables).
            </p>
            <p style="margin-top: 20px;">
              Si vous n'êtes pas à l'origine de cette demande, contactez immédiatement
              <a href="mailto:contact@amaki.fr" style="color: #1e40af;">contact@amaki.fr</a>.
            </p>
            <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
              Cordialement,<br>
              L'équipe AMAKI France
            </p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error(
        "Erreur lors de l'envoi de l'email de confirmation (demande suppression)"
      );
      if (process.env.NODE_ENV !== "production") {
        console.error(emailError);
      }
    }

    try {
      await sendEmail({
        to: process.env.ADMIN_EMAIL || "asso.amaki@gmail.com",
        subject: `[AMAKI] Nouvelle demande de suppression de données`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">Nouvelle demande de suppression de données</h2>
            <p>Une demande publique a été enregistrée (statut EnAttente). Vérifiez l'identité avant toute suppression.</p>
            <p><strong>ID demande :</strong> ${deletionRequest.id}</p>
            <p style="margin-top: 20px; padding: 15px; background-color: #fee2e2; border-left: 4px solid #dc2626;">
              <strong>Action requise :</strong> vérifier l'identité, puis traiter via l'administration RGPD.
              Aucune suppression automatique n'a eu lieu.
            </p>
            <p style="margin-top: 15px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://www.amaki.fr"}/admin/rgpd/demandes" style="color: #1e40af; text-decoration: underline;">
                Gérer les demandes RGPD
              </a>
            </p>
          </div>
        `,
      });
    } catch {
      console.error(
        "Erreur lors de l'envoi de l'email administrateur (demande suppression)"
      );
    }

    return {
      success: true,
      message: GENERIC_SUCCESS_MESSAGE,
      deleted: false as const,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0]?.message || "Données invalides",
        deleted: false as const,
      };
    }
    console.error("Erreur lors de la soumission d'une demande de suppression");
    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }
    return {
      success: false,
      error:
        "Une erreur est survenue lors de l'envoi de votre demande. Veuillez réessayer ou nous contacter directement.",
      deleted: false as const,
    };
  }
}
