/**
 * Validation avancée des fichiers uploadés
 * Vérifie le contenu réel des fichiers (magic bytes) pour éviter les uploads malveillants
 */

import { fileTypeFromBuffer } from 'file-type';

/**
 * Mapping des types MIME vers les extensions et magic bytes attendus
 */
const mimeTypeMap: Record<string, {
  extensions: string[];
  mimeTypes: string[];
}> = {
  'image/jpeg': {
    extensions: ['.jpg', '.jpeg'],
    mimeTypes: ['image/jpeg'],
  },
  'image/png': {
    extensions: ['.png'],
    mimeTypes: ['image/png'],
  },
  'image/gif': {
    extensions: ['.gif'],
    mimeTypes: ['image/gif'],
  },
  'image/webp': {
    extensions: ['.webp'],
    mimeTypes: ['image/webp'],
  },
  'image/bmp': {
    extensions: ['.bmp'],
    mimeTypes: ['image/bmp'],
  },
  'image/tiff': {
    extensions: ['.tiff', '.tif'],
    mimeTypes: ['image/tiff'],
  },
  'video/mp4': {
    extensions: ['.mp4'],
    mimeTypes: ['video/mp4'],
  },
  'video/quicktime': {
    extensions: ['.mov'],
    mimeTypes: ['video/quicktime'],
  },
  'video/x-msvideo': {
    extensions: ['.avi'],
    mimeTypes: ['video/x-msvideo'],
  },
  'application/pdf': {
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
  },
  'application/vnd.ms-excel': {
    extensions: ['.xls'],
    mimeTypes: ['application/vnd.ms-excel'],
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    extensions: ['.xlsx'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  },
  'application/msword': {
    extensions: ['.doc'],
    mimeTypes: ['application/msword'],
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    extensions: ['.docx'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  },
};

/**
 * Valide le contenu réel d'un fichier en vérifiant ses magic bytes
 * 
 * @param buffer - Le contenu du fichier en Buffer
 * @param expectedMimeType - Le type MIME attendu (déclaré par le client)
 * @param fileName - Le nom du fichier (pour vérifier l'extension)
 * @returns true si le fichier est valide, false sinon
 */
export async function validateFileContent(
  buffer: Buffer,
  expectedMimeType: string,
  fileName: string
): Promise<{ valid: boolean; detectedMimeType?: string; error?: string }> {
  try {
    // Vérifier que le buffer n'est pas vide
    if (buffer.length === 0) {
      return { valid: false, error: 'Le fichier est vide' };
    }
    
    // Détecter le type réel du fichier via magic bytes
    const detectedType = await detectFileType(buffer);
    
    if (!detectedType) {
      // Certains types de fichiers ne sont pas détectables (ex: .txt, .csv)
      // Pour les types non détectables, on accepte si l'extension correspond
      const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
      const mimeInfo = mimeTypeMap[expectedMimeType];
      
      if (mimeInfo && mimeInfo.extensions.includes(extension)) {
        return { valid: true };
      }
      
      return {
        valid: false,
        error: 'Impossible de détecter le type de fichier. Le fichier peut être corrompu ou malveillant.',
      };
    }
    
    // Vérifier que le type détecté correspond au type attendu
    const mimeInfo = mimeTypeMap[expectedMimeType];
    
    if (!mimeInfo) {
      // Type MIME non supporté
      return {
        valid: false,
        error: `Type MIME non supporté: ${expectedMimeType}`,
      };
    }
    
    // Vérifier que le type détecté est dans la liste des types acceptés
    if (!mimeInfo.mimeTypes.includes(detectedType.mime)) {
      return {
        valid: false,
        detectedMimeType: detectedType.mime,
        error: `Type de fichier non correspondant. Attendu: ${expectedMimeType}, Détecté: ${detectedType.mime}. Le fichier peut être malveillant.`,
      };
    }
    
    // Vérifier que l'extension correspond au type détecté
    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    if (!mimeInfo.extensions.includes(extension)) {
      return {
        valid: false,
        error: `Extension de fichier non correspondante. Extension: ${extension}, Type détecté: ${detectedType.mime}`,
      };
    }
    
    return { valid: true, detectedMimeType: detectedType.mime };
  } catch (error) {
    console.error('Erreur lors de la validation du fichier:', error);
    return {
      valid: false,
      error: `Erreur lors de la validation: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
    };
  }
}

/**
 * Valide la taille d'un fichier
 */
export function validateFileSize(
  size: number,
  maxSize: number,
  type: 'image' | 'video' | 'document' = 'document'
): { valid: boolean; error?: string } {
  if (size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
    const sizeMB = (size / (1024 * 1024)).toFixed(2);
    
    return {
      valid: false,
      error: `Fichier trop volumineux. Taille: ${sizeMB} MB, Maximum: ${maxSizeMB} MB`,
    };
  }
  
  if (size === 0) {
    return {
      valid: false,
      error: 'Le fichier est vide',
    };
  }
  
  return { valid: true };
}

/**
 * Liste des types MIME autorisés
 */
export const allowedMimeTypes = {
  images: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/tiff',
  ],
  videos: [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
  ],
  documents: [
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
} as const;

/**
 * Vérifie si un type MIME est autorisé
 */
export function isMimeTypeAllowed(
  mimeType: string,
  category: 'images' | 'videos' | 'documents' | 'all' = 'all'
): boolean {
  if (category === 'all') {
    return [
      ...allowedMimeTypes.images,
      ...allowedMimeTypes.videos,
      ...allowedMimeTypes.documents,
    ].includes(mimeType);
  }
  
  return allowedMimeTypes[category].includes(mimeType as any);
}

