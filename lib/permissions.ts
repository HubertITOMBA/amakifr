/**
 * Système de permissions par rôle
 * 
 * Ce fichier définit les permissions pour chaque rôle d'administration.
 * Les permissions sont organisées par domaine fonctionnel.
 */

import { AdminRole } from "@prisma/client";

/**
 * Types de permissions disponibles
 */
export type Permission = 
  | "users.view"
  | "users.edit"
  | "users.delete"
  | "users.roles.manage"
  | "adherents.view"
  | "adherents.edit"
  | "adherents.delete"
  | "depenses.view"
  | "depenses.create"
  | "depenses.edit"
  | "depenses.validate"
  | "depenses.delete"
  | "cotisations.view"
  | "cotisations.create"
  | "cotisations.edit"
  | "cotisations.delete"
  | "finances.view"
  | "finances.edit"
  | "finances.delete"
  | "documents.view"
  | "documents.create"
  | "documents.edit"
  | "documents.delete"
  | "evenements.view"
  | "evenements.create"
  | "evenements.edit"
  | "evenements.delete"
  | "elections.view"
  | "elections.create"
  | "elections.edit"
  | "elections.delete"
  | "projets.view"
  | "projets.create"
  | "projets.edit"
  | "projets.delete"
  | "menus.view"
  | "menus.create"
  | "menus.edit"
  | "menus.delete"
  | "settings.view"
  | "settings.edit"
  | "profile.edit"; // Permission pour modifier son propre profil

/**
 * Définition des permissions par rôle
 */
const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  ADMIN: [
    // ADMIN a tous les droits
    "users.view",
    "users.edit",
    "users.delete",
    "users.roles.manage",
    "adherents.view",
    "adherents.edit",
    "adherents.delete",
    "depenses.view",
    "depenses.create",
    "depenses.edit",
    "depenses.validate",
    "depenses.delete",
    "cotisations.view",
    "cotisations.create",
    "cotisations.edit",
    "cotisations.delete",
    "finances.view",
    "finances.edit",
    "finances.delete",
    "documents.view",
    "documents.create",
    "documents.edit",
    "documents.delete",
    "evenements.view",
    "evenements.create",
    "evenements.edit",
    "evenements.delete",
    "elections.view",
    "elections.create",
    "elections.edit",
    "elections.delete",
    "projets.view",
    "projets.create",
    "projets.edit",
    "projets.delete",
    "menus.view",
    "menus.create",
    "menus.edit",
    "menus.delete",
    "settings.view",
    "settings.edit",
    "profile.edit",
  ],
  PRESID: [
    // Président : peut tout voir mais ne peut pas tout modifier
    "users.view",
    "adherents.view",
    "adherents.edit",
    "depenses.view",
    "depenses.validate",
    "cotisations.view",
    "cotisations.edit",
    "finances.view",
    "documents.view",
    "documents.create",
    "documents.edit",
    "evenements.view",
    "evenements.create",
    "evenements.edit",
    "elections.view",
    "elections.create",
    "elections.edit",
    "projets.view",
    "projets.create",
    "projets.edit",
    "menus.view",
    "settings.view",
    "profile.edit",
  ],
  VICEPR: [
    // Vice-Président : peut tout voir mais ne peut pas tout modifier
    "users.view",
    "adherents.view",
    "adherents.edit",
    "depenses.view",
    "depenses.validate",
    "cotisations.view",
    "cotisations.edit",
    "finances.view",
    "documents.view",
    "documents.create",
    "documents.edit",
    "evenements.view",
    "evenements.create",
    "evenements.edit",
    "elections.view",
    "elections.create",
    "elections.edit",
    "projets.view",
    "projets.create",
    "projets.edit",
    "menus.view",
    "settings.view",
    "profile.edit",
  ],
  SECRET: [
    // Secrétaire : peut tout voir mais ne peut pas tout modifier
    "users.view",
    "adherents.view",
    "adherents.edit",
    "depenses.view",
    "cotisations.view",
    "cotisations.create",
    "cotisations.edit",
    "finances.view",
    "documents.view",
    "documents.create",
    "documents.edit",
    "evenements.view",
    "evenements.create",
    "evenements.edit",
    "elections.view",
    "elections.create",
    "elections.edit",
    "projets.view",
    "projets.create",
    "projets.edit",
    "menus.view",
    "settings.view",
    "profile.edit",
  ],
  VICESE: [
    // Vice-Secrétaire : peut tout voir mais ne peut pas tout modifier
    "users.view",
    "adherents.view",
    "adherents.edit",
    "depenses.view",
    "cotisations.view",
    "cotisations.create",
    "cotisations.edit",
    "finances.view",
    "documents.view",
    "documents.create",
    "documents.edit",
    "evenements.view",
    "evenements.create",
    "evenements.edit",
    "elections.view",
    "elections.create",
    "elections.edit",
    "projets.view",
    "projets.create",
    "projets.edit",
    "menus.view",
    "settings.view",
    "profile.edit",
  ],
  COMCPT: [
    // Comptable/Trésorier : peut tout voir mais ne peut pas tout modifier
    "users.view",
    "adherents.view",
    "depenses.view",
    "depenses.create",
    "depenses.validate",
    "cotisations.view",
    "cotisations.create",
    "cotisations.edit",
    "finances.view",
    "finances.edit",
    "documents.view",
    "documents.create",
    "documents.edit",
    "evenements.view",
    "projets.view",
    "menus.view",
    "settings.view",
    "profile.edit",
  ],
};

