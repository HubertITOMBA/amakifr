"use server"

import { auth } from "@/auth";
import { db } from "@/lib/db";
import prisma from "@/lib/prisma";
import { Civilities, TypeTelephone } from "@prisma/client";
import { writeFile } from "fs/promises";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
// import { toast } from "react-toastify"; // Supprimé car non utilisé

// Types pour les données
interface UserProfileData {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  status: string;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
  adherent: {
    id: string;
    civility: string;
    firstname: string | null;
    lastname: string | null;
    departement_id: string | null;
    sous_departement_id: string | null;
    created_at: string | null;
    updated_at: string | null;
    Adresse: Array<{
      id: string;
      streetnum: string | null;
      street1: string | null;
      street2: string | null;
      codepost: string | null;
      city: string | null;
      country: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
  } | null;
  accounts: Array<{
    id: string;
    type: string;
    provider: string;
    providerAccountId: string;
    createdAt: string;
  }>;
}

interface UploadResult {
  success: boolean;
  message: string;
  fileName?: string;
  originalName?: string;
  size?: number;
  type?: string;
  url?: string;
}

interface UpdateResult {
  success: boolean;
  message: string;
  user?: any;
  adherent?: any;
  adresse?: any;
}

// Server Action pour récupérer le profil utilisateur
export async function getUserProfile(): Promise<{ success: boolean; data?: UserProfileData; error?: string }> {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Récupérer les données complètes de l'utilisateur
    const user = await db.user.findUnique({
      where: {
        id: session.user.id
      },
      include: {
        adherent: {
          include: {
            Adresse: true
          }
        },
        accounts: {
          select: {
            id: true,
            type: true,
            provider: true,
            providerAccountId: true
          }
        }
      }
    });

    if (!user) {
      return { success: false, error: "Utilisateur non trouvé" };
    }

    // Formater les données pour la réponse
    const profileData: UserProfileData = {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      status: user.status,
      lastLogin: user.lastLogin?.toISOString() || null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      adherent: (user as any).adherent ? {
        id: (user as any).adherent.id,
        civility: (user as any).adherent.civility,
        firstname: (user as any).adherent.firstname,
        lastname: (user as any).adherent.lastname,
        departement_id: (user as any).adherent.departement_id,
        sous_departement_id: (user as any).adherent.sous_departement_id,
        created_at: (user as any).adherent.created_at?.toISOString() || null,
        updated_at: (user as any).adherent.updated_at?.toISOString() || null,
        Adresse: (user as any).adherent.Adresse.map((address: any) => ({
          id: address.id,
          streetnum: address.streetnum,
          street1: address.street1,
          street2: address.street2,
          codepost: address.codepost,
          city: address.city,
          country: address.country,
          createdAt: address.createdAt.toISOString(),
          updatedAt: address.updatedAt.toISOString()
        }))
      } : null,
      accounts: (user as any).accounts.map((account: any) => ({
        id: account.id,
        type: account.type,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        createdAt: new Date().toISOString()
      }))
    };

    return { success: true, data: profileData };

  } catch (error) {
    console.error("Erreur lors de la récupération du profil:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Server Action pour récupérer les données utilisateur complètes
export async function getUserData(): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        adherent: {
          include: {
            Adresse: true,
            Telephones: true,
            Cotisations: true,
            ObligationsCotisation: true
          }
        }
      }
    });

    if (!user) {
      return { success: false, error: "Utilisateur non trouvé" };
    }

    // Convertir les valeurs Decimal en nombres pour éviter l'erreur de sérialisation
    const userWithConvertedDecimals = {
      ...user,
      adherent: user.adherent ? {
        ...user.adherent,
        Cotisations: user.adherent.Cotisations?.map((cotisation: any) => ({
          ...cotisation,
          montant: Number(cotisation.montant)
        })) || [],
        ObligationsCotisation: user.adherent.ObligationsCotisation?.map((obligation: any) => ({
          ...obligation,
          montantAttendu: Number(obligation.montantAttendu),
          montantPaye: Number(obligation.montantPaye),
          montantRestant: Number(obligation.montantRestant)
        })) || []
      } : null
    };

    return { success: true, user: userWithConvertedDecimals };
  } catch (error) {
    console.error("Erreur lors de la récupération des données utilisateur:", error);
    return { success: false, error: "Erreur serveur" };
  }
}

