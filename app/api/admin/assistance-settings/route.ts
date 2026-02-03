import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { UserRole, CategorieTypeCotisation } from "@prisma/client";

/**
 * GET /api/admin/assistance-settings
 * Retourne la liste PassAssistance + types cotisation Assistance en JSON brut.
 * Les dates createdAt/updatedAt sont envoyées en chaînes ISO pour éviter tout souci de sérialisation.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
    }

    const passAssistances = await db.passAssistance.findMany({
      where: {
        TypeCotisationMensuelle: {
          categorie: CategorieTypeCotisation.Assistance,
        },
      },
      select: {
        id: true,
        description: true,
        montant: true,
        typeCotisationId: true,
        createdAt: true,
        updatedAt: true,
        TypeCotisationMensuelle: {
          select: { id: true, nom: true, categorie: true, actif: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const typesCotisationAssistance = await db.typeCotisationMensuelle.findMany({
      where: { categorie: CategorieTypeCotisation.Assistance, actif: true },
      select: { id: true, nom: true },
      orderBy: { nom: "asc" },
    });

    const passAssistancesJson = passAssistances.map((p) => ({
      id: p.id,
      description: p.description,
      montant: Number(p.montant),
      typeCotisationId: p.typeCotisationId,
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt ?? ""),
      updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : String(p.updatedAt ?? ""),
      TypeCotisationMensuelle: p.TypeCotisationMensuelle
        ? {
            id: p.TypeCotisationMensuelle.id,
            nom: p.TypeCotisationMensuelle.nom,
            categorie: p.TypeCotisationMensuelle.categorie,
            actif: p.TypeCotisationMensuelle.actif,
          }
        : null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        passAssistances: passAssistancesJson,
        typesCotisationAssistance,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/assistance-settings:", error);
    return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
  }
}
