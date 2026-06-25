"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { slugifyMerchTitle, generateMerchOrderNumber, buildMerchOrderTrackingUrl, getMerchStockLevel, getMerchStockAlertType, getMerchAppBaseUrl, type MerchStockLevel } from "@/lib/boutique";
import { normalizePhoneE164 } from "@/lib/phone";
import { MerchOrderStatus, MerchPaymentStatus, MerchStockMovementType, Prisma } from "@prisma/client";
import { randomBytes } from "crypto";

const UPLOAD_DIR = join(process.cwd(), "public", "ressources", "produits-derives");
const PUBLIC_PREFIX = "/ressources/produits-derives";

function resolveMerchImageDiskPath(chemin: string) {
  const relative = chemin.replace(/^\//, "");
  return join(process.cwd(), "public", relative);
}

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
  seuilAlerteStock: z.number().int().min(0, "Le seuil doit être positif ou nul").default(5),
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

const UpdateOrderAdminSchema = z.object({
  orderId: z.string().min(1, "Commande requise"),
  statut: z.nativeEnum(MerchOrderStatus),
  statutPaiement: z.nativeEnum(MerchPaymentStatus),
  referenceSuivi: z.string().max(100).optional().nullable(),
  notesAdmin: z.string().optional().nullable(),
});

const UpdateVariantStockSchema = z.object({
  variantId: z.string().min(1, "Variante requise"),
  stock: z.number().int().min(0, "Le stock doit être positif ou nul"),
});

function mapOrder(order: any) {
  return {
    ...order,
    montantTotal: Number(order.montantTotal),
    items:
      order.items?.map((i: any) => {
        const product = i.Variant?.Product;
        const imageCover =
          product?.imageCover || product?.images?.[0]?.chemin || null;
        const { Variant: _variant, ...rest } = i;
        return {
          ...rest,
          prixUnitaire: Number(i.prixUnitaire),
          sousTotal: Number(i.sousTotal),
          imageCover,
        };
      }) ?? [],
  };
}

const orderItemsInclude = {
  include: {
    Variant: {
      include: {
        Product: {
          include: {
            images: { orderBy: { ordre: "asc" as const }, take: 1 },
          },
        },
      },
    },
  },
};

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

interface MerchStockAlertItem {
  productTitre: string;
  taille: string;
  couleur: string;
  stockApres: number;
  seuilAlerte: number;
  alertType: MerchStockLevel;
}

async function recordMerchStockMovement(
  tx: Prisma.TransactionClient,
  data: {
    variantId: string;
    productId: string;
    type: MerchStockMovementType;
    quantite: number;
    stockAvant: number;
    stockApres: number;
    orderId?: string | null;
    motif?: string | null;
    createdBy?: string | null;
  }
) {
  return tx.merchStockMovement.create({ data });
}

/**
 * Envoie un email d'alerte stock aux administrateurs actifs
 */
async function notifyMerchStockAlerts(items: MerchStockAlertItem[]) {
  if (items.length === 0) return;

  try {
    const admins = await db.user.findMany({
      where: { role: "ADMIN", email: { not: null }, status: "Actif" },
      select: { email: true },
    });
    const emails = [...new Set(admins.map((a) => a.email).filter((e): e is string => !!e))];
    if (emails.length === 0) return;

    const { sendMerchStockAlertEmail } = await import("@/lib/mail");
    const adminUrl = `${getMerchAppBaseUrl()}/admin/boutique`;

    for (const email of emails) {
      await sendMerchStockAlertEmail({ to: email, items, adminUrl });
    }
  } catch (error) {
    console.error("[notifyMerchStockAlerts] Erreur envoi alertes stock:", error);
  }
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

export interface MerchStockLine {
  variantId: string;
  productId: string;
  productTitre: string;
  productActif: boolean;
  variantActif: boolean;
  taille: string;
  couleur: string;
  stock: number;
  seuilAlerte: number;
  niveau: MerchStockLevel;
}

/**
 * Vue d'ensemble du stock boutique (variantes actives des produits actifs)
 *
 * @returns Résumé des alertes et lignes détaillées par variante
 */
export async function getMerchStockOverview() {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return { success: false, error: admin.error };

    const products = await db.merchProduct.findMany({
      where: { actif: true },
      include: {
        variants: {
          where: { actif: true },
          orderBy: [{ taille: "asc" }, { couleur: "asc" }],
        },
      },
      orderBy: [{ ordre: "asc" }, { titre: "asc" }],
    });

    const lines: MerchStockLine[] = products.flatMap((product) =>
      product.variants.map((variant) => {
        const seuilAlerte = product.seuilAlerteStock ?? 5;
        return {
          variantId: variant.id,
          productId: product.id,
          productTitre: product.titre,
          productActif: product.actif,
          variantActif: variant.actif,
          taille: variant.taille,
          couleur: variant.couleur,
          stock: variant.stock,
          seuilAlerte,
          niveau: getMerchStockLevel(variant.stock, seuilAlerte),
        };
      })
    );

    const summary = {
      total: lines.length,
      rupture: lines.filter((l) => l.niveau === "rupture").length,
      faible: lines.filter((l) => l.niveau === "faible").length,
      ok: lines.filter((l) => l.niveau === "ok").length,
    };

    return { success: true, data: { summary, lines } };
  } catch (error) {
    console.error("getMerchStockOverview:", error);
    return { success: false, error: "Erreur lors du chargement du stock" };
  }
}

/**
 * Met à jour le stock d'une variante (réapprovisionnement rapide)
 *
 * @param data - Identifiant variante et nouvelle quantité en stock
 */
export async function updateMerchVariantStock(data: z.infer<typeof UpdateVariantStockSchema>) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return { success: false, error: admin.error };

    const validated = UpdateVariantStockSchema.parse(data);
    const variant = await db.merchProductVariant.findUnique({
      where: { id: validated.variantId },
      include: { Product: true },
    });
    if (!variant) return { success: false, error: "Variante introuvable" };

    const stockAvant = variant.stock;
    const stockApres = validated.stock;
    const quantite = stockApres - stockAvant;
    const movementType =
      quantite > 0
        ? MerchStockMovementType.Reapprovisionnement
        : MerchStockMovementType.AjustementManuel;

    await db.$transaction(async (tx) => {
      await tx.merchProductVariant.update({
        where: { id: validated.variantId },
        data: { stock: validated.stock },
      });

      if (quantite !== 0) {
        await recordMerchStockMovement(tx, {
          variantId: variant.id,
          productId: variant.productId,
          type: movementType,
          quantite,
          stockAvant,
          stockApres,
          motif: "Mise à jour depuis l'onglet Stock",
          createdBy: admin.userId,
        });
      }
    });

    revalidatePath("/admin/boutique");
    revalidatePath("/boutique");
    revalidatePath(`/boutique/${variant.Product.slug}`);
    revalidatePath("/");

    const seuil = variant.Product.seuilAlerteStock ?? 5;
    const niveau = getMerchStockLevel(validated.stock, seuil);
    const alertType = getMerchStockAlertType(stockAvant, stockApres, seuil);
    if (alertType) {
      await notifyMerchStockAlerts([
        {
          productTitre: variant.Product.titre,
          taille: variant.taille,
          couleur: variant.couleur,
          stockApres,
          seuilAlerte: seuil,
          alertType,
        },
      ]);
    }

    return {
      success: true,
      message: `Stock mis à jour : ${validated.stock} unité(s)`,
      data: { stock: validated.stock, niveau },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message || "Données invalides" };
    }
    console.error("updateMerchVariantStock:", error);
    return { success: false, error: "Erreur lors de la mise à jour du stock" };
  }
}

