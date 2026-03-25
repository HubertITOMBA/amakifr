"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { TypeTelephone } from "@prisma/client";

const AdminUpdateUserDataSchema = z.object({
  userId: z.string().min(1),
  userData: z.object({
    name: z.string().min(1).max(255),
    email: z.string().email(),
    image: z.string().optional().nullable(),
  }),
  adherentData: z.object({
    civility: z.enum(["Monsieur", "Madame", "Mademoiselle", "Partenaire"]).optional().nullable(),
    firstname: z.string().min(1).max(255),
    lastname: z.string().min(1).max(255),
    dateNaissance: z.string().optional().nullable(),
    datePremiereAdhesion: z.string().optional().nullable(),
    typeAdhesion: z.enum(["AdhesionAnnuelle", "Renouvellement", "Autre"]).optional().nullable(),
    profession: z.string().max(255).optional().nullable(),
    centresInteret: z.string().optional().nullable(),
    autorisationImage: z.boolean().optional(),
    accepteCommunications: z.boolean().optional(),
    nombreEnfants: z.number().int().min(0).optional(),
    evenementsFamiliaux: z.array(z.string()).optional(),
    posteTemplateId: z.string().optional().nullable(),
  }),
  adresseData: z
    .object({
      streetnum: z.string().optional().nullable(),
      street1: z.string().optional().nullable(),
      street2: z.string().optional().nullable(),
      codepost: z.string().optional().nullable(),
      city: z.string().optional().nullable(),
      country: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  telephonesData: z
    .array(
      z.object({
        numero: z.string(),
        type: z.enum(["Mobile", "Fixe", "Professionnel"]),
        estPrincipal: z.boolean(),
        description: z.string().optional().nullable(),
      })
    )
    .optional(),
  enfantsData: z
    .array(
      z.object({
        prenom: z.string(),
        dateNaissance: z.string().optional().nullable(),
        age: z.number().int().min(0).optional().nullable(),
      })
    )
    .optional(),
});

export async function adminUpdateUserData(data: z.infer<typeof AdminUpdateUserDataSchema>) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non autorisé" };

    const admin = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!admin || admin.role !== "ADMIN") return { success: false, error: "Admin requis" };

    const validated = AdminUpdateUserDataSchema.parse(data);

    const target = await prisma.user.findUnique({
      where: { id: validated.userId },
      include: { adherent: { include: { Adresse: true } } },
    });
    if (!target) return { success: false, error: "Utilisateur introuvable" };
    if (!target.adherent) return { success: false, error: "Adhérent introuvable pour cet utilisateur" };

    // MAJ user
    await prisma.user.update({
      where: { id: validated.userId },
      data: {
        name: validated.userData.name,
        email: validated.userData.email,
        image: validated.userData.image ?? null,
      },
    });

    // MAJ adherent
    await prisma.adherent.update({
      where: { id: target.adherent.id },
      data: {
        civility: (validated.adherentData.civility ?? undefined) as any,
        firstname: validated.adherentData.firstname,
        lastname: validated.adherentData.lastname,
        dateNaissance: validated.adherentData.dateNaissance ? new Date(validated.adherentData.dateNaissance) : null,
        datePremiereAdhesion: validated.adherentData.datePremiereAdhesion ? new Date(validated.adherentData.datePremiereAdhesion) : null,
        typeAdhesion: (validated.adherentData.typeAdhesion ?? undefined) as any,
        profession: validated.adherentData.profession ?? null,
        centresInteret: validated.adherentData.centresInteret ?? null,
        autorisationImage: validated.adherentData.autorisationImage ?? false,
        accepteCommunications: validated.adherentData.accepteCommunications ?? true,
        nombreEnfants: validated.adherentData.nombreEnfants ?? 0,
        evenementsFamiliaux: validated.adherentData.evenementsFamiliaux
          ? JSON.stringify(validated.adherentData.evenementsFamiliaux)
          : null,
        posteTemplateId: validated.adherentData.posteTemplateId ?? null,
      },
    });

    // Adresse (1 seule adresse principale)
    if (validated.adresseData) {
      const currentAdresse = target.adherent.Adresse?.[0];
      if (currentAdresse) {
        await prisma.adresse.update({
          where: { id: currentAdresse.id },
          data: {
            streetnum: validated.adresseData.streetnum ?? "",
            street1: validated.adresseData.street1 ?? "",
            street2: validated.adresseData.street2 ?? "",
            codepost: validated.adresseData.codepost ?? "",
            city: validated.adresseData.city ?? "",
            country: validated.adresseData.country ?? "",
          },
        });
      } else {
        await prisma.adresse.create({
          data: {
            adherentId: target.adherent.id,
            streetnum: validated.adresseData.streetnum ?? "",
            street1: validated.adresseData.street1 ?? "",
            street2: validated.adresseData.street2 ?? "",
            codepost: validated.adresseData.codepost ?? "",
            city: validated.adresseData.city ?? "",
            country: validated.adresseData.country ?? "",
          },
        });
      }
    }

    // Téléphones (remplacement complet comme /user/update)
    if (validated.telephonesData) {
      await prisma.telephone.deleteMany({ where: { adherentId: target.adherent.id } });
      for (const tel of validated.telephonesData) {
        if (!tel.numero?.trim()) continue;
        await prisma.telephone.create({
          data: {
            adherentId: target.adherent.id,
            numero: tel.numero,
            type: tel.type as TypeTelephone,
            estPrincipal: tel.estPrincipal,
            description: tel.description ?? null,
          },
        });
      }
    }

    // Enfants (remplacement complet comme /user/update)
    if (validated.enfantsData) {
      await prisma.enfant.deleteMany({ where: { adherentId: target.adherent.id } });
      for (const enfant of validated.enfantsData) {
        if (!enfant.prenom?.trim()) continue;
        await prisma.enfant.create({
          data: {
            adherentId: target.adherent.id,
            prenom: enfant.prenom,
            dateNaissance: enfant.dateNaissance ? new Date(enfant.dateNaissance) : null,
            age: enfant.age ?? null,
          },
        });
      }
    }

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${validated.userId}/consultation`);
    revalidatePath(`/admin/users/${validated.userId}/edition`);

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false, error: error.errors[0]?.message || "Données invalides" };
    console.error("adminUpdateUserData error:", error);
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

