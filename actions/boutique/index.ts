"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { slugifyMerchTitle, generateMerchOrderNumber } from "@/lib/boutique";
import { normalizePhoneE164 } from "@/lib/phone";
import { MerchOrderStatus } from "@prisma/client";

const UPLOAD_DIR = join(process.cwd(), "public", "produits-derives");
const PUBLIC_PREFIX = "/produits-derives";

const VariantSchema = z.object({
  id: z.string().optional(),
  taille: z.string().min(1, "La taille est requise").max(50),
  couleur: z.string().min(1, "La couleur est requise").max(50),
  prix: z.number().min(0, "Le prix doit être positif"),
  stock: z.number().int().min(0, "Le stock doit être positif ou nul"),
  actif: z.boolean().optional().default(true),
});

const ProductSchema = z.object({
  titre: z.string().min(1, "Le titre est requis").max(255),
  description: z.string().optional().nullable(),
  actif: z.boolean().default(true),
  ordre: z.number().int().default(0),
  variants: z.array(VariantSchema).min(1, "Au moins une variante est requise"),
});

const UpdateProductSchema = ProductSchema.extend({
  id: z.string().min(1),
});

const CreateOrderSchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantite: z.number().int().min(1).max(99),
      })
    )
    .min(1, "Le panier est vide"),
  email: z.string().email("Email invalide"),
  nom: z.string().min(1, "Le nom est requis").max(255),
  telephone: z.string().optional().nullable(),
  adresseLivraison: z.string().min(1, "L'adresse de livraison est requise"),
  ville: z.string().optional().nullable(),
  codePostal: z.string().optional().nullable(),
  pays: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: "Non autorisé" };
  }
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.role !== "ADMIN") {
    return { ok: false as const, error: "Accès administrateur requis" };
  }
  return { ok: true as const, userId: session.user.id };
}

async function ensureUniqueSlug(base: string, excludeId?: string) {
  let slug = slugifyMerchTitle(base);
  let counter = 1;
  while (true) {
    const existing = await db.merchProduct.findFirst({
      where: {
        slug,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (!existing) return slug;
    counter += 1;
    slug = `${slugifyMerchTitle(base)}-${counter}`;
  }
}

function mapProduct(product: any) {
  return {
    ...product,
    variants: product.variants?.map((v: any) => ({
      ...v,
      prix: Number(v.prix),
    })),
  };
}

/**
 * Liste tous les produits (admin)
 */
export async function getAllMerchProducts() {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return { success: false, error: admin.error };

    const products = await db.merchProduct.findMany({
      include: {
        images: { orderBy: { ordre: "asc" } },
        variants: { orderBy: [{ taille: "asc" }, { couleur: "asc" }] },
        _count: { select: { variants: true, images: true } },
      },
      orderBy: [{ ordre: "asc" }, { createdAt: "desc" }],
    });

    return { success: true, data: products.map(mapProduct) };
  } catch (error) {
    console.error("getAllMerchProducts:", error);
    return { success: false, error: "Erreur lors du chargement des produits" };
  }
}

/**
 * Détail produit par ID (admin)
 */
export async function getMerchProductById(id: string) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return { success: false, error: admin.error };

    const product = await db.merchProduct.findUnique({
      where: { id },
      include: {
        images: { orderBy: { ordre: "asc" } },
        variants: { orderBy: [{ taille: "asc" }, { couleur: "asc" }] },
      },
    });
    if (!product) return { success: false, error: "Produit introuvable" };

    return { success: true, data: mapProduct(product) };
  } catch (error) {
    console.error("getMerchProductById:", error);
    return { success: false, error: "Erreur lors du chargement du produit" };
  }
}

/**
 * Produits actifs (public)
 */
export async function getPublicMerchProducts() {
  try {
    const products = await db.merchProduct.findMany({
      where: { actif: true },
      include: {
        images: { orderBy: { ordre: "asc" }, take: 1 },
        variants: {
          where: { actif: true, stock: { gt: 0 } },
          orderBy: { prix: "asc" },
        },
      },
      orderBy: [{ ordre: "asc" }, { createdAt: "desc" }],
    });

    return {
      success: true,
      data: products.map((p) => ({
        id: p.id,
        titre: p.titre,
        slug: p.slug,
        description: p.description,
        imageCover: p.imageCover || p.images[0]?.chemin || null,
        prixMin: p.variants.length > 0 ? Number(p.variants[0].prix) : null,
        enStock: p.variants.some((v) => v.stock > 0),
      })),
    };
  } catch (error) {
    console.error("getPublicMerchProducts:", error);
    return { success: false, error: "Erreur lors du chargement de la boutique" };
  }
}

