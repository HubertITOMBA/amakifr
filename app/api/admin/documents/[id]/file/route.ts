import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { resolveApiActor } from "@/lib/api/auth-resolve";
import { apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { authorize } from "@/lib/authorize";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/service-error";
import { resolveDocumentAbsolutePath } from "@/lib/services/documents/resolve-document-path";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/documents/[id]/file — téléchargement admin (tous documents).
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const actor = await resolveApiActor(request);
    if (!actor) {
      return apiError("UNAUTHENTICATED", "Non authentifié", 401);
    }

    await authorize({
      actor,
      permissionKey: "getAllDocuments",
      type: "READ",
    });

    const { id } = await context.params;
    const docId = String(id ?? "").trim();
    if (!docId || docId.includes("..")) {
      throw new ServiceError("VALIDATION_ERROR", "Identifiant invalide");
    }

    const document = await db.document.findUnique({
      where: { id: docId },
      select: { chemin: true, mimeType: true, nomOriginal: true },
    });
    if (!document) throw new ServiceError("NOT_FOUND", "Document introuvable");

    const abs = resolveDocumentAbsolutePath(document.chemin);
    const bytes = await readFile(abs);

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": document.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(document.nomOriginal)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
