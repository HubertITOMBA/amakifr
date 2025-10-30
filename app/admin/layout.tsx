"use client";

import { useCurrentUser } from "@/hooks/use-current-user";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
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
  X
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
    title: "Utilisateurs",
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
    title: "Élections",
    href: "/admin/elections",
    icon: Calendar,
    description: "Gestion des élections"
  },
  {
    title: "Contenu",
    href: "/admin/content",
    icon: FileText,
    description: "Gestion du contenu"
  },
  {
    title: "Newsletter",
    href: "/admin/newsletter",
    icon: Mail,
    description: "Gestion des abonnements"
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/auth/sign-in");
    }
    
    if (status === "authenticated" && user?.role !== "Admin") {
      redirect("/");
    }
  }, [status, user?.role]);


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
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
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
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
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

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {adminMenuItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center space-x-3 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <IconComponent className="h-5 w-5" />
                <div>
                  <div>{item.title}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {item.description}
                  </div>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Retour à l'accueil */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <Link
            href="/"
            className="flex items-center space-x-3 w-full px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group"
          >
            <Home className="h-4 w-4 group-hover:scale-110 transition-transform" />
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
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
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