/**
 * Vérifie si un rôle a une permission spécifique
 * 
 * @param role - Le rôle à vérifier
 * @param permission - La permission à vérifier
 * @returns true si le rôle a la permission, false sinon
 */
export function roleHasPermission(role: AdminRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Vérifie si un utilisateur avec plusieurs rôles a une permission
 * 
 * @param roles - Les rôles de l'utilisateur
 * @param permission - La permission à vérifier
 * @returns true si au moins un rôle a la permission, false sinon
 */
export function userHasPermission(roles: AdminRole[], permission: Permission): boolean {
  return roles.some(role => roleHasPermission(role, permission));
}

/**
 * Vérifie si un utilisateur peut voir une ressource
 * 
 * @param roles - Les rôles de l'utilisateur
 * @param resource - Le type de ressource (ex: "users", "depenses", etc.)
 * @returns true si l'utilisateur peut voir la ressource
 */
export function canView(roles: AdminRole[], resource: string): boolean {
  return userHasPermission(roles, `${resource}.view` as Permission);
}

/**
 * Vérifie si un utilisateur peut modifier une ressource
 * 
 * @param roles - Les rôles de l'utilisateur
 * @param resource - Le type de ressource (ex: "users", "depenses", etc.)
 * @returns true si l'utilisateur peut modifier la ressource
 */
export function canEdit(roles: AdminRole[], resource: string): boolean {
  return userHasPermission(roles, `${resource}.edit` as Permission);
}

/**
 * Vérifie si un utilisateur peut créer une ressource
 * 
 * @param roles - Les rôles de l'utilisateur
 * @param resource - Le type de ressource (ex: "users", "depenses", etc.)
 * @returns true si l'utilisateur peut créer la ressource
 */
export function canCreate(roles: AdminRole[], resource: string): boolean {
  return userHasPermission(roles, `${resource}.create` as Permission);
}

/**
 * Vérifie si un utilisateur peut supprimer une ressource
 * 
 * @param roles - Les rôles de l'utilisateur
 * @param resource - Le type de ressource (ex: "users", "depenses", etc.)
 * @returns true si l'utilisateur peut supprimer la ressource
 */
export function canDelete(roles: AdminRole[], resource: string): boolean {
  return userHasPermission(roles, `${resource}.delete` as Permission);
}

/**
 * Vérifie si un utilisateur a un rôle spécifique
 * 
 * @param roles - Les rôles de l'utilisateur
 * @param role - Le rôle à vérifier
 * @returns true si l'utilisateur a le rôle
 */
export function hasRole(roles: AdminRole[], role: AdminRole): boolean {
  return roles.includes(role);
}

/**
 * Vérifie si un utilisateur est administrateur
 * 
 * @param roles - Les rôles de l'utilisateur
 * @returns true si l'utilisateur est admin
 */
export function isAdmin(roles: AdminRole[]): boolean {
  return hasRole(roles, AdminRole.ADMIN);
}

/**
 * Obtient toutes les permissions d'un utilisateur basées sur ses rôles
 * 
 * @param roles - Les rôles de l'utilisateur
 * @returns Un tableau de toutes les permissions uniques
 */
export function getUserPermissions(roles: AdminRole[]): Permission[] {
  const permissions = new Set<Permission>();
  
  roles.forEach(role => {
    ROLE_PERMISSIONS[role]?.forEach(permission => {
      permissions.add(permission);
    });
  });
  
  return Array.from(permissions);
}

/**
 * Libellés des rôles pour l'affichage
 */
export const ROLE_LABELS: Record<AdminRole, string> = {
  ADMIN: "Administrateur",
  PRESID: "Président",
  VICEPR: "Vice-Président",
  SECRET: "Secrétaire",
  VICESE: "Vice-Secrétaire",
  COMCPT: "Comptable/Trésorier",
};

/**
 * Descriptions des rôles
 */
export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  ADMIN: "A tous les droits sur l'application",
  PRESID: "Peut tout voir mais ne peut pas tout modifier",
  VICEPR: "Peut tout voir mais ne peut pas tout modifier",
  SECRET: "Peut tout voir mais ne peut pas tout modifier",
  VICESE: "Peut tout voir mais ne peut pas tout modifier",
  COMCPT: "Peut tout voir mais ne peut pas tout modifier. Accès privilégié aux finances.",
};
