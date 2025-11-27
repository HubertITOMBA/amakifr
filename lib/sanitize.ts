/**
 * Utilitaires de sanitization pour la protection XSS
 */

import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitise du HTML pour prévenir les attaques XSS
 * 
 * @param html - Le contenu HTML à sanitiser
 * @param options - Options de configuration DOMPurify
 * @returns Le HTML sanitisé
 */
export function sanitizeHtml(
  html: string,
  options?: {
    allowImages?: boolean;
    allowLinks?: boolean;
    allowTables?: boolean;
  }
): string {
  const config: DOMPurify.Config = {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
    ],
    ALLOWED_ATTR: [],
  };
  
  if (options?.allowImages) {
    config.ALLOWED_TAGS!.push('img');
    config.ALLOWED_ATTR!.push('src', 'alt', 'title');
  }
  
  if (options?.allowLinks) {
    config.ALLOWED_TAGS!.push('a');
    config.ALLOWED_ATTR!.push('href', 'title', 'target', 'rel');
    // Forcer les liens externes à s'ouvrir dans un nouvel onglet avec noopener
    config.ADD_ATTR = ['target'];
    config.ADD_TAGS = ['a'];
  }
  
  if (options?.allowTables) {
    config.ALLOWED_TAGS!.push('table', 'thead', 'tbody', 'tr', 'th', 'td');
    config.ALLOWED_ATTR!.push('colspan', 'rowspan');
  }
  
  return DOMPurify.sanitize(html, config);
}

/**
 * Sanitise du texte brut (échappe les caractères HTML)
 * 
 * @param text - Le texte à échapper
 * @returns Le texte échappé
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Sanitise une URL pour prévenir les attaques (javascript:, data:, etc.)
 * 
 * @param url - L'URL à valider
 * @returns L'URL sanitée ou null si invalide
 */
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url, window.location.origin);
    
    // Bloquer les protocoles dangereux
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
    if (dangerousProtocols.includes(parsed.protocol.toLowerCase())) {
      return null;
    }
    
    // Autoriser seulement http, https, et les protocoles spéciaux autorisés
    const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
    if (!allowedProtocols.includes(parsed.protocol.toLowerCase())) {
      return null;
    }
    
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Sanitise un objet contenant potentiellement du HTML
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  fieldsToSanitize: (keyof T)[]
): T {
  const sanitized = { ...obj };
  
  for (const field of fieldsToSanitize) {
    if (typeof sanitized[field] === 'string') {
      sanitized[field] = sanitizeHtml(sanitized[field] as string) as T[keyof T];
    }
  }
  
  return sanitized;
}

