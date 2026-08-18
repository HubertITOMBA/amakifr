import { NextResponse, type NextRequest } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ServiceError } from "@/lib/service-error";
import { getMyPasseportPdf } from "@/lib/services/passeport/get-my-passeport-pdf";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me/passeport/pdf — PDF binaire (sans effet de bord sur le numéro).
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) {
      return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    }

    const params = request.nextUrl.searchParams;
    if (params.has("adherentId") || params.has("userId")) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        "Paramètres userId et adherentId non autorisés"
      );
    }

    const { buffer, filename } = await getMyPasseportPdf(actor);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
