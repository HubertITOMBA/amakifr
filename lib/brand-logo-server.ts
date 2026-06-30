import { existsSync, readFileSync } from "fs";
import { join } from "path";

import { BRAND_LOGO_RELATIVE_PATH } from "@/lib/brand-logo";

/**
 * Résout le chemin disque du logo officiel AMAKI
 */
export function resolveBrandLogoPath(cwd = process.cwd()): string | null {
  const candidates = [
    join(cwd, "public", BRAND_LOGO_RELATIVE_PATH),
    join(__dirname, "..", "public", BRAND_LOGO_RELATIVE_PATH),
    join(cwd, ".next", "standalone", "public", BRAND_LOGO_RELATIVE_PATH),
    `/sites/amakifr/public/${BRAND_LOGO_RELATIVE_PATH}`,
  ];

  for (const logoPath of candidates) {
    if (existsSync(logoPath)) {
      return logoPath;
    }
  }

  return null;
}

/**
 * Lit le logo en base64 (sans préfixe data URI) pour les PDF
 */
export function readBrandLogoBase64(): string {
  const logoPath = resolveBrandLogoPath();
  if (!logoPath) return "";

  try {
    return readFileSync(logoPath).toString("base64");
  } catch (error) {
    console.error("Erreur lors du chargement du logo:", error);
    return "";
  }
}

/**
 * Lit le logo en data URI pour les emails HTML
 */
export function readBrandLogoDataUrl(): string {
  const base64 = readBrandLogoBase64();
  return base64 ? `data:image/jpeg;base64,${base64}` : "";
}
