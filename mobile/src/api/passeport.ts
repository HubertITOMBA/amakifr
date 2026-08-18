import { authenticatedBinaryFetch, authenticatedFetch } from "@/auth/session";
import type { PasseportDto } from "@/api/types";

/**
 * GET /api/v1/me/passeport
 */
export async function getMyPasseport(): Promise<PasseportDto> {
  return authenticatedFetch<PasseportDto>("/api/v1/me/passeport");
}

/**
 * POST /api/v1/me/passeport/generate — génération explicite (idempotente).
 */
export async function generateMyPasseport(): Promise<PasseportDto> {
  return authenticatedFetch<PasseportDto>("/api/v1/me/passeport/generate", {
    method: "POST",
  });
}

/**
 * GET /api/v1/me/passeport/pdf — téléchargement binaire authentifié.
 */
export async function downloadMyPasseportPdf(): Promise<ArrayBuffer> {
  return authenticatedBinaryFetch("/api/v1/me/passeport/pdf", {
    accept: "application/pdf",
  });
}
