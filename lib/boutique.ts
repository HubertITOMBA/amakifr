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

/** Libellés français des statuts de commande */
export const MERCH_ORDER_STATUS_LABELS: Record<string, string> = {
  EnAttente: "En attente",
  Confirmee: "Confirmée",
  Expediee: "Expédiée",
  Livree: "Livrée / clôturée",
  Annulee: "Annulée",
};

/** Libellés français des statuts de paiement */
export const MERCH_PAYMENT_STATUS_LABELS: Record<string, string> = {
  EnAttente: "Paiement en attente",
  Recu: "Paiement reçu",
  Rembourse: "Remboursé",
};

/** Classes Tailwind pour les badges de statut commande */
export function getMerchOrderStatusBadgeClass(statut: string): string {
  switch (statut) {
    case "Confirmee":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200";
    case "Expediee":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200";
    case "Livree":
      return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200";
    case "Annulee":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
    default:
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  }
}

/** Classes Tailwind pour les badges de statut paiement */
export function getMerchPaymentStatusBadgeClass(statut: string): string {
  switch (statut) {
    case "Recu":
      return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200";
    case "Rembourse":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200";
    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
  }
}
