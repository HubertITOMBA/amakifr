"use client";

import { useState, useEffect } from "react";
import { getMenusByNiveau } from "@/actions/menus";

export interface DynamicMenu {
  id: string;
  libelle: string;
  description: string | null;
  lien: string;
  niveau: "NAVBAR" | "SIDEBAR";
  roles: string[];
  icone: string | null;
  statut: boolean;
  ordre: number;
  parent: string | null;
  electoral: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Hook pour charger les menus dynamiques depuis la base de données
 * 
 * @param niveau - Le niveau du menu (NAVBAR ou SIDEBAR)
 * @param userRoles - Les rôles de l'utilisateur
 * @returns Les menus filtrés et l'état de chargement
 */
export function useDynamicMenus(niveau: "NAVBAR" | "SIDEBAR", userRoles: string[] = ["VISITEUR"]) {
  const [menus, setMenus] = useState<DynamicMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMenus = async () => {
      try {
        setLoading(true);
        const result = await getMenusByNiveau(niveau, userRoles);
        
        if (result.success && result.data) {
          setMenus(result.data as DynamicMenu[]);
          setError(null);
        } else {
          // Ne pas afficher d'erreur à l'utilisateur - simplement retourner un tableau vide
          // L'utilisateur n'a pas besoin de savoir qu'il n'est pas autorisé à voir certains menus
          console.warn("[useDynamicMenus] Erreur lors du chargement des menus:", result.error);
          setMenus([]);
          setError(null);
        }
      } catch (err) {
        console.error("Erreur lors du chargement des menus:", err);
        // Ne pas afficher d'erreur à l'utilisateur - simplement retourner un tableau vide
        setMenus([]);
        setError(null);
      } finally {
        setLoading(false);
      }
    };

    loadMenus();
  }, [niveau, userRoles.join(",")]);

  return { menus, loading, error };
}

/**
 * Convertit les rôles utilisateur vers les rôles de menu
 * 
 * @param userRole - Le rôle utilisateur (ADMIN, MEMBRE, INVITE)
 * @param isAuthenticated - Si l'utilisateur est connecté
 * @param adminRoles - Les rôles d'administration de l'utilisateur (AdminRole[])
 * @returns Les rôles de menu correspondants
 */
export function getUserMenuRoles(
  userRole?: string, 
  isAuthenticated?: boolean, 
  adminRoles: string[] = []
): string[] {
  const roles: string[] = ["VISITEUR"]; // Rôle par défaut

  if (!isAuthenticated) {
    return roles;
  }

  // Tous les utilisateurs connectés ont au moins le rôle MEMBRE
  roles.push("MEMBRE");

  // Mapper les rôles utilisateur
  // IMPORTANT: Si l'utilisateur a UserRole.ADMIN, il a automatiquement accès à tous les menus
  // Mais si l'utilisateur a seulement des AdminRole (sans UserRole.ADMIN),
  // il n'a accès qu'aux menus correspondant à ses AdminRole
  
  // Normaliser le rôle pour gérer les cas où il pourrait être en minuscules ou avec des espaces
  const normalizedRole = userRole?.toString().trim().toUpperCase();
  
  // Liste des rôles admin qui peuvent être dans UserRole
  const adminUserRoles = ['ADMIN', 'PRESID', 'VICEPR', 'SECRET', 'VICESE', 'COMCPT', 'TRESOR', 'VTRESO'];
  
  if (normalizedRole === "ADMIN") {
    // Si l'utilisateur a UserRole.ADMIN, il a le rôle ADMIN dans les menus
    // Cela lui donne accès à tous les menus qui ont "ADMIN" dans leur liste de rôles
    roles.push("ADMIN");
  } else if (normalizedRole === "INVITE") {
    roles.push("INVITE");
  } else if (normalizedRole && adminUserRoles.includes(normalizedRole)) {
    // Si l'utilisateur a un rôle admin dans UserRole (PRESID, VICEPR, SECRET, etc.)
    // l'ajouter aux rôles de menu
    if (!roles.includes(normalizedRole)) {
      roles.push(normalizedRole);
    }
  }

  // Ajouter les rôles d'administration (AdminRole correspond à MenuRole)
  // ADMIN, PRESID, VICEPR, SECRET, VICESE, COMCPT
  // Ces rôles sont ajoutés même si l'utilisateur n'a pas UserRole.ADMIN
  adminRoles.forEach(adminRole => {
    const normalizedAdminRole = adminRole.toString().trim().toUpperCase();
    if (!roles.includes(normalizedAdminRole)) {
      roles.push(normalizedAdminRole);
    }
  });

  // Log pour déboguer
  console.log("[getUserMenuRoles] Conversion des rôles:", {
    userRole,
    adminRoles,
    resultRoles: roles,
  });

  return roles;
}
