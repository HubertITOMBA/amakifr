"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useElectoralMenu } from "@/hooks/use-electoral-menu";
import { useDynamicMenus, getUserMenuRoles, DynamicMenu } from "@/hooks/use-dynamic-menus";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getCurrentUserAdminRoles } from "@/actions/user/admin-roles";
import { AdminRole } from "@prisma/client";
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Composant Sidebar dynamique pour l'admin qui charge les menus depuis la base de données
 * Ce composant affiche uniquement la liste des liens de navigation
 */
export function DynamicSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useCurrentUser();
  const { enabled: electoralMenuEnabled } = useElectoralMenu();
  const [adminRoles, setAdminRoles] = useState<AdminRole[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  
  // Charger les rôles d'administration de l'utilisateur
  useEffect(() => {
    const loadAdminRoles = async () => {
      if (!user?.id) {
        setLoadingRoles(false);
        return;
      }
      
      try {
        const result = await getCurrentUserAdminRoles();
        if (result && result.success && result.roles) {
          setAdminRoles(result.roles);
        } else if (result && !result.success) {
          console.warn("[DynamicSidebar] Impossible de charger les rôles:", result.error);
          // Continuer sans les rôles d'administration
          setAdminRoles([]);
        }
      } catch (error) {
        console.error("[DynamicSidebar] Erreur lors du chargement des rôles:", error);
        // Continuer sans les rôles d'administration en cas d'erreur
        setAdminRoles([]);
      } finally {
        setLoadingRoles(false);
      }
    };

    loadAdminRoles();
  }, [user?.id]);
  
  // Déterminer les rôles de l'utilisateur (UserRole + AdminRole)
  const userRoles = useMemo(() => {
    try {
      // Normaliser le rôle utilisateur pour être sûr qu'il est en majuscules
      const normalizedUserRole = user?.role?.toString().trim().toUpperCase();
      
      // Log détaillé pour déboguer
      console.log("[DynamicSidebar] Données utilisateur brutes:", {
        userRole: user?.role,
        normalizedUserRole: normalizedUserRole,
        userRoleType: typeof user?.role,
        userRoleValue: JSON.stringify(user?.role),
        adminRoles: adminRoles,
        userEmail: user?.email,
        userId: user?.id,
      });
      
      const roles = getUserMenuRoles(
        normalizedUserRole, // Utiliser le rôle normalisé
        !!user,
        adminRoles.map(r => String(r)) // Convertir AdminRole en string pour correspondre à MenuRole
      );
      
      // Log pour déboguer
      console.log("[DynamicSidebar] Rôles utilisateur convertis:", {
        userRole: user?.role,
        normalizedUserRole: normalizedUserRole,
        adminRoles: adminRoles,
        menuRoles: roles,
        userEmail: user?.email,
        hasAdminRole: roles.includes("ADMIN"),
      });
      
      return roles;
    } catch (error) {
      console.error("[DynamicSidebar] Erreur lors de la conversion des rôles:", error);
      // Retourner les rôles de base en cas d'erreur
      const normalizedUserRole = user?.role?.toString().trim().toUpperCase();
      return getUserMenuRoles(normalizedUserRole, !!user, []);
    }
  }, [user?.role, user, adminRoles]);
  
  // Charger les menus depuis la DB
  const { menus, loading } = useDynamicMenus("SIDEBAR", userRoles);

  // Organiser les menus en hiérarchie parent-enfant (comme la navbar, mais pour la sidebar)
  const { parentMenus, submenusByParent } = useMemo(() => {
    const allFilteredMenus = menus.filter((menu) => {
      if (menu.electoral && !electoralMenuEnabled) return false;
      return true;
    });

    const parents = allFilteredMenus.filter((m) => !m.parent);
    const submenuMap: Record<string, DynamicMenu[]> = {};

    allFilteredMenus.forEach((menu) => {
      if (menu.parent) {
        if (!submenuMap[menu.parent]) submenuMap[menu.parent] = [];
        submenuMap[menu.parent].push(menu);
      }
    });

    Object.keys(submenuMap).forEach((parentId) => {
      submenuMap[parentId].sort((a, b) => a.ordre - b.ordre);
    });

    return { parentMenus: parents, submenusByParent: submenuMap };
  }, [menus, electoralMenuEnabled]);

  // Auto-ouvrir les groupes si la route courante correspond à un sous-menu
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      parentMenus.forEach((parent) => {
        const children = submenusByParent[parent.id] || [];
        const hasActiveChild = children.some(
          (child) => pathname === child.lien || pathname.startsWith(`${child.lien}/`)
        );
        if (hasActiveChild) next[parent.id] = true;
      });
      return next;
    });
  }, [pathname, parentMenus, submenusByParent]);
  
  // Log pour déboguer
  useEffect(() => {
    if (!loading) {
      console.log("[DynamicSidebar] État des menus:", {
        loading,
        menusCount: menus.length,
        filteredMenusCount: parentMenus.length,
        userRoles,
        menus: menus.map(m => ({ libelle: m.libelle, roles: m.roles, lien: m.lien })),
        filteredMenus: parentMenus.map(m => ({ libelle: m.libelle, roles: m.roles, lien: m.lien })),
      });
    }
  }, [menus, loading, userRoles, parentMenus]);

  // Fonction pour récupérer l'icône Lucide dynamiquement
  const getIcon = (iconName: string | null) => {
    if (!iconName) return null;
    const IconComponent = (LucideIcons as any)[iconName];
    return IconComponent ? <IconComponent className="h-5 w-5 shrink-0" /> : null;
  };

  if (loading || loadingRoles) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span>Chargement...</span>
      </div>
    );
  }

  if (parentMenus.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-500">
        Aucun menu disponible
      </div>
    );
  }

  const isFolderLink = (lien: string) => lien === "#" || lien === "/#";

  const renderMenuLink = (menu: DynamicMenu, opts?: { className?: string }) => {
    const isActive = pathname === menu.lien || pathname.startsWith(`${menu.lien}/`);
    return (
      <Link
        key={menu.id}
        href={menu.lien}
        onClick={() => router.refresh()}
        className={cn(
          "flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors min-h-[44px] sm:min-h-0 touch-manipulation",
          isActive
            ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white",
          opts?.className
        )}
        title={menu.description || undefined}
      >
        {getIcon(menu.icone)}
        <div className="min-w-0 flex-1">
          <div className="truncate">{menu.libelle}</div>
          {menu.description && (
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {menu.description}
            </div>
          )}
        </div>
      </Link>
    );
  };

  return (
    <nav className="px-4 py-6 space-y-2">
      {parentMenus.map((menu) => {
        const children = submenusByParent[menu.id] || [];
        const hasSubmenus = children.length > 0;
        const isFolder = hasSubmenus && isFolderLink(menu.lien);
        const isOpen = !!openGroups[menu.id];
        const isActiveParent =
          pathname === menu.lien || (menu.lien !== "#" && pathname.startsWith(`${menu.lien}/`));

        return (
          <div key={menu.id} className="space-y-1">
            {isFolder ? (
              <button
                type="button"
                onClick={() =>
                  setOpenGroups((prev) => ({ ...prev, [menu.id]: !prev[menu.id] }))
                }
                className={cn(
                  "w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors min-h-[44px] sm:min-h-0 touch-manipulation text-left",
                  isActiveParent
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                )}
                title={menu.description || undefined}
              >
                {getIcon(menu.icone)}
                <div className="min-w-0 flex-1">
                  <div className="truncate">{menu.libelle}</div>
                  {menu.description && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {menu.description}
                    </div>
                  )}
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform",
                    isOpen ? "rotate-180" : "rotate-0"
                  )}
                />
              </button>
            ) : (
              renderMenuLink(menu)
            )}

            {hasSubmenus && isOpen && (
              <div className="pl-4 space-y-1">
                {children.map((child) => (
                  <div key={child.id}>
                    {renderMenuLink(child, { className: "text-[13px] px-3 py-2" })}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
