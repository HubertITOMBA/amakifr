import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { withdrawMyReunionHostProposal } from "@/lib/services/reunions/withdraw-my-reunion-host-proposal";

export const dynamic = "force-dynamic";

const FORBIDDEN_KEYS = [
  "userId",
  "adherentId",
  "hostId",
  "adherentHoteId",
  "force",
  "override",
  "isAdmin",
] as const;

/**
 * DELETE /api/v1/me/reunions/[id]/host-proposal — se désister comme hôte.
 * Identité via Bearer uniquement.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) {
      return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    }

    const query = request.nextUrl.searchParams;
    for (const key of FORBIDDEN_KEYS) {
      if (query.has(key)) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          `Paramètre ${key} non autorisé`
        );
      }
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      let raw: unknown = null;
      try {
        raw = await request.json();
      } catch {
        raw = null;
      }
      if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
        const body = raw as Record<string, unknown>;
        for (const key of FORBIDDEN_KEYS) {
          if (key in body) {
            throw new ServiceError(
              "VALIDATION_ERROR",
              `Champ ${key} non autorisé`
            );
          }
        }
      }
    }

    const { id: reunionId } = await params;
    const result = await withdrawMyReunionHostProposal(actor, reunionId);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
