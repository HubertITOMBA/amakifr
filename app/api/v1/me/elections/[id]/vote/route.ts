import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { submitMyVote } from "@/lib/services/elections/submit-my-vote";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const FORBIDDEN = [
  "userId",
  "adherentId",
  "electeurId",
  "voterId",
  "createdBy",
  "isEligible",
  "hasVoted",
  "override",
  "force",
] as const;

/**
 * POST /api/v1/me/elections/[id]/vote
 * Body: { votes: [{ positionId, candidacyId | null }] }
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

    const { id } = await context.params;
    const result = await submitMyVote(actor, id, {
      votes: Array.isArray(body.votes) ? (body.votes as any) : [],
    });
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