export interface MerchStockMovementRow {
  id: string;
  variantId: string;
  productId: string;
  productTitre: string;
  taille: string;
  couleur: string;
  type: MerchStockMovementType;
  quantite: number;
  stockAvant: number;
  stockApres: number;
  orderId: string | null;
  numeroCommande: string | null;
  motif: string | null;
  createdByName: string | null;
  createdAt: Date;
}

/**
 * Historique des mouvements de stock (admin)
 *
 * @param limit - Nombre maximum de lignes (défaut 100)
 */
export async function getMerchStockMovements(limit = 100) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return { success: false, error: admin.error };

    const movements = await db.merchStockMovement.findMany({
      take: Math.min(Math.max(limit, 1), 500),
      orderBy: { createdAt: "desc" },
      include: {
        Product: { select: { titre: true } },
        Variant: { select: { taille: true, couleur: true } },
        Order: { select: { numeroCommande: true } },
        CreatedBy: { select: { name: true, email: true } },
      },
    });

    const data: MerchStockMovementRow[] = movements.map((m) => ({
      id: m.id,
      variantId: m.variantId,
      productId: m.productId,
      productTitre: m.Product.titre,
      taille: m.Variant.taille,
      couleur: m.Variant.couleur,
      type: m.type,
      quantite: m.quantite,
      stockAvant: m.stockAvant,
      stockApres: m.stockApres,
      orderId: m.orderId,
      numeroCommande: m.Order?.numeroCommande ?? null,
      motif: m.motif,
      createdByName: m.CreatedBy?.name || m.CreatedBy?.email || null,
      createdAt: m.createdAt,
    }));

    return { success: true, data };
  } catch (error) {
    console.error("getMerchStockMovements:", error);
    return { success: false, error: "Erreur lors du chargement de l'historique" };
  }
}

