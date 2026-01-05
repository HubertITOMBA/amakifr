"use client";

import { useCurrentUser } from "@/hooks/use-current-user";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { 
  Users, 
  Euro, 
  Settings, 
  BarChart3, 
  FileText, 
  Calendar,
  Mail,
  Shield,
  Home,
  Menu,
  X,
  Lightbulb,
  Award,
  TrendingUp,
  Bell,
  Building2,
  Camera
} from "lucide-react";
import Link from "next/link";

const adminMenuItems = [
  {
    title: "Tableau de bord",
    href: "/admin",
    icon: BarChart3,
    description: "Vue d'ensemble des statistiques"
  },
  {
    title: "Analytics",
    href: "/admin/analytics",
    icon: TrendingUp,
    description: "Dashboard analytique avancé"
  },
  {
    title: "Adhérents",
    href: "/admin/users",
    icon: Users,
    description: "Gestion des membres"
  },

  {
    title: "Cotisations",
    href: "/admin/cotisations",
    icon: Euro,
    description: "Gestion des cotisations"
  },
  {
    title: "Gestion des Cotisations",
    href: "/admin/cotisations/gestion",
    icon: Euro,
    description: "Gestion des cotisations"
  },
  {
    title: "Cotisations du Mois",
    href: "/admin/cotisations-du-mois",
    icon: Calendar,
    description: "Planification des cotisations par mois"
  },
  {
    title: "Depenses",
    href: "/admin/depenses",
    icon: Euro,
    description: "Gestion des depenses"
  },

  {
    title: "Événements",
    href: "/admin/evenements",
    icon: Calendar,
    description: "Gestion des événements"
  },
  {
    title: "Bureau",
    href: "/admin/bureau",
    icon: Building2,
    description: "Gestion du bureau et organigramme"
  },
  {
    title: "Réservations",
    href: "/admin/reservations",
    icon: Calendar,
    description: "Gestion des réservations de ressources"
  },
  {
    title: "Boîte à idées",
    href: "/admin/idees",
    icon: Lightbulb,
    description: "Gestion des idées soumises"
  },
  {
    title: "Notifications",
    href: "/admin/notifications",
    icon: Mail,
    description: "Créer et gérer les notifications"
  },
  {
    title: "Emails",
    href: "/admin/emails",
    icon: Mail,
    description: "Envoyer des emails et consulter l'historique"
  },
  {
    title: "Rappels Automatiques",
    href: "/admin/notifications/rappel",
    icon: Bell,
    description: "Gérer les rappels automatiques"
  },
  {
    title: "Documents",
    href: "/admin/documents",
    icon: FileText,
    description: "Gérer tous les documents des utilisateurs"
  },
  {
    title: "Exports",
    href: "/admin/exports",
    icon: FileText,
    description: "Exporter les données en Excel/CSV"
  },
  {
    title: "Badges",
    href: "/admin/badges",
    icon: Award,
    description: "Gestion des badges et récompenses"
  },
  {
    title: "Galerie",
    href: "/admin/galerie",
    icon: Camera,
    description: "Gestion de la galerie photos et vidéos"
  },
  {
    title: "Finances",
    href: "/admin/finances",
    icon: Euro,
    description: "Gestion financière"
  },
  {
    title: "Relances Automatiques",
    href: "/admin/relances/automatiques",
    icon: Mail,
    description: "Gestion des relances automatiques"
  },
  // {
  //   title: "Contenu",
  //   href: "/admin/content",
  //   icon: FileText,
  //   description: "Gestion du contenu"
  // },
  // {
  //   title: "Newsletter",
  //   href: "/admin/newsletter",
  //   icon: Mail,
  //   description: "Gestion des abonnements"
  // },
  // Menus périodiques (élections) - placés à la fin car peu fréquemment consultés
  {
    title: "Postes",
    href: "/admin/postes",
    icon: Calendar,
    description: "Gestion des postes électoraux"
  },
  {
    title: "Élections",
    href: "/admin/elections",
    icon: Calendar,
    description: "Gestion des élections"
  },
  {
    title: "Votes",
    href: "/admin/votes",
    icon: Shield,
    description: "Votes et résultats"
  },
  {
    title: "Candidatures",
    href: "/admin/candidatures",
    icon: Users,
    description: "Gestion des candidatures"
  },
  {
    title: "Paramètres",
    href: "/admin/settings",
    icon: Settings,
    description: "Configuration du site"
  }
];

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
    if (status === "unauthenticated") {
      router.push("/auth/sign-in");
      return;
    }
    
    if (status === "authenticated" && user?.role !== "Admin") {
      router.push("/");
      return;
    }
  }, [status, user?.role, router]);


  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (status === "unauthenticated" || user?.role !== "Admin") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-transform duration-300 ease-in-out flex flex-col ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
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
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
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

        {/* Navigation - Scrollable */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {adminMenuItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  // Fermer le menu mobile après le clic
                  setSidebarOpen(false);
                  // Forcer le rafraîchissement de la page
                  router.refresh();
                }}
                className="flex items-center space-x-3 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors min-h-[44px] sm:min-h-0 touch-manipulation"
              >
                <IconComponent className="h-5 w-5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{item.title}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {item.description}
                  </div>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Retour à l'accueil */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <Link
            href="/"
            onClick={() => {
              setSidebarOpen(false);
              router.refresh();
            }}
            className="flex items-center space-x-3 w-full px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group min-h-[44px] sm:min-h-0 touch-manipulation"
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
              <Menu className="h-6 w-6" />
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