/**
 * Détail produit par slug (public)
 */
export async function getPublicMerchProductBySlug(slug: string) {
  try {
    const product = await db.merchProduct.findFirst({
      where: { slug, actif: true },
      include: {
        images: { orderBy: { ordre: "asc" } },
        variants: {
          where: { actif: true },
          orderBy: [{ taille: "asc" }, { couleur: "asc" }],
        },
      },
    });
    if (!product) return { success: false, error: "Produit introuvable" };

    return { success: true, data: mapProduct(product) };
  } catch (error) {
    console.error("getPublicMerchProductBySlug:", error);
    return { success: false, error: "Erreur lors du chargement du produit" };
  }
}

/**
 * Crée un produit dérivé avec ses variantes
 */
export async function createMerchProduct(data: z.infer<typeof ProductSchema>) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return { success: false, error: admin.error };

    const validated = ProductSchema.parse(data);
    const slug = await ensureUniqueSlug(validated.titre);

    const product = await db.merchProduct.create({
      data: {
        titre: validated.titre,
        slug,
        description: validated.description || null,
        actif: validated.actif,
        ordre: validated.ordre,
        createdBy: admin.userId,
        variants: {
          create: validated.variants.map((v) => ({
            taille: v.taille.trim(),
            couleur: v.couleur.trim(),
            prix: v.prix,
            stock: v.stock,
            actif: v.actif ?? true,
          })),
        },
      },
      include: { variants: true, images: true },
    });

    revalidatePath("/admin/boutique");
    revalidatePath("/boutique");
    revalidatePath("/");

    return {
      success: true,
      message: "Produit créé avec succès",
      data: mapProduct(product),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message || "Données invalides" };
    }
    console.error("createMerchProduct:", error);
    return { success: false, error: "Erreur lors de la création du produit" };
  }
}

/**
 * Met à jour un produit et remplace ses variantes
 */
export async function updateMerchProduct(data: z.infer<typeof UpdateProductSchema>) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return { success: false, error: admin.error };

    const validated = UpdateProductSchema.parse(data);
    const existing = await db.merchProduct.findUnique({ where: { id: validated.id } });
    if (!existing) return { success: false, error: "Produit introuvable" };

    const slug =
      validated.titre !== existing.titre
        ? await ensureUniqueSlug(validated.titre, validated.id)
        : existing.slug;

    await db.$transaction(async (tx) => {
      await tx.merchProductVariant.deleteMany({ where: { productId: validated.id } });
      await tx.merchProduct.update({
        where: { id: validated.id },
        data: {
          titre: validated.titre,
          slug,
          description: validated.description || null,
          actif: validated.actif,
          ordre: validated.ordre,
          variants: {
            create: validated.variants.map((v) => ({
              taille: v.taille.trim(),
              couleur: v.couleur.trim(),
              prix: v.prix,
              stock: v.stock,
              actif: v.actif ?? true,
            })),
          },
        },
      });
    });

    const product = await db.merchProduct.findUnique({
      where: { id: validated.id },
      include: { variants: true, images: true },
    });

    revalidatePath("/admin/boutique");
    revalidatePath("/boutique");
    revalidatePath(`/boutique/${slug}`);
    revalidatePath("/");

    return {
      success: true,
      message: "Produit mis à jour avec succès",
      data: mapProduct(product),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message || "Données invalides" };
    }
    console.error("updateMerchProduct:", error);
    return { success: false, error: "Erreur lors de la mise à jour du produit" };
  }
}

/**
 * Supprime un produit et ses images du disque
 */
