import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import {
  submitMyCandidacy,
  withdrawMyCandidacy,
} from "@/lib/services/elections/submit-my-candidacy";

export const dynamic = "force-dynamic";

type Ctx = {
  params: Promise<{ id: string; positionId: string }>;
};

const FORBIDDEN = [
  "userId",
  "adherentId",
  "candidateId",
  "candidacyId",
  "createdBy",
  "status",
  "validated",
  "override",
  "force",
  "isEligible",
] as const;

/**
 * POST /api/v1/me/elections/[id]/positions/[positionId]/candidacy
 * Body: { motivation, programme }
 */
export async function POST(request: NextRequest, context: Ctx) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) return apiError("UNAUTHENTICATED", "Non authentifié", 401);

    for (const key of FORBIDDEN) {
      if (request.nextUrl.searchParams.has(key)) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          `Paramètre ${key} non autorisé`
        );
      }
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    for (const key of FORBIDDEN) {
      if (key in body) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          `Champ ${key} non autorisé`
        );
      }
    }

    const { id, positionId } = await context.params;
    const result = await submitMyCandidacy(actor, id, positionId, {
      motivation: typeof body.motivation === "string" ? body.motivation : "",
      programme: typeof body.programme === "string" ? body.programme : "",
    });
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/v1/me/elections/[id]/positions/[positionId]/candidacy
 * Retrait (hard delete) de la candidature self.
 */
export async function DELETE(request: NextRequest, context: Ctx) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) return apiError("UNAUTHENTICATED", "Non authentifié", 401);

    const { id, positionId } = await context.params;
    const result = await withdrawMyCandidacy(actor, id, positionId);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
