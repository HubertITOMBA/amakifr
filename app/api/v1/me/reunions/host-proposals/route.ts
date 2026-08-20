import type { NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { proposeMyselfAsReunionHost } from "@/lib/services/reunions/propose-myself-as-reunion-host";

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
 * POST /api/v1/me/reunions/host-proposals — se proposer comme hôte d'un mois.
 * Identité via Bearer uniquement.
 */
export async function POST(request: NextRequest) {
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

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw new ServiceError("VALIDATION_ERROR", "Corps JSON invalide");
    }

    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      throw new ServiceError("VALIDATION_ERROR", "Corps JSON invalide");
    }

    const body = raw as Record<string, unknown>;
    for (const key of FORBIDDEN_KEYS) {
      if (key in body) {
        throw new ServiceError(
          "VALIDATION_ERROR",
          `Champ ${key} non autorisé`
        );
      }
    }

    if (typeof body.annee !== "number" || typeof body.mois !== "number") {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "annee et mois sont requis (nombres)"
      );
    }

    const result = await proposeMyselfAsReunionHost(actor, {
      annee: body.annee,
      mois: body.mois,
    });

    return apiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