export async function deleteMerchProduct(id: string) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return { success: false, error: admin.error };

    const product = await db.merchProduct.findUnique({
      where: { id },
      include: { images: true },
    });
    if (!product) return { success: false, error: "Produit introuvable" };

    await db.merchProduct.delete({ where: { id } });

    for (const img of product.images) {
      const filePath = join(process.cwd(), "public", img.chemin.replace(/^\//, ""));
      if (existsSync(filePath)) {
        await unlink(filePath).catch(() => undefined);
      }
    }

    revalidatePath("/admin/boutique");
    revalidatePath("/boutique");
    revalidatePath("/");

    return { success: true, message: "Produit supprimé avec succès" };
  } catch (error) {
    console.error("deleteMerchProduct:", error);
    return { success: false, error: "Erreur lors de la suppression du produit" };
  }
}

/**
 * Upload une image pour un produit dérivé
 */
export async function uploadMerchProductImage(formData: FormData) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return { success: false, error: admin.error };

    const productId = formData.get("productId") as string;
    const file = formData.get("file") as File | null;
    const estPrincipale = formData.get("estPrincipale") === "true";

    if (!productId) return { success: false, error: "Produit requis" };
    if (!file) return { success: false, error: "Aucun fichier fourni" };
    if (!file.type.startsWith("image/")) {
      return { success: false, error: "Le fichier doit être une image" };
    }
    if (file.size > 10 * 1024 * 1024) {
      return { success: false, error: "Image trop volumineuse (max 10 Mo)" };
    }

    const product = await db.merchProduct.findUnique({ where: { id: productId } });
    if (!product) return { success: false, error: "Produit introuvable" };

    if (!existsSync(UPLOAD_DIR)) {
      mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const nomFichier = `${timestamp}_${safeName}`;
    const cheminAbsolu = join(UPLOAD_DIR, nomFichier);
    const buffer = Buffer.from(await file.arrayBuffer());

    const { validateFileContent, validateFileSize } = await import("@/lib/file-validation");
    const fileValidation = await validateFileContent(buffer, file.type, file.name);
    if (!fileValidation.valid) {
      return { success: false, error: fileValidation.error || "Fichier invalide" };
    }
    const sizeValidation = validateFileSize(file.size, 10 * 1024 * 1024, "image");
    if (!sizeValidation.valid) {
      return { success: false, error: sizeValidation.error || "Fichier trop volumineux" };
    }

    await writeFile(cheminAbsolu, buffer);
    const cheminRelatif = `${PUBLIC_PREFIX}/${nomFichier}`;

    const count = await db.merchProductImage.count({ where: { productId } });
    const image = await db.$transaction(async (tx) => {
      if (estPrincipale || count === 0) {
        await tx.merchProductImage.updateMany({
          where: { productId },
          data: { estPrincipale: false },
        });
        await tx.merchProduct.update({
          where: { id: productId },
          data: { imageCover: cheminRelatif },
        });
      }
      return tx.merchProductImage.create({
        data: {
          productId,
          chemin: cheminRelatif,
          nomFichier: file.name,
          ordre: count,
          estPrincipale: estPrincipale || count === 0,
        },
      });
    });

    revalidatePath("/admin/boutique");
    revalidatePath("/boutique");
    revalidatePath(`/boutique/${product.slug}`);
    revalidatePath("/");

    return { success: true, message: "Image ajoutée", data: image };
  } catch (error) {
    console.error("uploadMerchProductImage:", error);
    return { success: false, error: "Erreur lors de l'upload de l'image" };
  }
}

/**
 * Supprime une image produit
 */
export async function deleteMerchProductImage(imageId: string) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return { success: false, error: admin.error };

    const image = await db.merchProductImage.findUnique({
      where: { id: imageId },
      include: { Product: true },
    });
    if (!image) return { success: false, error: "Image introuvable" };

    await db.merchProductImage.delete({ where: { id: imageId } });

    const filePath = join(process.cwd(), "public", image.chemin.replace(/^\//, ""));
    if (existsSync(filePath)) {
      await unlink(filePath).catch(() => undefined);
    }

    if (image.estPrincipale) {
      const next = await db.merchProductImage.findFirst({
        where: { productId: image.productId },
        orderBy: { ordre: "asc" },
      });
      if (next) {
        await db.merchProductImage.update({
          where: { id: next.id },
          data: { estPrincipale: true },
        });
        await db.merchProduct.update({
          where: { id: image.productId },
          data: { imageCover: next.chemin },
        });
      } else {
        await db.merchProduct.update({
          where: { id: image.productId },
          data: { imageCover: null },
        });
      }
    }

    revalidatePath("/admin/boutique");
    revalidatePath("/boutique");
    if (image.Product) revalidatePath(`/boutique/${image.Product.slug}`);
    revalidatePath("/");

    return { success: true, message: "Image supprimée" };
  } catch (error) {
    console.error("deleteMerchProductImage:", error);
    return { success: false, error: "Erreur lors de la suppression de l'image" };
  }
}