// Server Action pour mettre à jour les données utilisateur
export async function updateUserData(
  userData: any,
  adherentData: any,
  adresseData: any,
  telephonesData: any[]
): Promise<UpdateResult> {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, message: "Non autorisé" };
    }

    // Mise à jour des données utilisateur
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: userData.name,
        email: userData.email,
        image: userData.image,
      }
    });

    // Récupérer l'utilisateur avec ses données
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        adherent: {
          include: {
            Adresse: true
          }
        }
      }
    });

    if (!user) {
      return { success: false, message: "Utilisateur non trouvé" };
    }

    // Mise à jour ou création des données adhérent
    let adherent;
    if (user.adherent) {
      adherent = await prisma.adherent.update({
        where: { userId: session.user.id },
        data: {
          civility: adherentData.civility as Civilities,
          firstname: adherentData.firstname,
          lastname: adherentData.lastname,
        }
      });
    } else {
      adherent = await prisma.adherent.create({
        data: {
          civility: adherentData.civility as Civilities,
          firstname: adherentData.firstname,
          lastname: adherentData.lastname,
          userId: session.user.id,
        }
      });
    }

    // Récupérer l'adhérent avec ses relations pour la gestion des adresses
    const adherentWithRelations = await prisma.adherent.findUnique({
      where: { userId: session.user.id },
      include: {
        Adresse: true
      }
    });

    // Mise à jour ou création de l'adresse
    let adresse;
    if (adherentWithRelations?.Adresse && adherentWithRelations.Adresse.length > 0) {
      adresse = await prisma.adresse.update({
        where: { id: adherentWithRelations.Adresse[0].id },
        data: {
          streetnum: adresseData.streetnum,
          street1: adresseData.street1,
          street2: adresseData.street2,
          codepost: adresseData.codepost,
          city: adresseData.city,
          country: adresseData.country,
        }
      });
    } else {
      adresse = await prisma.adresse.create({
        data: {
          adherentId: adherent.id,
          streetnum: adresseData.streetnum,
          street1: adresseData.street1,
          street2: adresseData.street2,
          codepost: adresseData.codepost,
          city: adresseData.city,
          country: adresseData.country,
        }
      });
    }

    // Gestion des téléphones
    if (telephonesData && telephonesData.length > 0) {
      // Supprimer tous les téléphones existants
      await prisma.telephone.deleteMany({
        where: { adherentId: adherent.id }
      });

      // Créer les nouveaux téléphones
      for (const telData of telephonesData) {
        if (telData.numero.trim()) { // Seulement si le numéro n'est pas vide
          await prisma.telephone.create({
            data: {
              adherentId: adherent.id,
              numero: telData.numero,
              type: telData.type as TypeTelephone,
              estPrincipal: telData.estPrincipal,
              description: telData.description || null
            }
          });
        }
      }
    }

    return { 
      success: true, 
      message: "Informations mises à jour avec succès",
      user: updatedUser,
      adherent,
      adresse
    };

  } catch (error) {
    console.error("Erreur lors de la mise à jour:", error);
    return { success: false, message: "Erreur lors de la mise à jour" };
  }
}

// Server Action pour l'upload de fichiers
export async function uploadFile(
  formData: FormData
): Promise<UploadResult> {
  try {
    console.log("Début de l'upload...");
    
    const file: File | null = formData.get("file") as unknown as File;
    const folder: string | null = formData.get("folder") as string;

    console.log("Fichier reçu:", file ? { name: file.name, size: file.size, type: file.type } : "null");

    if (!file) {
      console.log("Aucun fichier fourni");
      return { success: false, message: "Aucun fichier fourni" };
    }

    // Vérifier le type de fichier (plus permissif)
    const allowedTypes = [
      "application/pdf",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo", // AVI
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/bmp",
      "image/tiff"
    ];

    // Vérifier aussi l'extension du fichier
    const fileExtension = file.name.toLowerCase();
    const allowedExtensions = ['.pdf', '.xls', '.xlsx', '.mp4', '.mov', '.avi', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];
    const hasValidExtension = allowedExtensions.some(ext => fileExtension.endsWith(ext));

    if (!allowedTypes.includes(file.type) && !hasValidExtension) {
      console.log("Type de fichier non autorisé:", file.type);
      return { 
        success: false, 
        message: `Type de fichier non autorisé: ${file.type}. Types supportés: PDF, Excel, MP4, Images` 
      };
    }

    // Vérifier la taille du fichier (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      console.log("Fichier trop volumineux:", file.size);
      return { 
        success: false, 
        message: "Fichier trop volumineux (max 50MB)" 
      };
    }

    console.log("Conversion du fichier en buffer...");
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    console.log("Buffer créé, taille:", buffer.length);

    // Créer le dossier de destination s'il n'existe pas
    const baseDir = join(process.cwd(), "public", "ressources");
    const uploadDir = folder ? join(baseDir, folder) : baseDir;
    console.log("Dossier d'upload:", uploadDir);
    
    if (!existsSync(uploadDir)) {
      console.log("Création du dossier d'upload...");
      mkdirSync(uploadDir, { recursive: true });
    }

    // Générer un nom de fichier unique avec horodatage
    const timestamp = Date.now();
    const originalName = file.name;
    const extension = originalName.split('.').pop();
    const fileName = `${timestamp}.${extension}`;
    
    const path = join(uploadDir, fileName);
    console.log("Chemin de sauvegarde:", path);
    
    await writeFile(path, buffer);
    console.log("Fichier sauvegardé avec succès");

    // Construire l'URL publique
    const publicUrl = folder 
      ? `/ressources/${folder}/${fileName}`
      : `/ressources/${fileName}`;

    return { 
      success: true, 
      message: "Fichier uploadé avec succès",
      fileName: fileName,
      originalName: originalName,
      size: file.size,
      type: file.type,
      url: publicUrl
    };

  } catch (error) {
    console.error("Erreur détaillée lors de l'upload:", error);
    return { 
      success: false, 
      message: `Erreur lors de l'upload du fichier: ${error instanceof Error ? error.message : 'Erreur inconnue'}` 
    };
  }
}

