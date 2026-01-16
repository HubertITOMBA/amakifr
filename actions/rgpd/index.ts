"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { adminDeleteAdherent } from "@/actions/user/admin-delete-adherent";
import { sendEmail } from "@/lib/mail";
import { z } from "zod";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

/**
 * Récupère toutes les demandes de suppression de données
 */
export async function getAllDataDeletionRequests() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "Admin") {
      return {
        success: false,
        error: "Non autorisé. Seuls les administrateurs peuvent consulter les demandes.",
      };
    }

    // Vérifier que le modèle existe
    if (!('dataDeletionRequest' in db)) {
      return {
        success: false,
        error: "Le modèle dataDeletionRequest n'est pas disponible. Veuillez redémarrer le serveur après la migration.",
      };
    }

    const requests = await (db as any).dataDeletionRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            adherent: {
              select: {
                firstname: true,
                lastname: true,
              },
            },
          },
        },
        VerifiedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        ApprovedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        RejectedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        CompletedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      success: true,
      data: requests,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des demandes:", error);
    return {
      success: false,
      error: "Une erreur s'est produite lors de la récupération des demandes.",
    };
  }
}

/**
 * Vérifie l'identité d'un utilisateur pour une demande de suppression
 */
export async function verifyDataDeletionRequest(requestId: string) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "Admin") {
      return {
        success: false,
        error: "Non autorisé.",
      };
    }

    const request = await (db as any).dataDeletionRequest.findUnique({
      where: { id: requestId },
      include: {
        User: {
          include: {
            adherent: true,
          },
        },
      },
    });

    if (!request) {
      return {
        success: false,
        error: "Demande introuvable.",
      };
    }

    if (request.statut !== "EnAttente") {
      return {
        success: false,
        error: "Cette demande ne peut plus être vérifiée.",
      };
    }

    // Mettre à jour le statut
    await db.dataDeletionRequest.update({
      where: { id: requestId },
      data: {
        statut: "EnVerification",
        verifiedAt: new Date(),
        verifiedBy: session.user.id,
        verifiedByName: session.user.name || "Admin",
      },
    });

    // Envoyer un email à l'utilisateur
    try {
      await sendEmail({
        to: request.userEmail,
        subject: "Vérification d'identité en cours - Demande de suppression de données",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e40af;">Vérification d'identité en cours</h2>
            <p>Bonjour,</p>
            <p>Votre demande de suppression de données est en cours de vérification.</p>
            <p>Nous procédons actuellement à la vérification de votre identité. Une fois cette étape terminée, nous procéderons à la suppression de vos données.</p>
            <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
              Cordialement,<br>
              L'équipe AMAKI France
            </p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("Erreur lors de l'envoi de l'email:", emailError);
    }

    revalidatePath("/admin/rgpd/demandes");
    return {
      success: true,
      message: "Vérification d'identité en cours.",
    };
  } catch (error) {
    console.error("Erreur lors de la vérification:", error);
    return {
      success: false,
      error: "Une erreur s'est produite lors de la vérification.",
    };
  }
}

/**
 * Approuve une demande de suppression de données
 */
export async function approveDataDeletionRequest(requestId: string) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "Admin") {
      return {
        success: false,
        error: "Non autorisé.",
      };
    }

    const request = await (db as any).dataDeletionRequest.findUnique({
      where: { id: requestId },
      include: {
        User: {
          include: {
            adherent: true,
          },
        },
      },
    });

    if (!request) {
      return {
        success: false,
        error: "Demande introuvable.",
      };
    }

    if (request.statut !== "EnVerification" && request.statut !== "EnAttente") {
      return {
        success: false,
        error: "Cette demande ne peut plus être approuvée.",
      };
    }

    // Mettre à jour le statut
    await db.dataDeletionRequest.update({
      where: { id: requestId },
      data: {
        statut: "Approuvee",
        approvedAt: new Date(),
        approvedBy: session.user.id,
        approvedByName: session.user.name || "Admin",
      },
    });

    // Envoyer un email à l'utilisateur
    try {
      await sendEmail({
        to: request.userEmail,
        subject: "Demande de suppression approuvée - AMAKI France",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e40af;">Demande de suppression approuvée</h2>
            <p>Bonjour,</p>
            <p>Votre demande de suppression de données a été approuvée. Nous procéderons à la suppression de vos données dans les plus brefs délais.</p>
            <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
              Cordialement,<br>
              L'équipe AMAKI France
            </p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("Erreur lors de l'envoi de l'email:", emailError);
    }

    revalidatePath("/admin/rgpd/demandes");
    return {
      success: true,
      message: "Demande approuvée avec succès.",
    };
  } catch (error) {
    console.error("Erreur lors de l'approbation:", error);
    return {
      success: false,
      error: "Une erreur s'est produite lors de l'approbation.",
    };
  }
}

