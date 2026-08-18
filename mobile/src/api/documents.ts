import { authenticatedFetch } from "@/auth/session";
import type { DocumentDto } from "@/api/types";

/**
 * GET /api/v1/me/documents
 * Self-service : aucun userId / adherentId client.
 */
export async function getMyDocuments(): Promise<DocumentDto[]> {
  return authenticatedFetch<DocumentDto[]>("/api/v1/me/documents");
}
