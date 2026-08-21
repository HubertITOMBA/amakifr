import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { getMyDocumentFile } from "@/lib/services/documents/get-my-document-file";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/me/documents/[id]/file — téléchargement authentifié (ownership).
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const actor = await resolveApiActor(_request);
    if (!actor) {
      return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    }

    const { id } = await context.params;
    const file = await getMyDocumentFile(actor, id);

    const disposition = `inline; filename="${encodeURIComponent(file.downloadName)}"`;

    return new NextResponse(new Uint8Array(file.bytes), {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": disposition,
        "Cache-Control": "private, no-store",
        "Content-Length": String(file.bytes.length),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