/**
 * Liste des commandes (admin)
 */
export async function getAllMerchOrders() {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return { success: false, error: admin.error };

    const orders = await db.merchOrder.findMany({
      include: {
        items: true,
        User: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: orders.map((o) => ({
        ...o,
        montantTotal: Number(o.montantTotal),
        items: o.items.map((i) => ({
          ...i,
          prixUnitaire: Number(i.prixUnitaire),
          sousTotal: Number(i.sousTotal),
        })),
      })),
    };
  } catch (error) {
    console.error("getAllMerchOrders:", error);
    return { success: false, error: "Erreur lors du chargement des commandes" };
  }
}

/**
 * Crée une commande boutique (public, panier)
 */
export async function createMerchOrder(data: z.infer<typeof CreateOrderSchema>) {
  try {
    const session = await auth();
    const validated = CreateOrderSchema.parse(data);

    const variants = await db.merchProductVariant.findMany({
      where: {
        id: { in: validated.items.map((i) => i.variantId) },
        actif: true,
        Product: { actif: true },
      },
      include: { Product: true },
    });

    if (variants.length !== validated.items.length) {
      return { success: false, error: "Un ou plusieurs articles ne sont plus disponibles" };
    }

    const variantMap = new Map(variants.map((v) => [v.id, v]));
    let montantTotal = 0;
    const lineItems: Array<{
      variantId: string;
      productTitre: string;
      taille: string;
      couleur: string;
      prixUnitaire: number;
      quantite: number;
      sousTotal: number;
    }> = [];

    for (const item of validated.items) {
      const variant = variantMap.get(item.variantId);
      if (!variant) {
        return { success: false, error: "Article introuvable" };
      }
      if (variant.stock < item.quantite) {
        return {
          success: false,
          error: `Stock insuffisant pour ${variant.Product.titre} (${variant.taille} / ${variant.couleur})`,
        };
      }
      const prixUnitaire = Number(variant.prix);
      const sousTotal = prixUnitaire * item.quantite;
      montantTotal += sousTotal;
      lineItems.push({
        variantId: variant.id,
        productTitre: variant.Product.titre,
        taille: variant.taille,
        couleur: variant.couleur,
        prixUnitaire,
        quantite: item.quantite,
        sousTotal,
      });
    }

    const numeroCommande = generateMerchOrderNumber();
    const telephone = validated.telephone
      ? normalizePhoneE164(validated.telephone) || validated.telephone.trim()
      : null;

    const order = await db.$transaction(async (tx) => {
      for (const item of validated.items) {
        const updated = await tx.merchProductVariant.updateMany({
          where: {
            id: item.variantId,
            stock: { gte: item.quantite },
          },
          data: { stock: { decrement: item.quantite } },
        });
        if (updated.count === 0) {
          throw new Error("STOCK_INSUFFISANT");
        }
      }

      return tx.merchOrder.create({
        data: {
          numeroCommande,
          userId: session?.user?.id || null,
          email: validated.email,
          nom: validated.nom,
          telephone,
          adresseLivraison: validated.adresseLivraison,
          ville: validated.ville || null,
          codePostal: validated.codePostal || null,
          pays: validated.pays || "France",
          montantTotal,
          notes: validated.notes || null,
          statut: MerchOrderStatus.EnAttente,
          items: {
            create: lineItems.map((li) => ({
              variantId: li.variantId,
              productTitre: li.productTitre,
              taille: li.taille,
              couleur: li.couleur,
              prixUnitaire: li.prixUnitaire,
              quantite: li.quantite,
              sousTotal: li.sousTotal,
            })),
          },
        },
        include: { items: true },
      });
    });

    const subject = `Confirmation de commande ${numeroCommande} — AMAKI France`;
    const linesHtml = lineItems
      .map(
        (li) =>
          `<li><strong>${li.productTitre}</strong> — ${li.taille} / ${li.couleur} × ${li.quantite} = ${li.sousTotal.toFixed(2)} €</li>`
      )
      .join("");
    const bodyHtml = `
      <p>Bonjour ${validated.nom},</p>
      <p>Nous avons bien reçu votre commande de produits dérivés AMAKI.</p>
      <p><strong>Numéro de commande :</strong> ${numeroCommande}</p>
      <p><strong>Total :</strong> ${montantTotal.toFixed(2)} €</p>
      <p><strong>Livraison :</strong><br/>
      ${validated.adresseLivraison}<br/>
      ${validated.codePostal || ""} ${validated.ville || ""}<br/>
      ${validated.pays || "France"}
      </p>
      <p><strong>Détail :</strong></p>
      <ul>${linesHtml}</ul>
      <p>Le bureau de l'association vous contactera pour la suite (paiement / livraison).</p>
      <p>Merci pour votre soutien à AMAKI France.</p>
    `;

    let emailSent = false;
    let emailError: string | null = null;
    try {
      const { sendEmail } = await import("@/lib/mail");
      emailSent = await sendEmail(
        {
          to: validated.email,
          subject,
          html: bodyHtml,
        },
        false
      );
    } catch (err) {
      emailError = err instanceof Error ? err.message : "Erreur d'envoi email";
    }

    await db.merchOrder.update({
      where: { id: order.id },
      data: {
        confirmationEmailSubject: subject,
        confirmationEmailBody: bodyHtml,
        confirmationEmailSentAt: emailSent ? new Date() : null,
        confirmationEmailError: emailError,
      },
    });

    if (session?.user?.id) {
      const adminUser = await db.user.findFirst({ where: { role: "ADMIN" } });
      await db.email
        .create({
          data: {
            userId: session.user.id,
            createdBy: adminUser?.id || session.user.id,
            subject,
            body: bodyHtml,
            recipientEmail: validated.email,
            sent: emailSent,
            error: emailError,
          },
        })
        .catch((e) => console.error("Historisation email commande:", e));
    }

    revalidatePath("/admin/boutique");
    revalidatePath("/boutique");

    return {
      success: true,
      message: emailSent
        ? "Commande enregistrée. Un email de confirmation vous a été envoyé."
        : "Commande enregistrée. L'email de confirmation n'a pas pu être envoyé.",
      data: {
        orderId: order.id,
        numeroCommande,
        montantTotal,
        emailSent,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message || "Données invalides" };
    }
    if (error instanceof Error && error.message === "STOCK_INSUFFISANT") {
      return { success: false, error: "Stock insuffisant pour un article du panier" };
    }
    console.error("createMerchOrder:", error);
    return { success: false, error: "Erreur lors de la création de la commande" };
  }
}

/**
 * Infos de livraison préremplies pour utilisateur connecté
 */
export async function getMerchCheckoutPrefill() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: true, data: null };
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: {
        adherent: {
          include: {
            Adresse: true,
            Telephones: { where: { estPrincipal: true }, take: 1 },
          },
        },
      },
    });

    if (!user) return { success: true, data: null };

    const adr = user.adherent?.Adresse?.[0];
    const tel = user.adherent?.Telephones?.[0];

    return {
      success: true,
      data: {
        email: user.email || "",
        nom:
          user.adherent
            ? `${user.adherent.firstname || ""} ${user.adherent.lastname || ""}`.trim()
            : user.name || "",
        telephone: tel?.numero || "",
        adresseLivraison: adr
          ? [adr.streetnum, adr.street1, adr.street2].filter(Boolean).join(" ")
          : "",
        ville: adr?.city || "",
        codePostal: adr?.codepost || "",
        pays: adr?.country || "France",
      },
    };
  } catch (error) {
    console.error("getMerchCheckoutPrefill:", error);
    return { success: false, error: "Erreur lors du chargement des informations" };
  }
}
