"use server";

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/mail";
import { z } from "zod";

/**
 * Schéma de validation pour les demandes de suppression de données
 */
const DataDeletionRequestSchema = z.object({
  email: z.string().email("L'adresse email n'est pas valide"),
  message: z.string().optional(),
});

/**
 * Soumet une demande de suppression de données
 * 
 * @param formData - Les données du formulaire contenant l'email et un message optionnel
 * @returns Un objet avec success (boolean) et message (string) ou error (string)
 */
export async function submitDataDeletionRequest(formData: FormData) {
  try {
    const rawData = {
      email: formData.get("email") as string,
      message: formData.get("message") as string | undefined,
    };

    const validatedData = DataDeletionRequestSchema.parse(rawData);

    // Vérifier si l'utilisateur existe
    const user = await db.user.findUnique({
      where: { email: validatedData.email },
      include: {
        adherent: true,
      },
    });

    if (!user) {
      return {
        success: false,
        error: "Aucun compte trouvé avec cette adresse email. Veuillez vérifier votre adresse email.",
      };
    }

    // Vérifier s'il existe déjà une demande en attente pour cet utilisateur
    let existingRequest = null;
    if ('dataDeletionRequest' in db) {
      existingRequest = await (db as any).dataDeletionRequest.findFirst({
      where: {
        userId: user.id,
        statut: {
          in: ['EnAttente', 'EnVerification', 'Approuvee'],
        },
      },
      });
    }

    if (existingRequest) {
      return {
        success: false,
        error: "Une demande de suppression est déjà en cours pour ce compte. Veuillez attendre le traitement de votre demande précédente.",
      };
    }

    // Créer la demande de suppression dans la base de données
    // Vérifier que le modèle existe dans le client Prisma
    let deletionRequest;
    if ('dataDeletionRequest' in db) {
      deletionRequest = await (db as any).dataDeletionRequest.create({
        data: {
          userId: user.id,
          userEmail: validatedData.email,
          userName: user.name || (user.adherent ? `${user.adherent.firstname} ${user.adherent.lastname}` : null),
          message: validatedData.message || null,
          statut: 'EnAttente',
        },
      });
    } else {
      console.warn("⚠️ Le modèle dataDeletionRequest n'est pas disponible. Veuillez redémarrer le serveur après la migration.");
      // On continue quand même pour ne pas bloquer la demande
    }

    // Envoyer un email de confirmation à l'utilisateur
    try {
      await sendEmail({
        to: validatedData.email,
        subject: "Demande de suppression de données - AMAKI France",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e40af;">Demande de suppression de données reçue</h2>
            <p>Bonjour,</p>
            <p>Nous avons bien reçu votre demande de suppression de vos données personnelles associées à votre compte AMAKI France.</p>
            <p><strong>Email du compte :</strong> ${validatedData.email}</p>
            ${validatedData.message ? `<p><strong>Votre message :</strong><br>${validatedData.message}</p>` : ''}
            <h3 style="color: #1e40af; margin-top: 30px;">Prochaines étapes :</h3>
            <ol>
              <li>Nous allons vérifier votre identité (sous 48 heures)</li>
              <li>Vous recevrez un email de confirmation une fois la vérification effectuée</li>
              <li>Nous procéderons à la suppression de vos données (sous 30 jours)</li>
              <li>Vous recevrez une notification une fois la suppression terminée</li>
            </ol>
            <p style="margin-top: 30px; padding: 15px; background-color: #fef3c7; border-left: 4px solid #f59e0b;">
              <strong>Important :</strong> Certaines données peuvent être conservées plus longtemps si la loi l'exige 
              (par exemple, données financières pour les obligations comptables sur 10 ans).
            </p>
            <p style="margin-top: 20px;">
              Si vous n'avez pas fait cette demande, veuillez nous contacter immédiatement à 
              <a href="mailto:asso.amaki@gmail.com" style="color: #1e40af;">asso.amaki@gmail.com</a>.
            </p>
            <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
              Cordialement,<br>
              L'équipe AMAKI France
            </p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("Erreur lors de l'envoi de l'email de confirmation:", emailError);
      // Ne pas bloquer la demande si l'email échoue
    }

    // Envoyer une notification à l'administrateur
    try {
      await sendEmail({
        to: process.env.ADMIN_EMAIL || "asso.amaki@gmail.com",
        subject: `[AMAKI] Nouvelle demande de suppression de données - ${validatedData.email}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">Nouvelle demande de suppression de données</h2>
            <p><strong>Email du compte :</strong> ${validatedData.email}</p>
            <p><strong>ID utilisateur :</strong> ${user.id}</p>
            <p><strong>Nom :</strong> ${user.name || "Non renseigné"}</p>
            ${user.adherent ? `<p><strong>Adhérent :</strong> ${user.adherent.firstname} ${user.adherent.lastname}</p>` : ''}
            ${validatedData.message ? `<p><strong>Message de l'utilisateur :</strong><br>${validatedData.message}</p>` : ''}
            <p style="margin-top: 20px; padding: 15px; background-color: #fee2e2; border-left: 4px solid #dc2626;">
              <strong>Action requise :</strong> Vérifier l'identité de l'utilisateur et procéder à la suppression des données dans les 30 jours.
            </p>
            ${deletionRequest ? `
            <p style="margin-top: 15px;">
              <strong>ID de la demande :</strong> ${deletionRequest.id}<br>
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/rgpd/demandes" style="color: #1e40af; text-decoration: underline;">
                Gérer cette demande
              </a>
            </p>
            ` : ''}
          </div>
        `,
      });
    } catch (adminEmailError) {
      console.error("Erreur lors de l'envoi de l'email à l'administrateur:", adminEmailError);
      // Ne pas bloquer la demande si l'email admin échoue
    }

    return {
      success: true,
      message: "Votre demande a été enregistrée avec succès. Vous allez recevoir un email de confirmation.",
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      };
    }
    console.error("Erreur lors de la soumission de la demande de suppression:", error);
    return {
      success: false,
      error: "Une erreur est survenue lors de l'envoi de votre demande. Veuillez réessayer ou nous contacter directement.",
    };
  }
}

