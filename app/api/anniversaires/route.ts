import { NextResponse } from "next/server";
import { getAnniversairesData } from "@/lib/anniversaires";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Non autorisé", spotlight: [], prochains: [] },
        { status: 401 }
      );
    }
    const data = await getAnniversairesData(8);
    return NextResponse.json({
      success: true,
      spotlight: data.spotlight,
      prochains: data.prochains,
    });
  } catch (error) {
    console.error("Erreur API anniversaires:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Impossible de charger les anniversaires",
        spotlight: [],
        prochains: [],
      },
      { status: 500 }
    );
  }
}
