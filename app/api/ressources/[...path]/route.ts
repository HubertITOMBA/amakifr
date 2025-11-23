import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * Route API pour servir les fichiers statiques uploadés
 * Permet d'accéder aux fichiers dans /public/ressources/* en production
 * 
 * Exemple d'utilisation:
 * - /api/ressources/evenements/image.jpg
 * - /api/ressources/documents/doc.pdf
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    // Reconstruire le chemin du fichier
    const filePath = params.path.join('/');
    
    // Sécuriser le chemin pour éviter les accès non autorisés (path traversal)
    if (filePath.includes('..') || filePath.startsWith('/')) {
      return NextResponse.json(
        { error: 'Chemin invalide' },
        { status: 400 }
      );
    }

    // Chemin complet vers le fichier
    const fullPath = join(process.cwd(), 'public', 'ressources', filePath);

    // Vérifier que le fichier existe
    if (!existsSync(fullPath)) {
      return NextResponse.json(
        { error: 'Fichier non trouvé' },
        { status: 404 }
      );
    }

    // Lire le fichier
    const fileBuffer = await readFile(fullPath);

    // Déterminer le type MIME basé sur l'extension
    const extension = filePath.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'mp4': 'video/mp4',
      'mov': 'video/quicktime',
      'avi': 'video/x-msvideo',
      'webm': 'video/webm',
      'mkv': 'video/x-matroska',
      'txt': 'text/plain',
      'json': 'application/json',
    };

    const contentType = mimeTypes[extension || ''] || 'application/octet-stream';

    // Retourner le fichier avec les headers appropriés
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache pour 1 an
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Erreur lors de la lecture du fichier:', error);
    return NextResponse.json(
      { error: 'Erreur serveur lors de la lecture du fichier' },
      { status: 500 }
    );
  }
}

