import { authenticatedFetch } from "@/auth/session";

export type MyDataDeletionRequestDto = {
  id: string;
  statut: string;
  createdAt: string;
};

/**
 * GET /api/v1/me/rgpd/data-deletion
 */
export async function getMyDataDeletionRequest(): Promise<MyDataDeletionRequestDto | null> {
  return authenticatedFetch<MyDataDeletionRequestDto | null>(
    "/api/v1/me/rgpd/data-deletion"
  );
}

/**
 * POST /api/v1/me/rgpd/data-deletion
 */
export async function submitMyDataDeletionRequest(
  message?: string
): Promise<{ id: string; statut: string }> {
  return authenticatedFetch<{ id: string; statut: string }>(
    "/api/v1/me/rgpd/data-deletion",
    {
      method: "POST",
      body: message ? { message } : {},
    }
  );
}
