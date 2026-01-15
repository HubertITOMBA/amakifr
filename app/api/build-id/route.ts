import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * API Route pour exposer le build ID actuel
 * Permet au client de vérifier si un nouveau build a été déployé
 */
export async function GET() {
  try {
    const buildIdPath = path.join(process.cwd(), 'public', 'build-id.json');
    
    if (!fs.existsSync(buildIdPath)) {
      // Si le fichier n'existe pas, retourner un build ID par défaut
      return NextResponse.json({
        buildId: 'unknown',
        timestamp: new Date().toISOString(),
        version: '0.1.0',
      });
    }

    const buildInfo = JSON.parse(fs.readFileSync(buildIdPath, 'utf-8'));
    
    return NextResponse.json(buildInfo, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du build ID:', error);
    return NextResponse.json({
      buildId: 'error',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    }, { status: 500 });
  }
}