/**
 * Rejette une demande de suppression de données
 */
const RejectRequestSchema = z.object({
  requestId: z.string(),
  reason: z.string().min(10, "La raison du rejet doit contenir au moins 10 caractères"),
});

export async function rejectDataDeletionRequest(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "Admin") {
      return {
        success: false,
        error: "Non autorisé.",
      };
    }

    const rawData = {
      requestId: formData.get("requestId") as string,
      reason: formData.get("reason") as string,
    };

    const validatedData = RejectRequestSchema.parse(rawData);

    const request = await (db as any).dataDeletionRequest.findUnique({
      where: { id: validatedData.requestId },
      include: {
        User: true,
      },
    });

    if (!request) {
      return {
        success: false,
        error: "Demande introuvable.",
      };
    }

    if (request.statut === "Completee" || request.statut === "Rejetee") {
      return {
        success: false,
        error: "Cette demande ne peut plus être rejetée.",
      };
    }

    // Mettre à jour le statut
    await db.dataDeletionRequest.update({
      where: { id: validatedData.requestId },
      data: {
        statut: "Rejetee",
        rejectedAt: new Date(),
        rejectedBy: session.user.id,
        rejectedByName: session.user.name || "Admin",
        rejectionReason: validatedData.reason,
      },
    });

    // Envoyer un email à l'utilisateur
    try {
      await sendEmail({
        to: request.userEmail,
        subject: "Demande de suppression rejetée - AMAKI France",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">Demande de suppression rejetée</h2>
            <p>Bonjour,</p>
            <p>Votre demande de suppression de données a été rejetée.</p>
            <p><strong>Raison :</strong> ${validatedData.reason}</p>
            <p style="margin-top: 20px;">
              Si vous avez des questions, veuillez nous contacter à 
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
      console.error("Erreur lors de l'envoi de l'email:", emailError);
    }

    revalidatePath("/admin/rgpd/demandes");
    return {
      success: true,
      message: "Demande rejetée avec succès.",
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      };
    }
    console.error("Erreur lors du rejet:", error);
    return {
      success: false,
      error: "Une erreur s'est produite lors du rejet.",
    };
  }
}

/**
 * Exporte les données personnelles d'un utilisateur
 */