/**
 * Exporte l'historique des mouvements de stock au format CSV
 */
export async function exportMerchStockMovementsCsv() {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return { success: false, error: admin.error };

    const res = await getMerchStockMovements(500);
    if (!res.success || !res.data) {
      return { success: false, error: res.error || "Aucune donnée à exporter" };
    }

    const { MERCH_STOCK_MOVEMENT_LABELS } = await import("@/lib/boutique");
    const header = [
      "Date",
      "Produit",
      "Taille",
      "Couleur",
      "Type",
      "Quantité",
      "Stock avant",
      "Stock après",
      "Commande",
      "Motif",
      "Par",
    ];

    const escapeCsv = (value: string | number | null | undefined) => {
      const str = value == null ? "" : String(value);
      if (str.includes('"') || str.includes(";") || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = res.data.map((m) => [
      new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "short",
        timeStyle: "medium",
      }).format(new Date(m.createdAt)),
      m.productTitre,
      m.taille,
      m.couleur,
      MERCH_STOCK_MOVEMENT_LABELS[m.type] || m.type,
      m.quantite,
      m.stockAvant,
      m.stockApres,
      m.numeroCommande || "",
      m.motif || "",
      m.createdByName || "",
    ]);

    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(";")).join("\n");
    const filename = `mouvements-stock-boutique-${new Date().toISOString().slice(0, 10)}.csv`;

    return { success: true, data: { csv, filename } };
  } catch (error) {
    console.error("exportMerchStockMovementsCsv:", error);
    return { success: false, error: "Erreur lors de l'export CSV" };
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
        seuilAlerteStock: validated.seuilAlerteStock,
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
    const message = error instanceof Error ? error.message : "";
    if (message.includes("merch_products") || message.includes("does not exist")) {
      return {
        success: false,
        error: "Tables boutique absentes : exécutez « npx prisma migrate deploy » sur le serveur.",
      };
    }
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
          seuilAlerteStock: validated.seuilAlerteStock,
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
      const filePath = resolveMerchImageDiskPath(img.chemin);
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

    const filePath = resolveMerchImageDiskPath(image.chemin);
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
        items: orderItemsInclude,
        User: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: orders.map((o) => mapOrder(o)),
    };
  } catch (error) {
    console.error("getAllMerchOrders:", error);
    return { success: false, error: "Erreur lors du chargement des commandes" };
  }
}

/**
 * Détail d'une commande boutique (admin)
 */
export async function getMerchOrderById(orderId: string) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return { success: false, error: admin.error };

    const order = await db.merchOrder.findUnique({
      where: { id: orderId },
      include: {
        items: orderItemsInclude,
        User: { select: { id: true, name: true, email: true } },
      },
    });

    if (!order) return { success: false, error: "Commande introuvable" };

    return { success: true, data: mapOrder(order) };
  } catch (error) {
    console.error("getMerchOrderById:", error);
    return { success: false, error: "Erreur lors du chargement de la commande" };
  }
}

/**
 * Met à jour le suivi admin d'une commande (statut, paiement, livraison, clôture)
 */
