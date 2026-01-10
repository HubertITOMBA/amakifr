import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { readFile } from "fs/promises";
import { join } from "path";

/**
 * API route protégée pour télécharger les statuts de l'association
 * Accessible uniquement aux utilisateurs connectés (adhérents)
 * 
 * @returns Le fichier PDF des statuts ou une erreur 401 si non authentifié
 */
export async function GET() {
  try {
    // Vérifier l'authentification
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Vous devez être connecté pour télécharger les statuts" },
        { status: 401 }
      );
    }

    // Chemin vers le fichier PDF dans le dossier privé
    const filePath = join(process.cwd(), "private", "documents", "statut-amaki-france.pdf");

    // Lire le fichier
    const fileBuffer = await readFile(filePath);

    // Retourner le PDF avec les bons headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="statut-amaki-france.pdf"',
        "Cache-Control": "private, max-age=3600", // Cache pendant 1 heure
      },
    });
  } catch (error) {
    console.error("Erreur lors du téléchargement des statuts:", error);
    return NextResponse.json(
      { error: "Erreur lors du téléchargement du fichier" },
      { status: 500 }
    );
  }
}
