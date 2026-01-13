"use client";

import Image from "next/image";
import Link from "next/link";
import Logo from "@/public/logow1.webp";
import HeroImage from "@/public/hero.png";
import { buttonVariants } from "@/components/ui/button";
import { UserButton } from "../auth/user-button";
import { ThemeToggle } from "../ThemeToggle";
import { NotificationCenter } from "../notifications/NotificationCenter";
import { useState, useMemo } from "react";
import { Menu, X, Shield } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useElectoralMenu } from "@/hooks/use-electoral-menu";

const allNavigation = [
  // { name: 'Accueil', href: '/' },
  { name: "L'amicale", href: '/amicale', electoral: false },
  { name: 'Election', href: '/extrat', electoral: true },
  { name: 'Evénements', href: '/evenements', electoral: false },
  { name: 'Galerie', href: '/galerie', electoral: false },
  // { name: 'Upload', href: '/upload' },
  { name: 'Contact', href: '/contact', electoral: false },
  { name: 'Résultats', href: '/resultats', electoral: true },
  // { name: 'Elections', href: '/elections' },
  // { name: 'Candidatures', href: '/candidatures' },
  // { name: 'Vote', href: '/vote' },
]



export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const user = useCurrentUser();
  const { enabled: electoralMenuEnabled } = useElectoralMenu();

  // Filtrer les menus selon le paramètre electoral_menu_enabled
  const navigation = useMemo(() => {
    return allNavigation.filter(item => {
      // Si c'est un menu électoral et que les menus électoraux sont désactivés
      if (item.electoral && !electoralMenuEnabled) {
        return false;
      }
      return true;
    });
  }, [electoralMenuEnabled]);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav className="backdrop-blur-lg sticky top-0 z-[999] bg-white/80 dark:bg-slate-900/80 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex flex-col items-center justify-center gap-0 mr-8 lg:mr-12 -space-y-1">
            <Image src={Logo} alt="Logo" className="size-8" />
          </Link>

          {/* Navigation Desktop */}
          <div className="hidden lg:flex lg:gap-x-12">
            {navigation.map((item) => (
              <Link 
                key={item.name} 
                href={item.href} 
                className="font-title text-xl font-semibold leading-6 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {item.name}
              </Link>
            ))}
            {/* Menu Admin - visible seulement pour les administrateurs */}
            {user?.role === "Admin" && (
              <Link 
                href="/admin"
                className="font-title text-xl font-semibold leading-6 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2"
              >
                <Shield className="h-5 w-5" />
                Admin
              </Link>
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
              className="p-2.5 sm:p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
              aria-label="Menu"
            >
              {isMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Navigation Mobile */}
        {isMenuOpen && (
          <div className="lg:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-gray-700">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="px-4 py-3 sm:px-3 sm:py-2 text-base font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md transition-colors min-h-[44px] sm:min-h-0 flex items-center touch-manipulation"
                  onClick={() => {
                    setIsMenuOpen(false);
                  }}
                >
                  {item.name}
                </Link>
              ))}
              {/* Menu Admin Mobile - visible seulement pour les administrateurs */}
              {user?.role === "Admin" && (
                <Link
                  href="/admin"
                  className="flex items-center gap-2 px-4 py-3 sm:px-3 sm:py-2 text-base font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md transition-colors min-h-[44px] sm:min-h-0 touch-manipulation"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Shield className="h-5 w-5 sm:h-4 sm:w-4" />
                  Admin
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
