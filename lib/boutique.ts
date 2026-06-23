/**
 * Utilitaires pour la boutique produits dérivés
 */

export interface MerchVariantInput {
  id?: string;
  taille: string;
  couleur: string;
  prix: number;
  stock: number;
  actif?: boolean;
}

export interface CartItem {
  variantId: string;
  productId: string;
  productTitre: string;
  productSlug: string;
  imageCover?: string | null;
  taille: string;
  couleur: string;
  prix: number;
  quantite: number;
}

export const CART_STORAGE_KEY = "amaki-merch-cart";

/**
 * Génère un slug URL à partir d'un titre
 */
export function slugifyMerchTitle(titre: string): string {
  return titre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "produit";
}

/**
 * Génère un numéro de commande unique
 */
export function generateMerchOrderNumber(): string {
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `CMD-${Date.now()}-${suffix}`;
}

/**
 * Formate un montant en euros (FR)
 */
export function formatMerchPrice(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(num);
}