export async function updateMerchOrderAdmin(data: z.infer<typeof UpdateOrderAdminSchema>) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return { success: false, error: admin.error };

    const validated = UpdateOrderAdminSchema.parse(data);
    const existing = await db.merchOrder.findUnique({ where: { id: validated.orderId } });
    if (!existing) return { success: false, error: "Commande introuvable" };

    const now = new Date();
    const updateData: {
      statut: MerchOrderStatus;
      statutPaiement: MerchPaymentStatus;
      referenceSuivi: string | null;
      notesAdmin: string | null;
      dateExpedition?: Date | null;
      dateCloture?: Date | null;
    } = {
      statut: validated.statut,
      statutPaiement: validated.statutPaiement,
      referenceSuivi: validated.referenceSuivi?.trim() || null,
      notesAdmin: validated.notesAdmin?.trim() || null,
    };

    if (validated.statut === MerchOrderStatus.Expediee && !existing.dateExpedition) {
      updateData.dateExpedition = now;
    }
    if (
      (validated.statut === MerchOrderStatus.Livree || validated.statut === MerchOrderStatus.Annulee) &&
      !existing.dateCloture
    ) {
      updateData.dateCloture = now;
    }
    if (validated.statut === MerchOrderStatus.EnAttente || validated.statut === MerchOrderStatus.Confirmee) {
      updateData.dateCloture = null;
    }

    const order = await db.merchOrder.update({
      where: { id: validated.orderId },
      data: updateData,
      include: {
        items: orderItemsInclude,
        User: { select: { id: true, name: true, email: true } },
      },
    });

    revalidatePath("/admin/boutique");

    return {
      success: true,
      message: "Commande mise à jour",
      data: mapOrder(order),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message || "Données invalides" };
    }
    console.error("updateMerchOrderAdmin:", error);
    return { success: false, error: "Erreur lors de la mise à jour de la commande" };
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

    const suiviToken = randomBytes(32).toString("hex");

    const stockAlerts: MerchStockAlertItem[] = [];

    const order = await db.$transaction(async (tx) => {
      for (const item of validated.items) {
        const variant = await tx.merchProductVariant.findUnique({
          where: { id: item.variantId },
          include: { Product: true },
        });
        if (!variant || variant.stock < item.quantite) {
          throw new Error("STOCK_INSUFFISANT");
        }

        const stockAvant = variant.stock;
        const stockApres = stockAvant - item.quantite;

        await tx.merchProductVariant.update({
          where: { id: item.variantId },
          data: { stock: stockApres },
        });

        const seuil = variant.Product.seuilAlerteStock ?? 5;
        const alertType = getMerchStockAlertType(stockAvant, stockApres, seuil);
        if (alertType) {
          stockAlerts.push({
            productTitre: variant.Product.titre,
            taille: variant.taille,
            couleur: variant.couleur,
            stockApres,
            seuilAlerte: seuil,
            alertType,
          });
        }
      }

      const created = await tx.merchOrder.create({
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
          suiviToken,
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

      for (const item of validated.items) {
        const variant = variantMap.get(item.variantId)!;
        const stockAvant = variant.stock;
        const stockApres = stockAvant - item.quantite;
        await recordMerchStockMovement(tx, {
          variantId: item.variantId,
          productId: variant.productId,
          type: MerchStockMovementType.Commande,
          quantite: -item.quantite,
          stockAvant,
          stockApres,
          orderId: created.id,
          motif: `Commande ${numeroCommande}`,
        });
      }

      return created;
    });

    if (stockAlerts.length > 0) {
      await notifyMerchStockAlerts(stockAlerts);
    }

    const trackingUrl = buildMerchOrderTrackingUrl(suiviToken);

    let emailSent = false;
    let emailError: string | null = null;
    try {
      const { sendMerchOrderConfirmationEmail } = await import("@/lib/mail");
      const emailResult = await sendMerchOrderConfirmationEmail({
        to: validated.email,
        nom: validated.nom,
        numeroCommande,
        montantTotal,
        lineItems,
        adresseLivraison: validated.adresseLivraison,
        ville: validated.ville,
        codePostal: validated.codePostal,
        pays: validated.pays || "France",
        trackingUrl,
        notes: validated.notes,
      });
      emailSent = emailResult.sent;
      emailError = emailResult.error || null;
    } catch (err) {
      emailError = err instanceof Error ? err.message : "Erreur d'envoi email";
    }

    const subject = `Confirmation de commande ${numeroCommande} — AMAKI France`;
    const linesHtml = lineItems
      .map(
        (li) =>
          `<li><strong>${li.productTitre}</strong> — ${li.taille} / ${li.couleur} × ${li.quantite} = ${li.sousTotal.toFixed(2)} €</li>`
      )
      .join("");
    const bodyHtml = `
      <p>Bonjour ${validated.nom},</p>
      <p>Commande ${numeroCommande} — Total ${montantTotal.toFixed(2)} €</p>
      <p><a href="${trackingUrl}">Suivre ma commande</a></p>
      <ul>${linesHtml}</ul>
    `;

    await db.merchOrder.update({
      where: { id: order.id },
      data: {
        confirmationEmailSubject: subject,
        confirmationEmailBody: bodyHtml,
        confirmationEmailSentAt: emailSent ? new Date() : null,
        confirmationEmailError: emailError,
      },
    });

    const historizeUserId =
      session?.user?.id ||
      (await db.user.findFirst({ where: { email: validated.email }, select: { id: true } }))?.id;

    if (historizeUserId) {
      const adminUser = await db.user.findFirst({ where: { role: "ADMIN" } });
      await db.email
        .create({
          data: {
            userId: historizeUserId,
            createdBy: adminUser?.id || historizeUserId,
            subject,
            body: bodyHtml,
            recipientEmail: validated.email,
            sent: emailSent,
            error: emailError,
          },
        })
        .catch((e) => console.error("Historisation email commande:", e));
    }

    if (!emailSent) {
      console.error("[createMerchOrder] Échec envoi email confirmation:", {
        to: validated.email,
        numeroCommande,
        error: emailError,
      });
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
        suiviToken,
        trackingUrl,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0]?.message || "Données invalides" };
    }
    if (error instanceof Error && error.message === "STOCK_INSUFFISANT") {
      return { success: false, error: "Stock insuffisant pour un article du panier" };
    }
    // Prisma: colonne manquante (base pas migrée)
    if ((error as any)?.code === "P2022") {
      const meta = (error as any)?.meta as { modelName?: string; column?: string } | undefined;
      const column = meta?.column || "une colonne requise";
      return {
        success: false,
        error: `La base de données n'est pas à jour (colonne manquante : ${column}). Exécutez « npx prisma migrate deploy » sur le serveur puis relancez l'application.`,
      };
    }
    console.error("createMerchOrder:", error);
    return { success: false, error: "Erreur lors de la création de la commande" };
  }
}

