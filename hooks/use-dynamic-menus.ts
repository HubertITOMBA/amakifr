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
          setError(result.error || "Erreur lors du chargement des menus");
        }
      } catch (err) {
        console.error("Erreur lors du chargement des menus:", err);
        setError("Erreur lors du chargement des menus");
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
 * @param userRole - Le rôle utilisateur (Admin, Membre, Invite)
 * @param isAuthenticated - Si l'utilisateur est connecté
 * @returns Les rôles de menu correspondants
 */
export function getUserMenuRoles(userRole?: string, isAuthenticated?: boolean): string[] {
  const roles: string[] = ["VISITEUR"]; // Rôle par défaut

  if (!isAuthenticated) {
    return roles;
  }

  // Tous les utilisateurs connectés ont au moins le rôle MEMBRE
  roles.push("MEMBRE");

  // Mapper les rôles utilisateur
  if (userRole === "Admin") {
    roles.push("ADMIN");
  } else if (userRole === "Invite") {
    roles.push("INVITE");
  }

  // TODO: Ajouter la logique pour les rôles de postes (PRESID, SECRET, etc.)
  // Cela nécessitera de charger le poste de l'adhérent depuis la DB

  return roles;
}
