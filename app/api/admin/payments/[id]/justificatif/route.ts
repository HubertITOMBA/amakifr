import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { AuthContext } from "@/lib/auth-context";
import { handleApiError } from "@/lib/api/errors";
import { getPaymentJustificatifForAdmin } from "@/lib/services/paiements/get-payment-justificatif";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/payments/[id]/justificatif
 * Téléchargement sécurisé du justificatif (admin finances).
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHENTICATED", message: "Non authentifié" },
        },
        { status: 401 }
      );
    }

    const actor: AuthContext = {
      userId: session.user.id,
      role: (session.user as { role?: string }).role ?? "MEMBRE",
      status: "Actif",
      email: session.user.email ?? "",
      name: session.user.name ?? null,
      sessionId: null,
      adminRoles: [],
      adherentId: null,
      channel: "web",
    };

    const { id } = await params;
    const file = await getPaymentJustificatifForAdmin(actor, id);

    return new NextResponse(new Uint8Array(file.bytes), {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `inline; filename="${file.downloadName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