/**
 * Suivi public d'une commande via son jeton (lien email)
 */
export async function getPublicMerchOrderByToken(token: string) {
  try {
    const trimmed = token?.trim();
    if (!trimmed || trimmed.length < 16) {
      return { success: false, error: "Lien de suivi invalide" };
    }

    const order = await db.merchOrder.findFirst({
      where: { suiviToken: trimmed },
      include: { items: orderItemsInclude },
    });

    if (!order) {
      return { success: false, error: "Commande introuvable" };
    }

    const mapped = mapOrder(order);

    return {
      success: true,
      data: {
        numeroCommande: mapped.numeroCommande,
        nom: mapped.nom,
        email: mapped.email,
        statut: mapped.statut,
        statutPaiement: mapped.statutPaiement,
        montantTotal: mapped.montantTotal,
        adresseLivraison: mapped.adresseLivraison,
        ville: mapped.ville,
        codePostal: mapped.codePostal,
        pays: mapped.pays,
        referenceSuivi: mapped.referenceSuivi,
        dateExpedition: mapped.dateExpedition,
        dateCloture: mapped.dateCloture,
        createdAt: mapped.createdAt,
        updatedAt: mapped.updatedAt,
        items: mapped.items,
      },
    };
  } catch (error) {
    console.error("getPublicMerchOrderByToken:", error);
    return { success: false, error: "Erreur lors du chargement de la commande" };
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
