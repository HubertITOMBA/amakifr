"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { TypeActivite } from "@prisma/client";

/**
 * Interface pour les détails d'une activité
 */
export interface ActivityDetails {
  [key: string]: any;
}

/**
 * Enregistre une activité utilisateur dans la base de données
 * 
 * @param type - Type d'activité (Connexion, Creation, Modification, etc.)
 * @param action - Description de l'action (ex: "Création d'un événement")
 * @param entityType - Type d'entité concernée (ex: "Evenement", "User")
 * @param entityId - ID de l'entité concernée
 * @param details - Détails supplémentaires (optionnel)
 * @param success - Si l'action a réussi (défaut: true)
 * @param errorMessage - Message d'erreur si l'action a échoué (optionnel)
 * @param request - Objet Request Next.js pour récupérer IP et UserAgent (optionnel)
 */
export async function logUserActivity(
  type: TypeActivite,
  action: string,
  entityType?: string,
  entityId?: string,
  details?: ActivityDetails,
  success: boolean = true,
  errorMessage?: string,
  request?: { headers: Headers; url?: string }
): Promise<void> {
  try {
    // Récupérer la session utilisateur
    const session = await auth();
    
    // Si pas de session, on ne log pas (visiteur anonyme)
    if (!session?.user?.id) {
      return;
    }

    // Récupérer les informations de l'utilisateur
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
      },
    });

    // Récupérer IP et UserAgent depuis la requête si disponible
    let ipAddress: string | undefined;
    let userAgent: string | undefined;
    let url: string | undefined;

    if (request) {
      const forwarded = request.headers.get("x-forwarded-for");
      ipAddress = forwarded ? forwarded.split(",")[0].trim() : undefined;
      userAgent = request.headers.get("user-agent") || undefined;
      url = request.url;
    }

    // Vérifier que le modèle existe dans le client Prisma
    if (!('userActivity' in db)) {
      console.warn("⚠️ Le modèle userActivity n'est pas disponible. Veuillez redémarrer le serveur après la migration.");
      return;
    }

    // Enregistrer l'activité avec gestion d'erreur pour table inexistante
    try {
      await (db as any).userActivity.create({
      data: {
        userId: session.user.id,
        userName: user?.name || session.user.name || null,
        userEmail: user?.email || session.user.email || null,
        type,
        action,
        entityType: entityType || null,
        entityId: entityId || null,
        details: details ? JSON.parse(JSON.stringify(details)) : null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        url: url || null,
        success,
        errorMessage: errorMessage || null,
      },
    });
    } catch (dbError: any) {
      // Gérer l'erreur P2021 (table does not exist) gracieusement
      if (dbError?.code === 'P2021' || dbError?.message?.includes('does not exist')) {
        console.warn("⚠️ La table user_activities n'existe pas encore. Exécutez la migration Prisma.");
        return;
      }
      throw dbError; // Relancer les autres erreurs
    }
  } catch (error) {
    // Ne pas bloquer l'application si le logging échoue
    console.error("❌ Erreur lors de l'enregistrement de l'activité utilisateur:", error);
  }
}

/**
 * Helper pour logger une création
 */
export async function logCreation(
  action: string,
  entityType: string,
  entityId: string,
  details?: ActivityDetails,
  request?: { headers: Headers; url?: string }
): Promise<void> {
  return logUserActivity(
    TypeActivite.Creation,
    action,
    entityType,
    entityId,
    details,
    true,
    undefined,
    request
  );
}

/**
 * Helper pour logger une modification
 */
export async function logModification(
  action: string,
  entityType: string,
  entityId: string,
  details?: ActivityDetails,
  request?: { headers: Headers; url?: string }
): Promise<void> {
  return logUserActivity(
    TypeActivite.Modification,
    action,
    entityType,
    entityId,
    details,
    true,
    undefined,
    request
  );
}

/**
 * Helper pour logger une suppression
 */
export async function logDeletion(
  action: string,
  entityType: string,
  entityId: string,
  details?: ActivityDetails,
  request?: { headers: Headers; url?: string }
): Promise<void> {
  return logUserActivity(
    TypeActivite.Suppression,
    action,
    entityType,
    entityId,
    details,
    true,
    undefined,
    request
  );
}

/**
 * Helper pour logger une consultation
 */
export async function logConsultation(
  action: string,
  entityType?: string,
  entityId?: string,
  details?: ActivityDetails,
  request?: { headers: Headers; url?: string }
): Promise<void> {
  return logUserActivity(
    TypeActivite.Consultation,
    action,
    entityType,
    entityId,
    details,
    true,
    undefined,
    request
  );
}

/**
 * Helper pour logger un export
 */
export async function logExport(
  action: string,
  entityType?: string,
  details?: ActivityDetails,
  request?: { headers: Headers; url?: string }
): Promise<void> {
  return logUserActivity(
    TypeActivite.Export,
    action,
    entityType,
    undefined,
    details,
    true,
    undefined,
    request
  );
}

/**
 * Helper pour logger une erreur
 */
export async function logError(
  action: string,
  entityType: string,
  entityId: string,
  errorMessage: string,
  details?: ActivityDetails,
  request?: { headers: Headers; url?: string }
): Promise<void> {
  return logUserActivity(
    TypeActivite.Autre,
    action,
    entityType,
    entityId,
    details,
    false,
    errorMessage,
    request
  );
}
