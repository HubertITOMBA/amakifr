"use client";

import Image from "next/image";
import Link from "next/link";
import Logo from "@/public/logow1.webp";
import { UserButton } from "../auth/user-button";
import { ThemeToggle } from "../ThemeToggle";
import { NotificationCenter } from "../notifications/NotificationCenter";
import { useState, useMemo } from "react";
import { Menu, X } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useElectoralMenu } from "@/hooks/use-electoral-menu";
import { useDynamicMenus, getUserMenuRoles } from "@/hooks/use-dynamic-menus";
import * as LucideIcons from "lucide-react";

/**
 * Composant Navbar dynamique qui charge les menus depuis la base de données
 */
export function DynamicNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const user = useCurrentUser();
  const { enabled: electoralMenuEnabled } = useElectoralMenu();
  
  // Déterminer les rôles de l'utilisateur
  const userRoles = getUserMenuRoles(user?.role, !!user);
  
  // Charger les menus depuis la DB
  const { menus, loading } = useDynamicMenus("NAVBAR", userRoles);

  // Filtrer les menus selon le paramètre electoral_menu_enabled
  const filteredMenus = useMemo(() => {
    return menus.filter(menu => {
      // Si c'est un menu électoral et que les menus électoraux sont désactivés
      if (menu.electoral && !electoralMenuEnabled) {
        return false;
      }
      return true;
    });
  }, [menus, electoralMenuEnabled]);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Fonction pour récupérer l'icône Lucide dynamiquement
  const getIcon = (iconName: string | null) => {
    if (!iconName) return null;
    const IconComponent = (LucideIcons as any)[iconName];
    return IconComponent ? <IconComponent className="h-5 w-5" /> : null;
  };

  return (
    <nav className="backdrop-blur-lg sticky top-0 z-[999] bg-white/80 dark:bg-slate-900/80 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 mr-8 lg:mr-12">
            <Image src={Logo} alt="Logo" className="size-10" />
            <h3 className="text-2xl font-semibold">
              Ama<span className="text-3xl text-red-500 font-semibold">K</span>i
            </h3>
          </Link>

          {/* Navigation Desktop */}
          <div className="hidden lg:flex lg:gap-x-12">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                Chargement...
              </div>
            ) : (
              filteredMenus.map((menu) => (
                <Link 
                  key={menu.id} 
                  href={menu.lien} 
                  className="font-title text-xl font-semibold leading-6 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2"
                  title={menu.description || undefined}
                >
                  {getIcon(menu.icone)}
                  {menu.libelle}
                </Link>
              ))
            )}
          </div>

          {/* Actions Desktop */}
          <div className="hidden lg:flex lg:items-center lg:gap-2">
            <NotificationCenter />
            <ThemeToggle />
            <UserButton />
          </div>

          {/* Menu Mobile Button */}
          <div className="lg:hidden flex items-center gap-1 sm:gap-2">
            <NotificationCenter />
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

      {/* Menu Mobile */}
      {isMenuOpen && (
        <div className="lg:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-gray-700">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                Chargement...
              </div>
            ) : (
              filteredMenus.map((menu) => (
                <Link
                  key={menu.id}
                  href={menu.lien}
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2"
                  onClick={() => setIsMenuOpen(false)}
                  title={menu.description || undefined}
                >
                  {getIcon(menu.icone)}
                  {menu.libelle}
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
