"use client";

import { useCurrentUser } from "@/hooks/use-current-user";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Shield, Menu as MenuIcon, X, Home } from "lucide-react";
import Link from "next/link";
import { DynamicSidebar } from "@/components/admin/DynamicSidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const user = useCurrentUser();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Ne pas rediriger si le statut est "loading" - attendre que la session soit chargée
    if (status === "loading") {
      return;
    }
    
    // Laisser le middleware gérer la redirection vers /auth/sign-in pour éviter les boucles
    // On vérifie seulement les rôles si l'utilisateur est authentifié
    if (status === "authenticated") {
      // Normaliser le rôle pour gérer les cas où il pourrait être en minuscules
      const normalizedRole = user?.role?.toString().trim().toUpperCase();
      console.log("[AdminLayout] Vérification accès - status:", status, "userRole:", user?.role, "normalisé:", normalizedRole, "email:", user?.email);
      
      // Liste des rôles autorisés à accéder au panel admin
      const adminRoles = ['ADMIN', 'PRESID', 'VICEPR', 'SECRET', 'VICESE', 'COMCPT', 'TRESOR', 'VTRESO'];
      const hasAdminAccess = normalizedRole && adminRoles.includes(normalizedRole);
      
      if (!hasAdminAccess) {
        console.warn("[AdminLayout] Accès refusé - l'utilisateur n'a pas un rôle admin. Rôle actuel:", user?.role);
        // Utiliser window.location.href pour éviter les problèmes de navigation React
        window.location.href = "/";
        return;
      }
    }
  }, [status, user?.role, user?.email]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Normaliser le rôle pour gérer les cas où il pourrait être en minuscules
  const normalizedRole = user?.role?.toString().trim().toUpperCase();
  // Liste des rôles autorisés à accéder au panel admin
  const adminRoles = ['ADMIN', 'PRESID', 'VICEPR', 'SECRET', 'VICESE', 'COMCPT', 'TRESOR', 'VTRESO'];
  const hasAdminAccess = normalizedRole && adminRoles.includes(normalizedRole);
  
  if (status === "unauthenticated" || !hasAdminAccess) {
    console.log("[AdminLayout] Rendu bloqué - status:", status, "rôle:", user?.role, "normalisé:", normalizedRole, "hasAdminAccess:", hasAdminAccess, "email:", user?.email);
    // Afficher un message d'erreur au lieu de retourner null silencieusement
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Accès refusé
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Vous n'avez pas les permissions nécessaires pour accéder à cette page.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
            Rôle actuel: {user?.role || "Non défini"} (normalisé: {normalizedRole || "Non défini"})
          </p>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar - Desktop */}
      <div className="hidden lg:block">
        <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-lg flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Admin Panel
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  AMAKI France
                </p>
              </div>
            </div>
          </div>

          {/* User Info */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {user?.name?.charAt(0).toUpperCase() || 'A'}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {user?.name || 'Administrateur'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation dynamique - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            <DynamicSidebar />
          </div>

          {/* Retour à l'accueil */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
            <Link
              href="/"
              onClick={() => router.refresh()}
              className="flex items-center space-x-3 w-full px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group"
            >
              <Home className="h-4 w-4 group-hover:scale-110 transition-transform flex-shrink-0" />
              <span>Retour à l'accueil</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Sidebar - Mobile */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-transform duration-300 ease-in-out flex flex-col lg:hidden ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                Admin Panel
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                AMAKI France
              </p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User Info */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                {user?.name?.charAt(0).toUpperCase() || 'A'}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {user?.name || 'Administrateur'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {user?.email}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation dynamique - Scrollable */}
        <div className="flex-1 overflow-y-auto" onClick={() => setSidebarOpen(false)}>
          <DynamicSidebar />
        </div>

        {/* Retour à l'accueil */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <Link
            href="/"
            onClick={() => {
              setSidebarOpen(false);
              router.refresh();
            }}
            className="flex items-center space-x-3 w-full px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group min-h-[44px] touch-manipulation"
          >
            <Home className="h-4 w-4 group-hover:scale-110 transition-transform flex-shrink-0" />
            <span>Retour à l'accueil</span>
          </Link>
        </div>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="lg:ml-64">
        {/* Top bar */}
        <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-6 py-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
              aria-label="Ouvrir le menu"
            >
              <MenuIcon className="h-6 w-6" />
            </button>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Bienvenue, {user?.name || 'Administrateur'}
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
