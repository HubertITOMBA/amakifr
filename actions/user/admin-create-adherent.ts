"use server"

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Civilities, TypeTelephone, TypeAdhesion, UserRole, UserStatus } from "@prisma/client";
import { normalizeEmail } from "@/lib/utils";
import { getUserByEmail } from "@/actions/auth";

/**
 * Schéma Zod pour la création d'un adhérent par un administrateur
 */
const CreateAdherentSchema = z.object({
  // Informations de connexion (User)
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères").optional().or(z.literal("")),
  name: z.string().min(2, "Le nom d'utilisateur doit contenir au moins 2 caractères").optional().or(z.literal("")),
  role: z.nativeEnum(UserRole, { errorMap: () => ({ message: "Rôle invalide" }) }).optional(),
  status: z.nativeEnum(UserStatus, { errorMap: () => ({ message: "Statut invalide" }) }).optional(),
  
  // Informations personnelles (Adherent)
  civility: z.nativeEnum(Civilities, { errorMap: () => ({ message: "Civilité invalide" }) }),
  firstname: z.string().min(1, "Le prénom est requis").max(255),
  lastname: z.string().min(1, "Le nom est requis").max(255),
  dateNaissance: z.string().optional().or(z.literal("")),
  typeAdhesion: z.nativeEnum(TypeAdhesion, { errorMap: () => ({ message: "Type d'adhésion invalide" }) }).optional(),
  profession: z.string().max(255).optional().or(z.literal("")),
  anneePromotion: z.string().max(10).optional().or(z.literal("")),
  centresInteret: z.string().optional().or(z.literal("")),
  autorisationImage: z.boolean().optional(),
  accepteCommunications: z.boolean().optional(),
  nombreEnfants: z.number().int().min(0).optional(),
  
  // Adresse
  streetnum: z.string().optional().or(z.literal("")),
  street1: z.string().optional().or(z.literal("")),
  street2: z.string().optional().or(z.literal("")),
  codepost: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  country: z.string().optional().or(z.literal("")),
  
  // Téléphone
  telephone: z.string().optional().or(z.literal("")),
  typeTelephone: z.nativeEnum(TypeTelephone, { errorMap: () => ({ message: "Type de téléphone invalide" }) }).optional(),
  
  // Poste
  posteTemplateId: z.string().optional().or(z.literal("")),
});

type CreateAdherentData = z.infer<typeof CreateAdherentSchema>;

/**
 * Crée un nouvel adhérent dans la base de données (réservé aux administrateurs)
 * 
 * @param formData - Les données du formulaire contenant toutes les informations de l'adhérent
 * @returns Un objet avec success (boolean), message (string) en cas de succès,
 * ou error (string) en cas d'échec, et id (string) de l'utilisateur créé
 * @throws {z.ZodError} Si les données ne respectent pas le schéma de validation
 */
