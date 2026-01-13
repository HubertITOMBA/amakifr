"use client";

import Image from "next/image";
import Link from "next/link";
import Logo from "@/public/logow1.webp";
import { UserButton } from "../auth/user-button";
import { ThemeToggle } from "../ThemeToggle";
import { NotificationCenter } from "../notifications/NotificationCenter";
import { useState, useMemo } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useElectoralMenu } from "@/hooks/use-electoral-menu";
import { useDynamicMenus, getUserMenuRoles, DynamicMenu } from "@/hooks/use-dynamic-menus";
import { useUnreadMessages } from "@/hooks/use-unread-messages";
import * as LucideIcons from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Composant Navbar dynamique qui charge les menus depuis la base de données
 */
export function DynamicNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const user = useCurrentUser();
  const { enabled: electoralMenuEnabled } = useElectoralMenu();
  const { count: unreadCount } = useUnreadMessages();
  
  // Déterminer les rôles de l'utilisateur
  const userRoles = getUserMenuRoles(user?.role, !!user);
  
  // Charger les menus depuis la DB
  const { menus, loading } = useDynamicMenus("NAVBAR", userRoles);

  // Organiser les menus en hiérarchie parent-enfant
  const { parentMenus, submenusByParent } = useMemo(() => {
    const allFilteredMenus = menus.filter(menu => {
      // Si c'est un menu électoral et que les menus électoraux sont désactivés
      if (menu.electoral && !electoralMenuEnabled) {
        return false;
      }
      
      // Filtrer les menus réservés aux utilisateurs connectés
      if (!user && (menu.lien === "/chat" || menu.lien === "/notifications")) {
        return false;
      }
      
      return true;
    });

    const parents = allFilteredMenus.filter(m => !m.parent);
    const submenuMap: Record<string, DynamicMenu[]> = {};
    
    allFilteredMenus.forEach(menu => {
      if (menu.parent) {
        if (!submenuMap[menu.parent]) {
          submenuMap[menu.parent] = [];
        }
        submenuMap[menu.parent].push(menu);
      }
    });

    // Trier les sous-menus par ordre
    Object.keys(submenuMap).forEach(parentId => {
      submenuMap[parentId].sort((a, b) => a.ordre - b.ordre);
    });

    return { 
      parentMenus: parents, 
      submenusByParent: submenuMap 
    };
  }, [menus, electoralMenuEnabled, user]);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Fonction pour récupérer l'icône Lucide dynamiquement
  const getIcon = (iconName: string | null) => {
    if (!iconName) return null;
    const IconComponent = (LucideIcons as any)[iconName];
    return IconComponent ? <IconComponent className="h-5 w-5" /> : null;
  };

  // Fonction pour rendre un menu (avec ou sans dropdown)
  const renderMenu = (menu: DynamicMenu) => {
    const submenus = submenusByParent[menu.id];
    const hasSubmenus = submenus && submenus.length > 0;
    const isChat = menu.lien === "/chat";
    const hasNotifications = isChat && unreadCount > 0;

    // Menu avec sous-menus : afficher un dropdown
    if (hasSubmenus) {
      return (
        <DropdownMenu key={menu.id}>
          <DropdownMenuTrigger className="font-title text-sm xl:text-base 2xl:text-lg font-semibold leading-6 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5 px-1 whitespace-nowrap shrink-0 outline-none">
            {getIcon(menu.icone)}
            {menu.libelle}
            <ChevronDown className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {submenus.map(submenu => (
              <DropdownMenuItem key={submenu.id} asChild>
                <Link 
                  href={submenu.lien}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  {getIcon(submenu.icone)}
                  <div>
                    <div className="font-medium">{submenu.libelle}</div>
                    {submenu.description && (
                      <div className="text-xs text-muted-foreground">{submenu.description}</div>
                    )}
                  </div>
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    // Menu simple : afficher un lien direct
    return (
      <Link 
        key={menu.id} 
        href={menu.lien} 
        className="font-title text-sm xl:text-base 2xl:text-lg font-semibold leading-6 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5 relative px-1 whitespace-nowrap shrink-0"
        title={menu.description || undefined}
      >
        {getIcon(menu.icone)}
        {menu.libelle}
        {hasNotifications && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Link>
    );
  };

  return (
    <nav className="backdrop-blur-lg sticky top-0 z-[999] bg-white/80 dark:bg-slate-900/80 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
        <div className="flex items-center h-16 gap-2">
          {/* Logo - Largeur fixe */}
          <div className="shrink-0">
            <Link href="/" className="flex flex-col items-center justify-center gap-0 w-14 h-14 p-1 rounded-lg backdrop-blur-3xl bg-gradient-to-br from-blue-500/70 to-purple-600/70 dark:from-blue-600/60 dark:to-purple-700/60 shadow-2xl hover:shadow-blue-500/50 transition-shadow duration-300">
              <Image src={Logo} alt="Logo" className="w-12 h-12" />
            </Link>
          </div>

          {/* Navigation Desktop - Prend l'espace disponible et centre son contenu */}
          <div className="hidden xl:flex xl:gap-x-3 2xl:gap-x-6 justify-center flex-1 min-w-0 items-center">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                Chargement...
              </div>
            ) : (
              parentMenus.map(menu => renderMenu(menu))
            )}
          </div>

          {/* Actions - Largeur fixe, ne rétrécit jamais */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Actions Desktop */}
            <div className="hidden xl:flex xl:items-center xl:gap-2">
              {user && <NotificationCenter />}
              <ThemeToggle />
              <UserButton />
            </div>

            {/* Actions Mobile */}
            <div className="xl:hidden flex items-center gap-1 sm:gap-2">
              {user && <NotificationCenter />}
              <ThemeToggle />
              <UserButton />
              <button
                onClick={toggleMenu}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              >
                <span className="sr-only">Ouvrir le menu</span>
                {isMenuOpen ? (
                  <X className="block h-6 w-6" aria-hidden="true" />
                ) : (
                  <Menu className="block h-6 w-6" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Mobile */}
      {isMenuOpen && (
        <div className="xl:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-gray-700">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                Chargement...
              </div>
            ) : (
              parentMenus.map((menu) => {
                const isChat = menu.lien === "/chat";
                const hasNotifications = isChat && unreadCount > 0;
                const submenus = submenusByParent[menu.id];
                const hasSubmenus = submenus && submenus.length > 0;
                
                return (
                  <div key={menu.id}>
                    {/* Menu parent */}
                    {hasSubmenus ? (
                      <div className="px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2">
                        {getIcon(menu.icone)}
                        {menu.libelle}
                      </div>
                    ) : (
                      <Link
                        href={menu.lien}
                        className="flex items-center gap-2 relative px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                        title={menu.description || undefined}
                      >
                        {getIcon(menu.icone)}
                        {menu.libelle}
                        {hasNotifications && (
                          <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                            {unreadCount > 9 ? "9+" : unreadCount}
                          </span>
                        )}
                      </Link>
                    )}
                    
                    {/* Sous-menus (indentés) */}
                    {hasSubmenus && submenus.map(submenu => (
                      <Link
                        key={submenu.id}
                        href={submenu.lien}
                        className="flex items-center gap-2 pl-12 pr-3 py-2 rounded-md text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                        title={submenu.description || undefined}
                      >
                        {getIcon(submenu.icone)}
                        {submenu.libelle}
                      </Link>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