// Server Action pour récupérer les candidatures de l'utilisateur
export async function getUserCandidatures(): Promise<{ success: boolean; candidatures?: any[]; error?: string }> {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Récupérer l'adhérent de l'utilisateur
    const adherent = await prisma.adherent.findUnique({
      where: { userId: session.user.id }
    });

    if (!adherent) {
      return { success: false, error: "Adhérent non trouvé" };
    }

    // Récupérer les candidatures de l'adhérent
    const candidatures = await prisma.candidacy.findMany({
      where: { adherentId: adherent.id },
      include: {
        election: {
          select: {
            id: true,
            titre: true,
            description: true,
            status: true,
            dateOuverture: true,
            dateCloture: true
          }
        },
        position: {
          select: {
            id: true,
            titre: true,
            description: true,
            type: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return { success: true, candidatures };

  } catch (error) {
    console.error("Erreur lors de la récupération des candidatures:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Server Action pour récupérer les votes de l'utilisateur
export async function getUserVotes(): Promise<{ success: boolean; votes?: any[]; error?: string }> {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Récupérer l'adhérent de l'utilisateur
    const adherent = await prisma.adherent.findUnique({
      where: { userId: session.user.id }
    });

    if (!adherent) {
      return { success: false, error: "Adhérent non trouvé" };
    }

    // Récupérer les votes de l'adhérent
    const votes = await prisma.vote.findMany({
      where: { adherentId: adherent.id },
      include: {
        election: {
          select: {
            id: true,
            titre: true,
            description: true,
            status: true,
            dateOuverture: true,
            dateCloture: true
          }
        },
        position: {
          select: {
            id: true,
            titre: true,
            description: true,
            type: true
          }
        },
        candidacy: {
          include: {
            adherent: {
              select: {
                firstname: true,
                lastname: true,
                civility: true,
                User: {
                  select: {
                    image: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return { success: true, votes };

  } catch (error) {
    console.error("Erreur lors de la récupération des votes:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

// Server Action pour récupérer tous les candidats (pour la liste des candidats)
export async function getAllCandidatesForProfile(): Promise<{ success: boolean; candidates?: any[]; error?: string }> {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return { success: false, error: "Non autorisé" };
    }

    // Récupérer toutes les candidatures avec leurs détails
    const candidates = await prisma.candidacy.findMany({
      include: {
        adherent: {
          include: {
            User: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true
              }
            }
          }
        },
        election: {
          select: {
            id: true,
            titre: true,
            status: true,
            dateOuverture: true,
            dateCloture: true
          }
        },
        position: {
          select: {
            id: true,
            titre: true,
            type: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return { success: true, candidates };

  } catch (error) {
    console.error("Erreur lors de la récupération des candidats:", error);
    return { success: false, error: "Erreur interne du serveur" };
  }
}

export async function getAdherentsLight(): Promise<{ success: boolean; adherents?: Array<{ id: string; firstname: string | null; lastname: string | null; email: string | null }> ; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non autorisé" };

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.role !== "Admin") return { success: false, error: "Admin requis" };

    const adherents = await prisma.adherent.findMany({
      include: { User: { select: { email: true } } },
      orderBy: [ { lastname: 'asc' }, { firstname: 'asc' } ] as any
    });

    const mapped = adherents.map((a: any) => ({ id: a.id, firstname: a.firstname, lastname: a.lastname, email: a.User?.email || null }));
    return { success: true, adherents: mapped };
  } catch (e) {
    console.error("Erreur getAdherentsLight:", e);
    return { success: false, error: "Erreur lors du chargement des adhérents" };
  }
}

// Server Action pour récupérer tous les utilisateurs pour l'admin
export async function getAllUsersForAdmin(): Promise<{ success: boolean; users?: any[]; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non autorisé" };

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.role !== "Admin") return { success: false, error: "Admin requis" };

    const users = await prisma.user.findMany({
      include: {
        adherent: {
          include: {
            Adresse: true,
            Telephones: true
          }
        }
      },
      orderBy: [
        { createdAt: 'desc' }
      ]
    });

    return { success: true, users };
  } catch (e) {
    console.error("Erreur getAllUsersForAdmin:", e);
    return { success: false, error: "Erreur lors du chargement des utilisateurs" };
  }
}

// Server Action pour récupérer un utilisateur par ID
export async function getUserByIdForAdmin(userId: string): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non autorisé" };

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.role !== "Admin") return { success: false, error: "Admin requis" };

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        adherent: {
          include: {
            Adresse: true,
            Telephones: true
          }
        }
      }
    });

    if (!targetUser) return { success: false, error: "Utilisateur non trouvé" };

    return { success: true, user: targetUser };
  } catch (e) {
    console.error("Erreur getUserByIdForAdmin:", e);
    return { success: false, error: "Erreur lors du chargement de l'utilisateur" };
  }
}

// Server Action pour changer le rôle d'un utilisateur
export async function adminUpdateUserRole(userId: string, role: "Admin" | "Membre" | "Invite"): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non autorisé" };

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.role !== "Admin") return { success: false, error: "Admin requis" };

    // Empêcher de changer son propre rôle
    if (userId === session.user.id) {
      return { success: false, error: "Vous ne pouvez pas modifier votre propre rôle" };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { role }
    });

    return { success: true };
  } catch (e) {
    console.error("Erreur adminUpdateUserRole:", e);
    return { success: false, error: "Erreur lors de la mise à jour du rôle" };
  }
}

// Server Action pour changer le statut d'un utilisateur
export async function adminUpdateUserStatus(userId: string, status: "Actif" | "Inactif"): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non autorisé" };

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.role !== "Admin") return { success: false, error: "Admin requis" };

    // Empêcher de changer son propre statut
    if (userId === session.user.id) {
      return { success: false, error: "Vous ne pouvez pas modifier votre propre statut" };
    }

    // Récupérer l'utilisateur avec les infos nécessaires pour l'email
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        adherent: {
          select: {
            civility: true,
            firstname: true,
            lastname: true
          }
        }
      }
    });

    if (!targetUser) {
      return { success: false, error: "Utilisateur non trouvé" };
    }

    // Vérifier si le statut change
    const statusChanged = targetUser.status !== status;

    // Mettre à jour le statut
    await prisma.user.update({
      where: { id: userId },
      data: { status }
    });

    // Envoyer un email si le statut a changé
    if (statusChanged && targetUser.email) {
      try {
        const { sendUserStatusEmail } = await import("@/lib/mail");
        const userName = targetUser.adherent 
          ? `${targetUser.adherent.civility || ''} ${targetUser.adherent.firstname || ''} ${targetUser.adherent.lastname || ''}`.trim()
          : targetUser.name || "Utilisateur";
        
        await sendUserStatusEmail(
          targetUser.email,
          userName,
          status
        );
      } catch (emailError) {
        console.error("Erreur lors de l'envoi de l'email:", emailError);
        // Ne pas bloquer la mise à jour si l'email échoue
      }
    }

    return { success: true };
  } catch (e) {
    console.error("Erreur adminUpdateUserStatus:", e);
    return { success: false, error: "Erreur lors de la mise à jour du statut" };
  }
}

// Server Action pour mettre à jour un utilisateur (admin)
export async function adminUpdateUser(userId: string, data: { name?: string; email?: string }): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non autorisé" };

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.role !== "Admin") return { success: false, error: "Admin requis" };

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.email !== undefined && { email: data.email })
      },
      include: {
        adherent: {
          include: {
            Adresse: true,
            Telephones: true
          }
        }
      }
    });

    return { success: true, user: updated };
  } catch (e) {
    console.error("Erreur adminUpdateUser:", e);
    return { success: false, error: "Erreur lors de la mise à jour de l'utilisateur" };
  }
}