export async function exportUserData(userId: string) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "Admin") {
      return {
        success: false,
        error: "Non autorisé.",
      };
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        adherent: {
          include: {
            Adresse: true,
            Telephone: true,
            Enfants: true,
          },
        },
        accounts: true,
        sessions: true,
        depenses: true,
        typesDepenseCrees: true,
        cotisationsMensuelles: {
          include: {
            TypeCotisation: true,
          },
        },
        dettesInitialesCreees: true,
        paiementsCreees: true,
        assistancesCreees: true,
        evenements: true,
        conversations: true,
        messages: true,
        documents: true,
        badgesAttribues: {
          include: {
            Badge: true,
          },
        },
        notifications: true,
        emailsReceived: true,
        emailsSent: true,
      },
    });

    if (!user) {
      return {
        success: false,
        error: "Utilisateur introuvable.",
      };
    }

    // Créer l'objet de données à exporter
    const exportData = {
      exportDate: new Date().toISOString(),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
      adherent: user.adherent ? {
        ...user.adherent,
        dateNaissance: user.adherent.dateNaissance?.toISOString(),
        datePremiereAdhesion: user.adherent.datePremiereAdhesion?.toISOString(),
      } : null,
      addresses: user.adherent?.Adresse || [],
      telephones: user.adherent?.Telephone || [],
      enfants: user.adherent?.Enfants || [],
      cotisations: user.cotisationsMensuelles.map(c => ({
        ...c,
        montant: Number(c.montant),
        montantPaye: Number(c.montantPaye),
        montantRestant: Number(c.montantRestant),
        periode: c.periode,
        createdAt: c.createdAt.toISOString(),
      })),
      paiements: user.paiementsCreees.map(p => ({
        ...p,
        montant: Number(p.montant),
        datePaiement: p.datePaiement.toISOString(),
        createdAt: p.createdAt.toISOString(),
      })),
      assistances: user.assistancesCreees.map(a => ({
        ...a,
        montant: Number(a.montant),
        dateAssistance: a.dateAssistance.toISOString(),
        createdAt: a.createdAt.toISOString(),
      })),
      evenements: user.evenements.map(e => ({
        ...e,
        dateDebut: e.dateDebut.toISOString(),
        dateFin: e.dateFin?.toISOString(),
        createdAt: e.createdAt.toISOString(),
      })),
      messages: user.messages.map(m => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      })),
      documents: user.documents.map(d => ({
        ...d,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      })),
      badges: user.badgesAttribues.map(b => ({
        ...b,
        dateAttribution: b.dateAttribution.toISOString(),
      })),
      notifications: user.notifications.map(n => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
      })),
    };

    // Créer le répertoire d'export s'il n'existe pas
    const exportDir = join(process.cwd(), "exports");
    try {
      await mkdir(exportDir, { recursive: true });
    } catch (mkdirError) {
      // Le répertoire existe peut-être déjà
    }

    // Sauvegarder le fichier JSON
    const filename = `export-${user.id}-${Date.now()}.json`;
    const filepath = join(exportDir, filename);
    await writeFile(filepath, JSON.stringify(exportData, null, 2), "utf-8");

    // Mettre à jour la demande si elle existe
    const request = await (db as any).dataDeletionRequest.findFirst({
      where: {
        userId: user.id,
        statut: {
          in: ["Approuvee", "EnVerification"],
        },
      },
    });

    if (request) {
      await db.dataDeletionRequest.update({
        where: { id: request.id },
        data: {
          dataExported: true,
          exportPath: filepath,
        },
      });
    }

    return {
      success: true,
      data: exportData,
      filepath: filepath,
      filename: filename,
      message: "Données exportées avec succès.",
    };
  } catch (error) {
    console.error("Erreur lors de l'export:", error);
    return {
      success: false,
      error: "Une erreur s'est produite lors de l'export des données.",
    };
  }
}

/**
 * Complète une demande de suppression en supprimant effectivement les données
 */
export async function completeDataDeletionRequest(requestId: string) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "Admin") {
      return {
        success: false,
        error: "Non autorisé.",
      };
    }

    const request = await (db as any).dataDeletionRequest.findUnique({
      where: { id: requestId },
      include: {
        User: true,
      },
    });

    if (!request) {
      return {
        success: false,
        error: "Demande introuvable.",
      };
    }

    if (request.statut !== "Approuvee") {
      return {
        success: false,
        error: "Seules les demandes approuvées peuvent être complétées.",
      };
    }

    // Supprimer l'utilisateur et toutes ses données
    const deleteResult = await adminDeleteAdherent(
      request.userId,
      `Demande RGPD - Droit à l'oubli (Demande #${requestId})`,
      true // Notifier l'utilisateur
    );

    if (!deleteResult.success) {
      return {
        success: false,
        error: deleteResult.error || "Erreur lors de la suppression des données.",
      };
    }

    // Mettre à jour le statut de la demande
    await db.dataDeletionRequest.update({
      where: { id: requestId },
      data: {
        statut: "Completee",
        completedAt: new Date(),
        completedBy: session.user.id,
        completedByName: session.user.name || "Admin",
      },
    });

    revalidatePath("/admin/rgpd/demandes");
    return {
      success: true,
      message: "Suppression des données effectuée avec succès.",
    };
  } catch (error) {
    console.error("Erreur lors de la complétion:", error);
    return {
      success: false,
      error: "Une erreur s'est produite lors de la suppression des données.",
    };
  }
}
