"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

/**
 * Exporte toutes les données personnelles d'un utilisateur au format JSON
 * 
 * @param userId - L'ID de l'utilisateur
 * @returns Un objet avec success (boolean), filePath (string) en cas de succès,
 * ou error (string) en cas d'échec
 */
export async function exportUserData(userId: string) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "Admin") {
      return {
        success: false,
        error: "Non autorisé. Seuls les administrateurs peuvent exporter les données.",
      };
    }

    // Récupérer toutes les données de l'utilisateur
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        adherent: {
          include: {
            Adresses: true,
            Telephones: true,
            Enfants: true,
            Cotisations: true,
            ObligationsCotisation: true,
            CotisationsMensuelles: {
              include: {
                TypeCotisation: true,
              },
            },
            DettesInitiales: true,
            Assistances: true,
            Candidatures: {
              include: {
                election: {
                  include: {
                    positions: true,
                  },
                },
                position: true,
              },
            },
            Votes: {
              include: {
                election: true,
                position: true,
                candidacy: true,
              },
            },
            Documents: true,
            BadgesAttribues: {
              include: {
                badge: true,
              },
            },
          },
        },
        messages: {
          include: {
            Conversation: true,
          },
        },
        conversations: {
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        notifications: true,
        emailsReceived: true,
        idees: {
          include: {
            commentaires: true,
            approbations: true,
          },
        },
      },
    });

    if (!user) {
      return {
        success: false,
        error: "Utilisateur introuvable.",
      };
    }

    // Préparer les données pour l'export (sans les mots de passe et tokens)
    const exportData = {
      exportDate: new Date().toISOString(),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLogin: user.lastLogin,
      },
      adherent: user.adherent ? {
        ...user.adherent,
        password: undefined, // Ne pas exporter le mot de passe
      } : null,
      adresses: user.adherent?.Adresses || [],
      telephones: user.adherent?.Telephones || [],
      enfants: user.adherent?.Enfants || [],
      cotisations: user.adherent?.Cotisations || [],
      obligationsCotisation: user.adherent?.ObligationsCotisation || [],
      cotisationsMensuelles: user.adherent?.CotisationsMensuelles || [],
      dettesInitiales: user.adherent?.DettesInitiales || [],
      assistances: user.adherent?.Assistances || [],
      candidatures: user.adherent?.Candidatures || [],
      votes: user.adherent?.Votes || [],
      documents: user.adherent?.Documents || [],
      badges: user.adherent?.BadgesAttribues || [],
      messages: user.messages || [],
      conversations: user.conversations || [],
      notifications: user.notifications || [],
      emailsReceived: user.emailsReceived || [],
      idees: user.idees || [],
    };

    // Créer le répertoire d'export s'il n'existe pas
    const exportDir = join(process.cwd(), "exports", "rgpd");
    await mkdir(exportDir, { recursive: true });

    // Générer le nom de fichier
    const fileName = `export-${user.email || user.id}-${format(new Date(), "yyyy-MM-dd-HHmmss", { locale: fr })}.json`;
    const filePath = join(exportDir, fileName);

    // Écrire le fichier
    await writeFile(filePath, JSON.stringify(exportData, null, 2), "utf-8");

    // Mettre à jour la demande si elle existe
    const deletionRequest = await db.dataDeletionRequest.findFirst({
      where: {
        userId: user.id,
        statut: {
          in: ["EnAttente", "EnVerification", "Approuvee"],
        },
      },
    });

    if (deletionRequest) {
      await db.dataDeletionRequest.update({
        where: { id: deletionRequest.id },
        data: {
          dataExported: true,
          exportPath: filePath,
        },
      });
    }

    revalidatePath("/admin/rgpd/demandes");
    return {
      success: true,
      filePath: filePath,
      fileName: fileName,
      message: "Les données ont été exportées avec succès.",
    };
  } catch (error) {
    console.error("Erreur lors de l'export des données:", error);
    return {
      success: false,
      error: "Une erreur s'est produite lors de l'export des données.",
    };
  }
}

/**
 * Télécharge le fichier d'export des données
 * 
 * @param filePath - Le chemin du fichier à télécharger
 * @returns Un objet avec success (boolean), buffer (Buffer) en cas de succès,
 * ou error (string) en cas d'échec
 */
export async function downloadExportFile(filePath: string) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "Admin") {
      return {
        success: false,
        error: "Non autorisé.",
      };
    }

    const { readFile } = await import("fs/promises");
    const buffer = await readFile(filePath);

    return {
      success: true,
      buffer: buffer,
    };
  } catch (error) {
    console.error("Erreur lors de la lecture du fichier:", error);
    return {
      success: false,
      error: "Fichier introuvable ou erreur de lecture.",
    };
  }
}
