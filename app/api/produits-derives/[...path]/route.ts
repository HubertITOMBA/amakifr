import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

/**
 * Sert les images produits dérivés stockées dans public/produits-derives/
 * (chemins historiques /produits-derives/*)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const filePath = params.path.join("/");

    if (filePath.includes("..") || filePath.startsWith("/")) {
      return NextResponse.json({ error: "Chemin invalide" }, { status: 400 });
    }

    const fullPath = join(process.cwd(), "public", "produits-derives", filePath);

    if (!existsSync(fullPath)) {
      return NextResponse.json({ error: "Fichier non trouvé" }, { status: 404 });
    }

    const fileBuffer = await readFile(fullPath);
    const extension = filePath.split(".").pop()?.toLowerCase();
    const contentType = MIME_TYPES[extension || ""] || "application/octet-stream";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Erreur lecture image produit dérivé:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