export async function adminCreateAdherent(formData: FormData) {
  try {
    // Vérifier que l'utilisateur est authentifié et est admin
    const session = await auth();
    if (!session?.user || session.user.role !== "Admin") {
      return { success: false, error: "Non autorisé. Seuls les administrateurs peuvent créer des adhérents." };
    }

    // Extraire les données du FormData
    const rawData: CreateAdherentData = {
      // User
      email: formData.get("email") as string,
      password: formData.get("password") as string || "",
      name: formData.get("name") as string || "",
      role: formData.get("role") as UserRole || UserRole.Membre,
      status: formData.get("status") as UserStatus || UserStatus.Actif,
      
      // Adherent
      civility: formData.get("civility") as Civilities,
      firstname: formData.get("firstname") as string,
      lastname: formData.get("lastname") as string,
      dateNaissance: formData.get("dateNaissance") as string || "",
      typeAdhesion: formData.get("typeAdhesion") as TypeAdhesion || undefined,
      profession: formData.get("profession") as string || "",
      anneePromotion: formData.get("anneePromotion") as string || "",
      centresInteret: formData.get("centresInteret") as string || "",
      autorisationImage: formData.get("autorisationImage") === "true",
      accepteCommunications: formData.get("accepteCommunications") === "true",
      nombreEnfants: parseInt(formData.get("nombreEnfants") as string || "0"),
      
      // Adresse
      streetnum: formData.get("streetnum") as string || "",
      street1: formData.get("street1") as string || "",
      street2: formData.get("street2") as string || "",
      codepost: formData.get("codepost") as string || "",
      city: formData.get("city") as string || "",
      country: formData.get("country") as string || "France",
      
      // Téléphone
      telephone: formData.get("telephone") as string || "",
      typeTelephone: formData.get("typeTelephone") as TypeTelephone || TypeTelephone.Mobile,
      
      // Poste
      posteTemplateId: formData.get("posteTemplateId") as string || "",
    };

    // Valider les données
    const validatedData = CreateAdherentSchema.parse(rawData);

    // Normaliser l'email en minuscules pour éviter les doublons case-insensitive
    const normalizedEmail = normalizeEmail(validatedData.email);

    // Vérifier si l'email existe déjà (recherche case-insensitive)
    const existingUser = await getUserByEmail(normalizedEmail);

    if (existingUser) {
      return { success: false, error: "Cet email est déjà utilisé par un autre utilisateur." };
    }

    // Vérifier si le nom d'utilisateur existe déjà (si fourni)
    if (validatedData.name && validatedData.name.trim() !== "") {
      const existingUserByName = await db.user.findUnique({
        where: { name: validatedData.name },
      });

      if (existingUserByName) {
        return { success: false, error: "Ce nom d'utilisateur est déjà utilisé." };
      }
    }

    // Hasher le mot de passe si fourni
    let hashedPassword: string | null = null;
    if (validatedData.password && validatedData.password.trim() !== "") {
      hashedPassword = await bcrypt.hash(validatedData.password, 10);
    }

    // Créer l'utilisateur et l'adhérent dans une transaction
    const result = await db.$transaction(async (tx) => {
      // Créer l'utilisateur avec l'email normalisé
      const user = await tx.user.create({
        data: {
          email: normalizedEmail, // Utiliser l'email normalisé
          name: validatedData.name && validatedData.name.trim() !== "" ? validatedData.name : null,
          password: hashedPassword,
          role: validatedData.role || UserRole.Membre,
          status: validatedData.status || UserStatus.Actif,
        },
      });

      // Créer l'adhérent
      const adherent = await tx.adherent.create({
        data: {
          userId: user.id,
          civility: validatedData.civility,
          firstname: validatedData.firstname,
          lastname: validatedData.lastname,
          dateNaissance: validatedData.dateNaissance && validatedData.dateNaissance.trim() !== "" 
            ? new Date(validatedData.dateNaissance) 
            : null,
          typeAdhesion: validatedData.typeAdhesion || null,
          profession: validatedData.profession && validatedData.profession.trim() !== "" ? validatedData.profession : null,
          anneePromotion: validatedData.anneePromotion && validatedData.anneePromotion.trim() !== "" ? validatedData.anneePromotion : null,
          centresInteret: validatedData.centresInteret && validatedData.centresInteret.trim() !== "" ? validatedData.centresInteret : null,
          autorisationImage: validatedData.autorisationImage || false,
          accepteCommunications: validatedData.accepteCommunications !== false,
          nombreEnfants: validatedData.nombreEnfants || 0,
          posteTemplateId: validatedData.posteTemplateId && validatedData.posteTemplateId.trim() !== "" 
            ? validatedData.posteTemplateId 
            : null,
        },
      });

      // Créer l'adresse si au moins un champ est rempli
      const hasAddressData = [
        validatedData.streetnum,
        validatedData.street1,
        validatedData.street2,
        validatedData.codepost,
        validatedData.city,
        validatedData.country,
      ].some(field => field && field.trim() !== "");

      if (hasAddressData) {
        await tx.adresse.create({
          data: {
            adherentId: adherent.id,
            streetnum: validatedData.streetnum || "",
            street1: validatedData.street1 || "",
            street2: validatedData.street2 || "",
            codepost: validatedData.codepost || "",
            city: validatedData.city || "",
            country: validatedData.country || "France",
          },
        });
      }

      // Créer le téléphone si fourni
      if (validatedData.telephone && validatedData.telephone.trim() !== "") {
        await tx.telephone.create({
          data: {
            adherentId: adherent.id,
            numero: validatedData.telephone,
            type: validatedData.typeTelephone || TypeTelephone.Mobile,
            estPrincipal: true,
          },
        });
      }

      return { user, adherent };
    });

    // Envoyer l'email de bienvenue à l'adhérent (non bloquant)
    try {
      const { sendAdminCreatedAccountEmail } = await import("@/lib/mail");
      await sendAdminCreatedAccountEmail(
        validatedData.email,
        validatedData.firstname,
        validatedData.lastname,
        !!hashedPassword, // true si un mot de passe a été défini
        validatedData.name && validatedData.name.trim() !== "" ? validatedData.name : null
      );
    } catch (emailError) {
      console.error("Erreur lors de l'envoi de l'email de bienvenue:", emailError);
      // Ne pas bloquer la création si l'envoi d'email échoue
    }

    return {
      success: true,
      message: `Adhérent ${validatedData.firstname} ${validatedData.lastname} créé avec succès. Un email de bienvenue a été envoyé à ${normalizedEmail}.`,
      id: result.user.id,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    
    // Gérer les erreurs de contrainte unique Prisma
    if ((error as any)?.code === 'P2002') {
      const target = (error as any)?.meta?.target;
      if (target?.includes('email')) {
        return { success: false, error: "Cet email est déjà utilisé." };
      }
      if (target?.includes('name')) {
        return { success: false, error: "Ce nom d'utilisateur est déjà utilisé." };
      }
    }

    console.error("Erreur lors de la création de l'adhérent:", error);
    return { success: false, error: "Une erreur s'est produite lors de la création de l'adhérent." };
  } finally {
    revalidatePath("/admin/users");
  }
}
