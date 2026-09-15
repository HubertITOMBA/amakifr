import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isNotesFraisEnabled } from "@/lib/frais-avances/feature-flag";
import { downloadNoteFraisJustificatif } from "@/lib/services/frais-avances/note-frais-service";

/**
 * Téléchargement Web authentifié d'une pièce READY (propriétaire ou responsable).
 * Aucun chemin de stockage dans la réponse.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isNotesFraisEnabled()) {
    return NextResponse.json(
      { error: "Le module frais avancés n'est pas activé." },
      { status: 403 }
    );
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await downloadNoteFraisJustificatif({
    userId,
    justificatifId: id,
  });

  if (!result.success) {
    const status =
      result.error === "Pièce jointe introuvable" ||
      result.error === "Note introuvable"
        ? 404
        : result.code === "NOTES_FRAIS_DISABLED"
          ? 403
          : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  const safeName = result.data.downloadName.replace(/[^\w.\- ()àâäéèêëïîôùûüç]/gi, "_");
  return new NextResponse(new Uint8Array(result.data.bytes), {
    status: 200,
    headers: {
      "Content-Type": result.data.contentType,
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
